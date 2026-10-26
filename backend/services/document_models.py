import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ContentBlock(BaseModel):
    type: str = Field(description="'paragraph' | 'bullet_list' | 'numbered_list' | 'table' | 'equation' | 'blockquote' | 'callout'")
    content: Optional[str] = None
    items: Optional[List[str]] = None
    headers: Optional[List[str]] = None
    rows: Optional[List[List[str]]] = None
    latex: Optional[str] = None
    citations: Optional[List[int]] = None


class SectionModel(BaseModel):
    heading: str
    level: int = 1
    blocks: List[ContentBlock] = Field(default_factory=list)


class CitationMetadata(BaseModel):
    index: int
    paper_id: str
    paper_title: str
    authors: str
    year: Optional[int] = None
    venue: Optional[str] = None
    section_title: Optional[str] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    page_label: Optional[str] = None
    url: Optional[str] = None
    claim_supported: Optional[str] = None


class StructuredDocument(BaseModel):
    title: str
    subtitle: Optional[str] = None
    document_type: str = Field(default="research_report")
    format: str = Field(default="pdf")
    project_name: Optional[str] = None
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%B %d, %Y"))
    scope_description: Optional[str] = None
    sections: List[SectionModel] = Field(default_factory=list)
    references: List[CitationMetadata] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


def parse_markdown_to_document(
    title: str,
    text: str,
    citations: Optional[List[Dict[str, Any]]] = None,
    document_type: str = "research_report",
    format_type: str = "pdf",
    project_name: Optional[str] = None,
    scope_description: Optional[str] = None,
) -> StructuredDocument:
    """
    Parses a verified evidence-grounded answer or LLM response into a validated StructuredDocument.
    Preserves heading hierarchies, lists, tables, mathematical equations, and citations.
    """
    lines = text.split("\n")
    sections: List[SectionModel] = []
    current_section = SectionModel(heading="Overview", level=1, blocks=[])
    has_current_heading = False

    i = 0
    while i < lines.length if hasattr(lines, "length") else i < len(lines):
        line = lines[i]
        trimmed = line.strip()

        # Display math $$ ... $$
        if trimmed.startswith("$$"):
            math_lines = []
            if trimmed == "$$":
                i += 1
                while i < len(lines) and not lines[i].strip().endswith("$$"):
                    math_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    closing = lines[i].strip().replace("$$", "")
                    if closing:
                        math_lines.append(closing)
                    i += 1
            elif trimmed.endswith("$$") and len(trimmed) > 4:
                math_lines.append(trimmed[2:-2].strip())
                i += 1
            else:
                math_lines.append(trimmed[2:])
                i += 1
                while i < len(lines) and "$$" not in lines[i]:
                    math_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    parts = lines[i].split("$$")
                    if parts[0]:
                        math_lines.append(parts[0])
                    i += 1

            latex_str = "\n".join(math_lines).strip()
            if latex_str:
                current_section.blocks.append(ContentBlock(type="equation", latex=latex_str))
            continue

        # Markdown Table
        if trimmed.startswith("|") and trimmed.endswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            if len(table_lines) >= 2:
                headers = [h.strip() for h in table_lines[0].split("|")[1:-1]]
                rows = []
                # Line 1 is typically separator (|---|---|)
                for row_str in table_lines[2:]:
                    cells = [c.strip() for c in row_str.split("|")[1:-1]]
                    rows.append(cells)
                current_section.blocks.append(
                    ContentBlock(type="table", headers=headers, rows=rows)
                )
            continue

        # Headings
        if trimmed.startswith("# "):
            if current_section.blocks or has_current_heading:
                sections.append(current_section)
            current_section = SectionModel(heading=trimmed[2:].strip(), level=1, blocks=[])
            has_current_heading = True
            i += 1
            continue
        elif trimmed.startswith("## "):
            if current_section.blocks or has_current_heading:
                sections.append(current_section)
            current_section = SectionModel(heading=trimmed[3:].strip(), level=2, blocks=[])
            has_current_heading = True
            i += 1
            continue
        elif trimmed.startswith("### "):
            if current_section.blocks or has_current_heading:
                sections.append(current_section)
            current_section = SectionModel(heading=trimmed[4:].strip(), level=3, blocks=[])
            has_current_heading = True
            i += 1
            continue
        elif trimmed.startswith("#### "):
            if current_section.blocks or has_current_heading:
                sections.append(current_section)
            current_section = SectionModel(heading=trimmed[5:].strip(), level=4, blocks=[])
            has_current_heading = True
            i += 1
            continue

        # Numbered List
        num_match = re.match(r"^\s*(\d+)\.\s+(.*)$", line)
        if num_match:
            num_items = []
            while i < len(lines):
                m = re.match(r"^\s*(\d+)\.\s+(.*)$", lines[i])
                if not m:
                    break
                num_items.append(m.group(2).strip())
                i += 1
            if num_items:
                current_section.blocks.append(ContentBlock(type="numbered_list", items=num_items))
            continue

        # Bullet List
        if trimmed.startswith("- ") or trimmed.startswith("* "):
            bullet_items = []
            while i < len(lines) and (lines[i].strip().startswith("- ") or lines[i].strip().startswith("* ")):
                bullet_items.append(lines[i].strip()[2:].strip())
                i += 1
            if bullet_items:
                current_section.blocks.append(ContentBlock(type="bullet_list", items=bullet_items))
            continue

        # Blockquote
        if trimmed.startswith(">"):
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote_lines.append(lines[i].strip().lstrip(">").strip())
                i += 1
            if quote_lines:
                current_section.blocks.append(ContentBlock(type="blockquote", content=" ".join(quote_lines)))
            continue

        # Empty line
        if not trimmed:
            i += 1
            continue

        # Regular Paragraph
        # Extract inline citation numbers [1], [2]
        cit_matches = re.findall(r"\[(\d+)\]", trimmed)
        cit_indices = [int(c) for c in cit_matches] if cit_matches else None
        current_section.blocks.append(
            ContentBlock(type="paragraph", content=trimmed, citations=cit_indices)
        )
        i += 1

    if current_section.blocks or has_current_heading:
        sections.append(current_section)

    # Keep only cited sources and renumber them contiguously for the exported report.
    citation_by_index: Dict[int, CitationMetadata] = {}
    for idx, citation in enumerate(citations or [], start=1):
        if isinstance(citation, CitationMetadata):
            item = citation
        elif isinstance(citation, dict):
            item = CitationMetadata(
                index=int(citation.get("citation_index") or citation.get("index") or idx),
                paper_id=citation.get("paper_id") or f"P{idx}",
                paper_title=citation.get("paper_title") or "Academic Publication",
                authors=citation.get("authors") or "Unknown Authors",
                year=citation.get("year"),
                venue=citation.get("venue"),
                section_title=citation.get("section_title"),
                page_start=citation.get("page_start"),
                page_end=citation.get("page_end"),
                page_label=citation.get("page_label"),
                url=citation.get("pdf_url") or citation.get("url"),
                claim_supported=citation.get("claim_supported"),
            )
        else:
            continue
        citation_by_index.setdefault(item.index, item)

    old_indices = sorted({
        int(number)
        for match in re.finditer(r"\[(\d+(?:\s*,\s*\d+)*)\]", text)
        for number in re.findall(r"\d+", match.group(1))
        if int(number) in citation_by_index
    })
    index_map = {old_index: new_index for new_index, old_index in enumerate(old_indices, start=1)}

    def renumber_citations(match: re.Match) -> str:
        numbers = [int(number) for number in re.findall(r"\d+", match.group(1))]
        mapped = list(dict.fromkeys(index_map[number] for number in numbers if number in index_map))
        return f"[{', '.join(map(str, mapped))}]" if mapped else ""

    if citations:
        text = re.sub(r"\[(\d+(?:\s*,\s*\d+)*)\]", renumber_citations, text)
        for section in sections:
            for block in section.blocks:
                if block.content:
                    block.content = re.sub(r"\[(\d+(?:\s*,\s*\d+)*)\]", renumber_citations, block.content)
                if block.items:
                    block.items = [re.sub(r"\[(\d+(?:\s*,\s*\d+)*)\]", renumber_citations, item) for item in block.items]
                if block.headers:
                    block.headers = [re.sub(r"\[(\d+(?:\s*,\s*\d+)*)\]", renumber_citations, cell) for cell in block.headers]
                if block.rows:
                    block.rows = [
                        [re.sub(r"\[(\d+(?:\s*,\s*\d+)*)\]", renumber_citations, cell) for cell in row]
                        for row in block.rows
                    ]

    reference_models = [citation_by_index[old].model_copy(update={"index": new}) for old, new in index_map.items()]

    return StructuredDocument(
        title=title,
        document_type=document_type,
        format=format_type,
        project_name=project_name or "SupervisorX Project",
        scope_description=scope_description,
        sections=sections,
        references=reference_models,
        metadata={"total_sections": len(sections), "total_references": len(reference_models)},
    )
