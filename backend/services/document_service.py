import os
import re
import uuid
import logging
from typing import Dict, Any, List, Optional, Tuple

from services.document_models import parse_markdown_to_document, StructuredDocument
from services.docx_generator import generate_docx_document
from services.pdf_generator import generate_pdf_document

logger = logging.getLogger("document_service")

# Storage directory for generated reports
BASE_DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "generated_documents")
os.makedirs(BASE_DOCS_DIR, exist_ok=True)


def _sanitize_filename(name: str) -> str:
    """Creates a clean, safe filesystem filename."""
    s = re.sub(r"[^\w\s-]", "", name).strip().replace(" ", "_")
    return s[:45] or "research_report"


def _requested_document_format(query: str, routed_format: str) -> str:
    """Honor explicit file types in the user's wording over an ambiguous router result."""
    lower = query.lower()
    asks_pdf = bool(re.search(r"\bpdf\b", lower))
    asks_word = bool(re.search(r"\b(?:docx?|word(?:\s+(?:doc|document|file))?)\b", lower))
    if asks_pdf and asks_word:
        return "both"
    if asks_pdf:
        return "pdf"
    if asks_word:
        return "docx"
    normalized = (routed_format or "pdf").lower().strip()
    return normalized if normalized in {"pdf", "docx", "both"} else "pdf"


def store_document_files(
    project_id: str,
    doc_id: str,
    pdf_bytes: Optional[bytes] = None,
    docx_bytes: Optional[bytes] = None,
) -> str:
    """Stores generated PDF and/or DOCX bytes in the project's documents folder."""
    project_dir = os.path.join(BASE_DOCS_DIR, _sanitize_filename(project_id))
    os.makedirs(project_dir, exist_ok=True)

    if pdf_bytes:
        pdf_path = os.path.join(project_dir, f"{doc_id}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

    if docx_bytes:
        docx_path = os.path.join(project_dir, f"{doc_id}.docx")
        with open(docx_path, "wb") as f:
            f.write(docx_bytes)

    return project_dir


def get_document_file_path(project_id: str, doc_id: str, format_type: str = "pdf") -> Optional[str]:
    """Retrieves the file path of a previously generated document."""
    ext = ".docx" if format_type.lower() == "docx" else ".pdf"
    project_dir = os.path.join(BASE_DOCS_DIR, _sanitize_filename(project_id))
    file_path = os.path.join(project_dir, f"{doc_id}{ext}")
    if os.path.isfile(file_path):
        return file_path
    return None


def create_structured_report(
    project_id: str,
    title: str,
    text: str,
    citations: Optional[List[Dict[str, Any]]] = None,
    document_type: str = "research_report",
    format_type: str = "pdf",
    project_name: Optional[str] = None,
    scope_description: Optional[str] = None,
) -> Tuple[Dict[str, Any], Optional[bytes], Optional[bytes]]:
    """
    Parses content into a StructuredDocument, generates DOCX/PDF files, stores them,
    and returns authorized document metadata.
    """
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    doc_model = parse_markdown_to_document(
        title=title,
        text=text,
        citations=citations,
        document_type=document_type,
        format_type=format_type,
        project_name=project_name or "SupervisorX Project",
        scope_description=scope_description,
    )

    pdf_bytes: Optional[bytes] = None
    docx_bytes: Optional[bytes] = None

    fmt_lower = format_type.lower().strip()
    should_pdf = fmt_lower in {"pdf", "both"}
    should_docx = fmt_lower in {"docx", "both", "word"}

    if should_pdf:
        try:
            pdf_bytes = generate_pdf_document(doc_model)
        except Exception as e:
            logger.error(f"Error generating PDF document: {e}", exc_info=True)

    if should_docx:
        try:
            docx_bytes = generate_docx_document(doc_model)
        except Exception as e:
            logger.error(f"Error generating DOCX document: {e}", exc_info=True)

    if not pdf_bytes and not docx_bytes:
        raise ValueError("Failed to generate both PDF and DOCX document outputs")

    store_document_files(
        project_id=project_id,
        doc_id=doc_id,
        pdf_bytes=pdf_bytes,
        docx_bytes=docx_bytes,
    )

    clean_title = _sanitize_filename(title)
    formats_avail = []
    if pdf_bytes:
        formats_avail.append("pdf")
    if docx_bytes:
        formats_avail.append("docx")

    primary_size = len(pdf_bytes) if pdf_bytes else len(docx_bytes or b"")

    doc_meta = {
        "id": doc_id,
        "title": title,
        "document_type": document_type,
        "format": "both" if len(formats_avail) > 1 else (formats_avail[0] if formats_avail else "pdf"),
        "formats_available": formats_avail,
        "filename_pdf": f"{clean_title}.pdf" if pdf_bytes else None,
        "filename_docx": f"{clean_title}.docx" if docx_bytes else None,
        "file_size_bytes": primary_size,
        "generated_at": doc_model.generated_at,
        "scope_description": scope_description,
        "download_url_pdf": f"/api/projects/{project_id}/documents/{doc_id}/download?format=pdf" if pdf_bytes else None,
        "download_url_docx": f"/api/projects/{project_id}/documents/{doc_id}/download?format=docx" if docx_bytes else None,
        "sections_count": len(doc_model.sections),
        "citations_count": len(doc_model.references),
    }

    return doc_meta, pdf_bytes, docx_bytes


def resolve_document_generation(
    project_id: str,
    query: str,
    router_res: Any,
    history: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
    project_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Orchestrates end-to-end document creation based on the user's conversation context:
    - If user asks to turn a previous answer into a PDF/DOCX: reuses validated content & citations.
    - If user asks for a new summary/comparison/question report: executes evidence retrieval,
      then compiles and returns the document and a concise summary.
    """
    from services.rag_service import answer_research_question
    from services.paper_comparator import compare_analyzed_papers
    from services.paper_summarizer import summarize_analyzed_papers

    doc_fmt = _requested_document_format(query, getattr(router_res, "document_format", "pdf") or "pdf")
    doc_src = getattr(router_res, "document_source", "new_query") or "new_query"
    target_papers = getattr(router_res, "target_papers", []) or []

    content_text = ""
    citations_list: List[Dict[str, Any]] = []
    doc_title = "SupervisorX Research Report"
    doc_type = "research_report"
    scope_desc = "Evidence-grounded report"

    lower_query = query.lower()
    explicit_previous_answer = bool(re.search(
        r"\b(?:previous|prior|last|above)\s+(?:answer|response|summary|report)\b|"
        r"\b(?:export|convert|turn|make)\s+(?:this|that|the above)\s+(?:answer|summary|report)\b|"
        r"\b(?:export|convert|turn|make)\s+(?:this|that)\s+(?:into\s+)?(?:a\s+)?(?:pdf|docx|word|document|file)\b|"
        r"\bexport\s+this\s+as\s+(?:a\s+)?(?:pdf|docx|word|document|file)\b|"
        r"\bthis answer\b|\bthat answer\b",
        lower_query,
    ))
    asks_for_new_summary_or_comparison = bool(re.search(r"\b(?:summar\w*|compar\w*)\b", lower_query))

    # Reuse conversational content only when the user explicitly points to an earlier answer.
    if explicit_previous_answer or (doc_src == "previous_answer" and not asks_for_new_summary_or_comparison):
        last_ai_msg = None
        if history:
            for m in reversed(history):
                sender = m.get("sender") or m.get("role") or ""
                text = m.get("text") or m.get("content") or ""
                if sender in {"ai", "assistant"} and text:
                    last_ai_msg = m
                    break

        if last_ai_msg:
            content_text = last_ai_msg.get("text") or last_ai_msg.get("content") or ""
            citations_list = last_ai_msg.get("citations") or []
            doc_type = last_ai_msg.get("intent") or "previous_answer_export"
            doc_title = "Research Synthesis Report"
            scope_desc = f"Export of conversational research answer ({len(citations_list)} citations)"

    # Case B: If no previous message or user asks for a new specific topic/comparison/summary
    if not content_text:
        lower_q = query.lower()
        if "compare" in lower_q or any(k in lower_q for k in ["difference between", "comparison"]):
            # Generate grounded paper comparison
            comp_res = compare_analyzed_papers(
                project_id=project_id,
                query=query,
                target_paper_mentions=target_papers,
                api_key=api_key,
            )
            content_text = comp_res.answer
            citations_list = [c.model_dump() for c in comp_res.citations]
            doc_title = "Comparative Research Report"
            doc_type = "paper_comparison"
            scope_desc = f"Methodological and empirical comparison of {len(comp_res.compared_papers)} papers"

        elif "summar" in lower_q:
            # Generate grounded paper summary
            sum_res = summarize_analyzed_papers(
                project_id=project_id,
                query=query,
                target_paper_mentions=target_papers,
                api_key=api_key,
            )
            content_text = sum_res.answer
            citations_list = [c.model_dump() for c in sum_res.citations]
            doc_title = "Academic Literature Summary"
            doc_type = "paper_summary"
            paper_count = len(sum_res.summarized_papers)
            paper_label = "paper" if paper_count == 1 else "papers"
            scope_desc = f"Structured executive summary across {paper_count} analyzed {paper_label}"

        else:
            # Grounded QA / Topic report
            qa_res = answer_research_question(
                project_id=project_id,
                query=router_res.extracted_query or query,
                recent_history=history,
                target_paper_ids=target_papers,
                api_key=api_key,
            )
            content_text = qa_res.answer
            citations_list = [c.model_dump() for c in qa_res.citations]
            doc_title = router_res.extracted_query or "Evidence-Grounded Research Report"
            doc_type = "question_answering"
            scope_desc = f"Evidence-grounded analysis across {qa_res.eligible_papers_count} analyzed papers"

    # Clean document title
    if len(doc_title) > 60:
        doc_title = doc_title[:60].strip() + "..."
    doc_title = doc_title.replace("\n", " ").strip()

    # Generate structured report files
    doc_meta, _, _ = create_structured_report(
        project_id=project_id,
        title=doc_title,
        text=content_text,
        citations=citations_list,
        document_type=doc_type,
        format_type=doc_fmt,
        project_name=project_name,
        scope_description=scope_desc,
    )

    fmt_label = "PDF and Word documents" if doc_meta["format"] == "both" else f"{doc_meta['format'].upper()} document"
    concise_msg = (
        f"I have compiled your research synthesis into a professionally typeset **{fmt_label}**.\n\n"
        f"**Document Title:** {doc_title}\n"
        f"**Scope:** {scope_desc}\n"
        f"**Grounded Citations:** {len(citations_list)} verified source anchors\n\n"
        f"You can download your document below."
    )

    return {
        "intent": "generate_document",
        "success": True,
        "is_papers_response": False,
        "answer": concise_msg,
        "citations": citations_list,
        "document": doc_meta,
    }
