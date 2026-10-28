import os
import re
import uuid
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

import requests
from config import settings
from services.document_models import parse_markdown_to_document, StructuredDocument
from services.docx_generator import generate_docx_document
from services.pdf_generator import generate_pdf_document

logger = logging.getLogger("document_service")

# Optional legacy local cache directory (unused in cloud-first operation)
BASE_DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "generated_documents")


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


def upload_file_to_supabase(bucket: str, storage_path: str, data: bytes, content_type: str) -> bool:
    """Uploads document bytes to private Supabase Storage."""
    supabase_url = settings.SUPABASE_URL.rstrip("/")
    secret_key = settings.SUPABASE_SECRET_KEY
    if not supabase_url or not secret_key:
        logger.warning("Supabase storage credentials missing; skipping cloud upload.")
        return False
    try:
        encoded_path = "/".join(requests.utils.quote(p) for p in storage_path.split("/"))
        url = f"{supabase_url}/storage/v1/object/{bucket}/{encoded_path}"
        headers = {
            "apikey": secret_key,
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        resp = requests.post(url, headers=headers, data=data, timeout=60)
        if resp.status_code in (200, 201):
            logger.info(f"Successfully uploaded {storage_path} to Supabase bucket '{bucket}'")
            return True
        logger.error(f"Supabase upload failed ({resp.status_code}): {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Exception uploading to Supabase Storage: {e}")
        return False


def download_file_from_supabase(bucket: str, storage_path: str) -> Optional[bytes]:
    """Downloads a document from Supabase Storage."""
    supabase_url = settings.SUPABASE_URL.rstrip("/")
    secret_key = settings.SUPABASE_SECRET_KEY
    if not supabase_url or not secret_key:
        return None
    try:
        encoded_path = "/".join(requests.utils.quote(p) for p in storage_path.split("/"))
        url = f"{supabase_url}/storage/v1/object/authenticated/{bucket}/{encoded_path}"
        headers = {"apikey": secret_key, "Authorization": f"Bearer {secret_key}"}
        resp = requests.get(url, headers=headers, timeout=60)
        if resp.status_code == 200:
            return resp.content
        logger.warning(f"Supabase download returned status {resp.status_code} for {storage_path}")
        return None
    except Exception as e:
        logger.error(f"Exception downloading from Supabase Storage: {e}")
        return None


def register_report_in_project_papers(
    project_id: str,
    doc_id: str,
    title: str,
    scope_desc: str,
    pdf_bytes: Optional[bytes] = None,
    docx_bytes: Optional[bytes] = None,
    pdf_storage_path: Optional[str] = None,
    docx_storage_path: Optional[str] = None,
):
    """
    Registers the generated report into project_papers so it is cataloged in the
    Project Paper Library and can be opened, reviewed, or deleted.
    """
    try:
        from services.paper_analysis_pipeline import get_db_connection
        size_bytes = len(pdf_bytes) if pdf_bytes else len(docx_bytes or b"")
        size_label = (
            f"{(size_bytes / 1024):.1f} KB • Report"
            if size_bytes < 1024 * 1024
            else f"{(size_bytes / (1024 * 1024)):.2f} MB • Report"
        )
        clean_name = _sanitize_filename(title)
        file_name = f"{clean_name}.pdf" if pdf_bytes else f"{clean_name}.docx"
        storage_path = pdf_storage_path or docx_storage_path or f"{project_id}/reports/{doc_id}/{file_name}"
        paper_pk = f"{project_id}_report_{doc_id}"
        paper_id = f"report-{doc_id}"
        pdf_url = f"/api/projects/{project_id}/documents/{doc_id}/download?format=pdf" if pdf_bytes else f"/api/projects/{project_id}/documents/{doc_id}/download?format=docx"
        entry_url = pdf_url

        formats_list = []
        if pdf_bytes:
            formats_list.append("PDF")
        if docx_bytes:
            formats_list.append("DOCX")

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO project_papers (
                        id, project_id, paper_id, title, authors, venue, year, published,
                        summary, pdf_url, entry_url, primary_category, file_name, file_size,
                        file_size_label, tags, storage_bucket, storage_path, analysis_status, insights
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s::jsonb, %s, %s, %s, %s::jsonb
                    )
                    ON CONFLICT (project_id, paper_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        file_size = EXCLUDED.file_size,
                        file_size_label = EXCLUDED.file_size_label,
                        storage_path = EXCLUDED.storage_path;
                    """,
                    (
                        paper_pk,
                        project_id,
                        paper_id,
                        title,
                        "SupervisorX AI Engine",
                        "SupervisorX Research Report",
                        datetime.now().year,
                        datetime.now().strftime("%Y-%m-%d"),
                        scope_desc or "Synthesized research report generated via SupervisorX AI.",
                        pdf_url,
                        entry_url,
                        "Generated Report",
                        file_name,
                        size_bytes,
                        size_label,
                        json.dumps(["Generated Report"] + formats_list),
                        settings.SUPABASE_STORAGE_BUCKET,
                        storage_path,
                        "report",
                        json.dumps({
                            "document_id": doc_id,
                            "formats": formats_list,
                            "is_generated_report": True,
                        }),
                    ),
                )
                conn.commit()
        logger.info(f"Registered generated report '{paper_id}' in project_papers for project '{project_id}'")
    except Exception as e:
        logger.error(f"Error registering report in project_papers: {e}", exc_info=True)


def store_document_files(
    project_id: str,
    doc_id: str,
    clean_title: str = "research_report",
    pdf_bytes: Optional[bytes] = None,
    docx_bytes: Optional[bytes] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Stores generated PDF and/or DOCX bytes directly to Supabase Storage.
    Returns (pdf_storage_path, docx_storage_path).
    """
    pdf_storage_path: Optional[str] = None
    docx_storage_path: Optional[str] = None
    bucket = settings.SUPABASE_STORAGE_BUCKET

    if pdf_bytes:
        pdf_storage_path = f"{project_id}/reports/{doc_id}/{clean_title}.pdf"
        canonical_path = f"{project_id}/reports/{doc_id}/{doc_id}.pdf"
        upload_file_to_supabase(bucket, pdf_storage_path, pdf_bytes, "application/pdf")
        if canonical_path != pdf_storage_path:
            upload_file_to_supabase(bucket, canonical_path, pdf_bytes, "application/pdf")

    if docx_bytes:
        docx_storage_path = f"{project_id}/reports/{doc_id}/{clean_title}.docx"
        canonical_path = f"{project_id}/reports/{doc_id}/{doc_id}.docx"
        ctype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        upload_file_to_supabase(bucket, docx_storage_path, docx_bytes, ctype)
        if canonical_path != docx_storage_path:
            upload_file_to_supabase(bucket, canonical_path, docx_bytes, ctype)

    return pdf_storage_path, docx_storage_path


def get_document_bytes(project_id: str, doc_id: str, format_type: str = "pdf") -> Optional[Tuple[bytes, str]]:
    """
    Retrieves document bytes and suggested filename directly from Supabase Storage.
    Returns (file_bytes, filename) or None.
    """
    ext = ".docx" if format_type.lower() == "docx" else ".pdf"
    bucket = settings.SUPABASE_STORAGE_BUCKET

    # 1. Check PostgreSQL project_papers for the exact storage_path recorded during generation
    try:
        from services.paper_analysis_pipeline import get_db_connection
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT title, storage_path, storage_bucket
                    FROM project_papers
                    WHERE project_id = %s AND (paper_id = %s OR id = %s)
                    LIMIT 1
                    """,
                    (project_id, f"report-{doc_id}", f"{project_id}_report_{doc_id}"),
                )
                row = cur.fetchone()
                if row:
                    title, stored_path, stored_bucket = row
                    target_bucket = stored_bucket or bucket
                    if stored_path:
                        if ext == ".docx" and stored_path.endswith(".pdf"):
                            candidate = stored_path[:-4] + ".docx"
                        elif ext == ".pdf" and stored_path.endswith(".docx"):
                            candidate = stored_path[:-5] + ".pdf"
                        else:
                            candidate = stored_path
                        data = download_file_from_supabase(target_bucket, candidate)
                        if data:
                            clean_t = _sanitize_filename(title or doc_id)
                            filename = f"SupervisorX_{clean_t}{ext}"
                            return data, filename
    except Exception as e:
        logger.warning(f"Could not query project_papers for report path: {e}")

    # 2. Check canonical and common candidate paths in Supabase Storage
    candidates = [
        f"{project_id}/reports/{doc_id}/{doc_id}{ext}",
        f"{project_id}/reports/{doc_id}/SupervisorX_{doc_id}{ext}",
    ]
    for candidate in candidates:
        data = download_file_from_supabase(bucket, candidate)
        if data:
            filename = f"SupervisorX_{doc_id}{ext}"
            return data, filename

    # 3. Dynamic listing search under prefix in Supabase Storage
    try:
        supabase_url = settings.SUPABASE_URL.rstrip("/")
        secret_key = settings.SUPABASE_SECRET_KEY
        if supabase_url and secret_key:
            headers = {"apikey": secret_key, "Authorization": f"Bearer {secret_key}"}
            prefix = f"{project_id}/reports/{doc_id}"
            res = requests.post(
                f"{supabase_url}/storage/v1/object/list/{bucket}",
                headers=headers,
                json={"prefix": prefix, "limit": 20},
                timeout=15,
            )
            if res.status_code == 200:
                for item in res.json():
                    name = item.get("name", "")
                    if name.lower().endswith(ext):
                        full_path = f"{prefix}/{name}"
                        data = download_file_from_supabase(bucket, full_path)
                        if data:
                            clean_f = name if name.startswith("SupervisorX_") else f"SupervisorX_{name}"
                            return data, clean_f
    except Exception as e:
        logger.warning(f"Error querying Supabase storage list for {doc_id}: {e}")

    # 4. Fallback check for local file in BASE_DOCS_DIR
    project_dir = os.path.join(BASE_DOCS_DIR, _sanitize_filename(project_id))
    local_path = os.path.join(project_dir, f"{doc_id}{ext}")
    if os.path.isfile(local_path):
        with open(local_path, "rb") as f:
            data = f.read()
        return data, f"SupervisorX_{doc_id}{ext}"

    return None


def get_document_file_path(project_id: str, doc_id: str, format_type: str = "pdf") -> Optional[str]:
    """Retrieves the file path of a previously generated document."""
    ext = ".docx" if format_type.lower() == "docx" else ".pdf"
    project_dir = os.path.join(BASE_DOCS_DIR, _sanitize_filename(project_id))
    file_path = os.path.join(project_dir, f"{doc_id}{ext}")

    if os.path.isfile(file_path):
        return file_path

    res = get_document_bytes(project_id, doc_id, format_type)
    if res:
        data, _ = res
        os.makedirs(project_dir, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(data)
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

    clean_title = _sanitize_filename(title)
    pdf_storage_path, docx_storage_path = store_document_files(
        project_id=project_id,
        doc_id=doc_id,
        clean_title=clean_title,
        pdf_bytes=pdf_bytes,
        docx_bytes=docx_bytes,
    )

    # Register the generated report in project_papers so it appears in the Project Paper Library
    register_report_in_project_papers(
        project_id=project_id,
        doc_id=doc_id,
        title=title,
        scope_desc=scope_description or "",
        pdf_bytes=pdf_bytes,
        docx_bytes=docx_bytes,
        pdf_storage_path=pdf_storage_path,
        docx_storage_path=docx_storage_path,
    )
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
