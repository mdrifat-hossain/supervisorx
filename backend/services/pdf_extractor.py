import io
import re
import base64
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import pymupdf

SECTION_HEADING_REGEX = re.compile(
    r"^(?:(?:\d+\.?)+\s+)?(Abstract|Introduction|Related\s+Work|Background|Methodology|Method|Proposed\s+Method|Architecture|System\s+Overview|Experiments|Experimental\s+Setup|Results|Discussion|Analysis|Evaluation|Conclusion|Conclusions|Limitations|Future\s+Work|Ablation\s+Study|References)(?:\s*:|\b)",
    re.IGNORECASE
)

CAPTION_REGEX = re.compile(
    r"^(?:(?:Figure|Fig\.?|Table)\s*(\d+[a-zA-Z]?))(?:\s*[:.-]\s*|\s+)(.*)",
    re.IGNORECASE
)

def _compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def extract_pdf_structure_and_chunks(
    pdf_bytes: bytes,
    paper_id: str,
    project_id: str,
    target_chunk_chars: int = 1800,
    overlap_chars: int = 200,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Parses a PDF using PyMuPDF:
    1. Extracts document metadata and title.
    2. Identifies sections, page numbers, text blocks, and captions.
    3. Produces section-aware text chunks preserving page ranges and citations.
    4. Extracts visual figures, charts, and diagrams with captions and base64 imagery.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    doc_meta = doc.metadata or {}
    pdf_title = doc_meta.get("title") or ""

    # Accumulate sections and text blocks with page references
    structured_blocks = []
    current_section = "Abstract" if total_pages > 0 else "Document"
    current_section_path = current_section

    raw_captions: List[Dict[str, Any]] = []

    for page_idx in range(total_pages):
        page_num = page_idx + 1
        page = doc[page_idx]

        # Extract text blocks with layout coordinates and font details
        blocks = page.get_text("blocks")
        # Format of block: (x0, y0, x1, y1, text, block_no, block_type)
        # block_type 0 = text, 1 = image

        for block in blocks:
            if block[6] == 0:  # Text block
                block_text = block[4].strip()
                if not block_text:
                    continue

                # Check if this text block is a section heading
                first_line = block_text.split("\n")[0].strip()
                heading_match = SECTION_HEADING_REGEX.match(first_line)
                if heading_match and len(first_line) < 100:
                    current_section = first_line
                    current_section_path = current_section
                    # If block has more than just heading, keep the rest as body
                    lines = block_text.split("\n")
                    if len(lines) > 1:
                        remaining_text = "\n".join(lines[1:]).strip()
                        if remaining_text:
                            structured_blocks.append({
                                "page": page_num,
                                "section": current_section,
                                "section_path": current_section_path,
                                "text": remaining_text,
                                "bbox": (block[0], block[1], block[2], block[3]),
                            })
                    continue

                # Check if this text block is a figure or table caption
                caption_match = CAPTION_REGEX.match(first_line)
                if caption_match:
                    raw_captions.append({
                        "page": page_num,
                        "figure_number": caption_match.group(1),
                        "caption": block_text,
                        "section": current_section,
                        "bbox": (block[0], block[1], block[2], block[3]),
                    })

                structured_blocks.append({
                    "page": page_num,
                    "section": current_section,
                    "section_path": current_section_path,
                    "text": block_text,
                    "bbox": (block[0], block[1], block[2], block[3]),
                })

    # Chunking: Section-aware text chunking
    chunks: List[Dict[str, Any]] = []
    current_chunk_text = ""
    current_chunk_pages = set()
    current_chunk_section = current_section
    current_chunk_section_path = current_section_path
    chunk_index = 0

    for block in structured_blocks:
        b_text = block["text"]
        b_page = block["page"]
        b_section = block["section"]
        b_section_path = block["section_path"]

        # If section changed and we already have sufficient content, seal chunk
        section_changed = b_section != current_chunk_section and len(current_chunk_text) > 400

        if section_changed or (len(current_chunk_text) + len(b_text) > target_chunk_chars):
            if current_chunk_text.strip():
                sorted_pages = sorted(list(current_chunk_pages))
                page_start = sorted_pages[0] if sorted_pages else 1
                page_end = sorted_pages[-1] if sorted_pages else page_start

                chunks.append({
                    "id": f"{paper_id}-chunk-{chunk_index}",
                    "paper_id": paper_id,
                    "project_id": project_id,
                    "chunk_index": chunk_index,
                    "page_start": page_start,
                    "page_end": page_end,
                    "section_title": current_chunk_section,
                    "section_path": current_chunk_section_path,
                    "content_type": "text_chunk",
                    "text_content": current_chunk_text.strip(),
                    "content_hash": _compute_hash(current_chunk_text.strip()),
                })
                chunk_index += 1

                # Carry over overlap if within the same section
                if not section_changed and overlap_chars > 0:
                    current_chunk_text = current_chunk_text[-overlap_chars:] + "\n" + b_text
                else:
                    current_chunk_text = b_text
                current_chunk_pages = {b_page}
                current_chunk_section = b_section
                current_chunk_section_path = b_section_path
        else:
            if current_chunk_text:
                current_chunk_text += "\n\n" + b_text
            else:
                current_chunk_text = b_text
            current_chunk_pages.add(b_page)
            current_chunk_section = b_section
            current_chunk_section_path = b_section_path

    # Flush remaining text
    if current_chunk_text.strip():
        sorted_pages = sorted(list(current_chunk_pages))
        page_start = sorted_pages[0] if sorted_pages else 1
        page_end = sorted_pages[-1] if sorted_pages else page_start

        chunks.append({
            "id": f"{paper_id}-chunk-{chunk_index}",
            "paper_id": paper_id,
            "project_id": project_id,
            "chunk_index": chunk_index,
            "page_start": page_start,
            "page_end": page_end,
            "section_title": current_chunk_section,
            "section_path": current_chunk_section_path,
            "content_type": "text_chunk",
            "text_content": current_chunk_text.strip(),
            "content_hash": _compute_hash(current_chunk_text.strip()),
        })

    # Visual extraction: Inspect embedded images & render caption regions
    visual_items: List[Dict[str, Any]] = []
    processed_figures = set()

    for idx, cap in enumerate(raw_captions):
        fig_num = cap.get("figure_number") or str(idx + 1)
        if fig_num in processed_figures:
            continue
        processed_figures.add(fig_num)

        page_num = cap["page"]
        page = doc[page_num - 1]
        c_bbox = cap["bbox"]  # (x0, y0, x1, y1)

        # Look for visual elements on the same page above or below the caption
        # Bounding box crop: usually figure is above caption
        page_rect = page.rect
        y_top = max(0, c_bbox[1] - 350)
        y_bottom = min(page_rect.height, c_bbox[3] + 20)
        crop_rect = pymupdf.Rect(0, y_top, page_rect.width, y_bottom)

        try:
            pix = page.get_pixmap(clip=crop_rect, dpi=150)
            if pix.width >= 120 and pix.height >= 80:
                img_bytes = pix.tobytes("png")
                b64_img = base64.b64encode(img_bytes).decode("utf-8")

                visual_items.append({
                    "id": f"{paper_id}-vis-{fig_num}",
                    "paper_id": paper_id,
                    "project_id": project_id,
                    "page_number": page_num,
                    "figure_number": fig_num,
                    "caption": cap["caption"],
                    "section_title": cap["section"],
                    "visual_type": "table" if "table" in cap["caption"].lower() else "figure_chart",
                    "base64_image": b64_img,
                    "content_hash": _compute_hash(f"{paper_id}:{fig_num}:{cap['caption']}"),
                })
        except Exception:
            continue

        if len(visual_items) >= 4:  # Cap at top 4 prominent scientific figures
            break

    # If no captions were detected but page has embedded images, extract prominent images
    if not visual_items:
        for page_idx in range(min(5, total_pages)):
            page_num = page_idx + 1
            page = doc[page_idx]
            img_list = page.get_images(full=True)
            for img_info in img_list[:2]:
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    img_bytes = base_image["image"]
                    if len(img_bytes) > 20000:  # Ignore tiny icons
                        b64_img = base64.b64encode(img_bytes).decode("utf-8")
                        v_id = f"{paper_id}-vis-p{page_num}-{xref}"
                        visual_items.append({
                            "id": v_id,
                            "paper_id": paper_id,
                            "project_id": project_id,
                            "page_number": page_num,
                            "figure_number": f"P{page_num}-Img{xref}",
                            "caption": f"Extracted scientific visual on page {page_num}",
                            "section_title": "Visual Analysis",
                            "visual_type": "scientific_illustration",
                            "base64_image": b64_img,
                            "content_hash": _compute_hash(f"{paper_id}:p{page_num}:{xref}"),
                        })
                except Exception:
                    continue
                if len(visual_items) >= 4:
                    break
            if len(visual_items) >= 4:
                break

    doc.close()

    summary_info = {
        "title": pdf_title,
        "total_pages": total_pages,
        "chunks_count": len(chunks),
        "figures_count": len(visual_items),
    }

    return chunks, visual_items, summary_info
