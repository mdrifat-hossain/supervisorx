import io
import re
from xml.sax.saxutils import escape, quoteattr
from typing import List, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

from services.document_models import StructuredDocument, ContentBlock, SectionModel
from services.docx_generator import clean_latex_for_doc


# Color Palette
COLOR_NAVY = colors.HexColor("#0F2942")
COLOR_TEAL = colors.HexColor("#0284C7")
COLOR_TEXT = colors.HexColor("#1E293B")
COLOR_MUTED = colors.HexColor("#64748B")
COLOR_BG_ALT = colors.HexColor("#F8FAFC")
COLOR_BORDER = colors.HexColor("#CBD5E1")


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute total pages and draw
    professional running headers and footers with 'Page X of Y'.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        self.saveState()
        page_w, page_h = letter

        # Running Header (on all pages)
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(COLOR_TEAL)
        self.drawString(54, page_h - 36, "SUPERVISORX")

        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_MUTED)
        self.drawString(124, page_h - 36, "•  Evidence-Grounded Scientific Synthesis")

        # Top rule
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.6)
        self.line(54, page_h - 42, page_w - 54, page_h - 42)

        # Bottom rule
        self.line(54, 46, page_w - 54, 46)

        # Running Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_MUTED)
        self.drawString(54, 34, "Generated via SupervisorX Academic Agent • Confidential Research")

        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(page_w - 54, 34, page_str)

        self.restoreState()


def format_inline_html(text: str) -> str:
    """Formats markdown bold, italics, code, inline math, and citations into ReportLab XML."""
    if not text:
        return ""

    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )

    # 1. Inline math $...$ -> clean scientific typography
    def replace_math(match):
        latex = match.group(1)
        clean = clean_latex_for_doc(latex)
        return f'<font color="#0F2942"><i><b>{clean}</b></i></font>'
    escaped = re.sub(r"\$([^$\n]+)\$", replace_math, escaped)

    # 2. Citations [1], [1, 2] -> teal badge
    escaped = re.sub(
        r"\[(\d+(?:,\s*\d+)*)\]",
        r'<font color="#0284C7"><b>[\1]</b></font>',
        escaped,
    )

    # 3. Bold **text** -> <b>text</b>
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)

    # 4. Code `text` -> Courier
    escaped = re.sub(r"`([^`]+)`", r'<font face="Courier" color="#0284C7">\1</font>', escaped)

    # 5. Italic *text* -> <i>text</i>
    escaped = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", escaped)

    return escaped


def generate_pdf_document(doc_model: StructuredDocument) -> bytes:
    """
    Renders a validated StructuredDocument into a polished, professional PDF report.
    """
    buffer = io.BytesIO()

    # 54pt margins = 0.75 in
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=COLOR_NAVY,
        spaceAfter=6,
    )

    style_meta = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=COLOR_TEAL,
        spaceAfter=12,
    )

    style_scope = ParagraphStyle(
        "DocScope",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9.5,
        leading=13,
        textColor=COLOR_MUTED,
        spaceAfter=10,
    )

    style_h1 = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=COLOR_NAVY,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )

    style_h2 = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=COLOR_TEAL,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    style_body = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=COLOR_TEXT,
        spaceAfter=6,
    )

    style_bullet = ParagraphStyle(
        "Bullet_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=COLOR_TEXT,
        leftIndent=14,
        spaceAfter=4,
    )

    style_blockquote = ParagraphStyle(
        "Quote_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=13,
        textColor=COLOR_MUTED,
        leftIndent=16,
        spaceBefore=4,
        spaceAfter=6,
    )

    style_equation = ParagraphStyle(
        "Equation_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=COLOR_NAVY,
        alignment=1, # Centered
    )

    style_tbl_header = ParagraphStyle(
        "TblHeader_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )

    style_tbl_cell = ParagraphStyle(
        "TblCell_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=COLOR_TEXT,
    )

    story = []

    # Title Block
    story.append(Paragraph(doc_model.title, style_title))

    type_tag = doc_model.document_type.replace("_", " ").upper()
    meta_text = f"{type_tag}   •   Date: {doc_model.generated_at}   •   Project: {doc_model.project_name or 'Research Project'}"
    story.append(Paragraph(meta_text, style_meta))

    if doc_model.scope_description:
        story.append(Paragraph(f"Scope: {doc_model.scope_description}", style_scope))

    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDER, spaceBefore=4, spaceAfter=10))

    # Render Sections
    for sec in doc_model.sections:
        h_style = style_h1 if sec.level == 1 else style_h2
        story.append(Paragraph(sec.heading, h_style))

        for block in sec.blocks:
            if block.type == "paragraph" and block.content:
                story.append(Paragraph(format_inline_html(block.content), style_body))

            elif block.type == "bullet_list" and block.items:
                for item in block.items:
                    story.append(Paragraph(f"•  {format_inline_html(item)}", style_bullet))

            elif block.type == "numbered_list" and block.items:
                for idx, item in enumerate(block.items, start=1):
                    story.append(Paragraph(f"<b>{idx}.</b>  {format_inline_html(item)}", style_bullet))

            elif block.type == "blockquote" and block.content:
                story.append(Paragraph(f"“{format_inline_html(block.content)}”", style_blockquote))

            elif block.type == "equation" and block.latex:
                clean_eq = clean_latex_for_doc(block.latex)
                eq_flowable = Paragraph(clean_eq, style_equation)
                # Render in a shaded box table
                eq_tbl = Table([[eq_flowable]], colWidths=[504])
                eq_tbl.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_ALT),
                    ("BOX", (0, 0), (-1, -1), 0.8, COLOR_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ]))
                story.append(Spacer(1, 3))
                story.append(eq_tbl)
                story.append(Spacer(1, 6))

            elif block.type == "table" and block.headers and block.rows:
                # Calculate column widths to fit 504pt (total printable width)
                num_cols = len(block.headers)
                col_w = 504.0 / max(1, num_cols)

                tbl_data = []
                # Header
                header_row = [Paragraph(format_inline_html(h), style_tbl_header) for h in block.headers]
                tbl_data.append(header_row)

                # Body
                for row in block.rows:
                    row_cells = [Paragraph(format_inline_html(str(cell)), style_tbl_cell) for cell in row[:num_cols]]
                    tbl_data.append(row_cells)

                table = Table(tbl_data, colWidths=[col_w] * num_cols, repeatRows=1)
                tbl_style = [
                    ("BACKGROUND", (0, 0), (-1, 0), COLOR_NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ]
                # Alternating row colors
                for r_idx in range(1, len(tbl_data)):
                    if r_idx % 2 == 1:
                        tbl_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), COLOR_BG_ALT))

                table.setStyle(TableStyle(tbl_style))
                story.append(Spacer(1, 4))
                story.append(table)
                story.append(Spacer(1, 6))

    # References Section
    if doc_model.references:
        story.append(Spacer(1, 8))
        story.append(Paragraph("References &amp; Grounded Citations", style_h1))

        ref_items = []
        for ref in doc_model.references:
            venue_part = f"{ref.venue}, " if ref.venue else ""
            year_part = f"{ref.year}. " if ref.year else ""
            location_parts = [part for part in (ref.section_title, ref.page_label) if part]
            page_part = "Section: " + escape(ref.section_title) if ref.section_title else ""
            if ref.page_label:
                page_part += ("; " if page_part else "") + escape(ref.page_label)
            if not location_parts:
                page_part = "Location unavailable"
            authors_text = ref.authors.rstrip()
            if authors_text and not authors_text.endswith("."):
                authors_text += "."
            link_part = ""
            source_url = ref.url or ""
            if ref.page_start and "#page=" not in source_url:
                source_url = f"{source_url}#page={ref.page_start}"
            if source_url.startswith(("http://", "https://")):
                link_part = f'<br/><link href={quoteattr(source_url)} color="#0284C7">Open source PDF</link>'
            ref_html = (
                f'<font color="#0284C7"><b>[{ref.index}]</b></font> '
                f'<b>"{escape(ref.paper_title)}"</b>. {escape(authors_text)} '
                f'<i>{escape(venue_part)}{escape(year_part)}{page_part}</i>{link_part}'
            )
            ref_items.append(Paragraph(ref_html, style_body))

        for r_p in ref_items:
            story.append(r_p)

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
