import os
import re
import json
import logging
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from config import settings
from services.paper_analysis_pipeline import get_db_connection, generate_embeddings_batch
from services.chatbot_llm import build_chatbot_llm

logger = logging.getLogger("rag_service")


class CitationItem(BaseModel):
    citation_index: int
    paper_id: str
    paper_title: str
    authors: str
    year: Optional[int] = None
    section_title: str
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    page_label: str
    claim_supported: str
    pdf_url: Optional[str] = None
    is_visual: bool = False
    figure_number: Optional[str] = None


class QAResult(BaseModel):
    success: bool
    answer: str
    citations: List[CitationItem] = Field(default_factory=list)
    eligible_papers_count: int = 0
    papers_used: List[str] = Field(default_factory=list)
    has_sufficient_evidence: bool = True
    notice: Optional[str] = None


def get_eligible_analyzed_papers(project_id: str) -> List[Dict[str, Any]]:
    """
    Returns only papers whose analysis is completed ('analyzed') in the authoritative database.
    Pending, failed, or unanalyzed papers are strictly excluded.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT paper_id, title, authors, venue, year, published, pdf_url, storage_path, chunks_count, vectors_count
                FROM project_papers
                WHERE project_id = %s AND analysis_status = 'analyzed'
                ORDER BY analyzed_at DESC NULLS LAST
                """,
                (project_id,)
            )
            rows = cur.fetchall()
            papers = []
            for r in rows:
                papers.append({
                    "paper_id": r[0],
                    "title": r[1],
                    "authors": r[2] or "",
                    "venue": r[3] or "",
                    "year": r[4],
                    "published": r[5] or "",
                    "pdf_url": r[6] or "",
                    "storage_path": r[7] or "",
                    "chunks_count": r[8] or 0,
                    "vectors_count": r[9] or 0,
                })
            return papers


def retrieve_relevant_evidence(
    project_id: str,
    query_text: str,
    target_paper_ids: Optional[List[str]] = None,
    limit: int = 10,
    api_key: Optional[str] = None,
    query_vector: Optional[List[float]] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves top cosine-similar chunks and visual items from paper_vectors,
    or falls back intelligently to section-aware paper_text_chunks when embeddings are offline/rate-limited.
    """
    key = api_key or settings.OPENROUTER_API_KEY
    q_vec = query_vector
    lower_query = query_text.lower()
    limitations_query = bool(re.search(
        r"\b(limitations?|weakness(?:es)?|constraints?|caveats?|future\s+work|assumptions?|unaddressed)\b",
        lower_query,
    ))

    if q_vec is None:
        try:
            q_embs = generate_embeddings_batch([query_text], api_key=key)
            if q_embs and len(q_embs) > 0 and len(q_embs[0]) > 0:
                q_vec = q_embs[0]
        except Exception as e:
            logger.info(f"Embedding generation skipped/failed: {e}. Falling back to database chunk extraction.")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if q_vec and len(q_vec) > 0:
                vec_str = f"[{','.join(str(x) for x in q_vec)}]"
                vector_order_clause = "pv.embedding <=> %s::vector ASC"
                if limitations_query:
                    vector_order_clause = """
                        CASE
                            WHEN pv.section_title ILIKE '%%limit%%' OR pv.section_title ILIKE '%%caveat%%' OR pv.section_title ILIKE '%%weakness%%' THEN 0
                            WHEN pv.section_title ILIKE '%%discussion%%' OR pv.section_title ILIKE '%%conclusion%%' OR pv.section_title ILIKE '%%future%%' OR pv.section_title ILIKE '%%assumption%%' OR pv.section_title ILIKE '%%scope%%' OR pv.section_title ILIKE '%%threat%%' THEN 1
                            ELSE 2
                        END ASC,
                        pv.embedding <=> %s::vector ASC
                    """
                if target_paper_ids and len(target_paper_ids) > 0:
                    cur.execute(
                        f"""
                        SELECT pv.id, pv.paper_id, pv.source_type, pv.content_text, pv.page_start, pv.page_end,
                               pv.section_title, pv.figure_number, pv.caption,
                               pp.title as paper_title, pp.authors, pp.year, pp.pdf_url,
                               1 - (pv.embedding <=> %s::vector) as similarity
                        FROM paper_vectors pv
                        JOIN project_papers pp ON pv.paper_id = pp.paper_id AND pv.project_id = pp.project_id
                        WHERE pv.project_id = %s
                          AND pp.analysis_status = 'analyzed'
                          AND pv.paper_id = ANY(%s)
                        ORDER BY {vector_order_clause}
                        LIMIT %s
                        """,
                        (vec_str, project_id, target_paper_ids, vec_str, limit)
                    )
                else:
                    cur.execute(
                        f"""
                        SELECT pv.id, pv.paper_id, pv.source_type, pv.content_text, pv.page_start, pv.page_end,
                               pv.section_title, pv.figure_number, pv.caption,
                               pp.title as paper_title, pp.authors, pp.year, pp.pdf_url,
                               1 - (pv.embedding <=> %s::vector) as similarity
                        FROM paper_vectors pv
                        JOIN project_papers pp ON pv.paper_id = pp.paper_id AND pv.project_id = pp.project_id
                        WHERE pv.project_id = %s
                          AND pp.analysis_status = 'analyzed'
                        ORDER BY {vector_order_clause}
                        LIMIT %s
                        """,
                        (vec_str, project_id, vec_str, limit)
                    )
                rows = cur.fetchall()
            else:
                # Direct intelligent fallback from paper_text_chunks prioritized by query relevance
                lower_q = query_text.lower()
                if limitations_query:
                    order_clause = """
                        ORDER BY CASE
                            WHEN ptc.section_title ILIKE '%%limit%%' OR ptc.section_title ILIKE '%%caveat%%' OR ptc.section_title ILIKE '%%weakness%%' THEN 0
                            WHEN ptc.section_title ILIKE '%%discussion%%' OR ptc.section_title ILIKE '%%conclusion%%' OR ptc.section_title ILIKE '%%future%%' OR ptc.section_title ILIKE '%%assumption%%' OR ptc.section_title ILIKE '%%scope%%' OR ptc.section_title ILIKE '%%threat%%' THEN 1
                            ELSE 2
                        END ASC, ptc.chunk_index ASC
                    """
                else:
                    order_clause = """
                    ORDER BY 
                        (CASE 
                            WHEN ptc.section_title ILIKE '%%method%%' OR ptc.section_title ILIKE '%%approach%%' OR ptc.section_title ILIKE '%%model%%' OR ptc.section_title ILIKE '%%architect%%' OR ptc.section_title ILIKE '%%design%%' OR ptc.section_title ILIKE '%%concept%%' OR ptc.section_title ILIKE '%%theory%%' OR ptc.section_title ILIKE '%%preliminar%%' OR ptc.section_title ILIKE '%%gated%%' OR ptc.section_title ILIKE '%%sparse%%' OR ptc.section_title ILIKE '%%chaos%%' OR ptc.section_title ILIKE '%%pipeline%%' OR ptc.section_title ILIKE '%%bert%%' OR ptc.section_title ~* '^[0-9]+(\.[0-9]+)*\s+' THEN 1
                            WHEN ptc.section_title ILIKE '%%abstract%%' OR ptc.section_title ILIKE '%%intro%%' THEN 2
                            WHEN ptc.section_title ILIKE '%%eval%%' OR ptc.section_title ILIKE '%%experiment%%' OR ptc.section_title ILIKE '%%dataset%%' OR ptc.section_title ILIKE '%%result%%' THEN 3
                            ELSE 4
                        END) ASC,
                        ptc.chunk_index ASC
                    """ if any(w in lower_q for w in ["method", "approach", "architect", "model", "technique", "algorithm", "summar", "explain", "how", "what", "detail"]) else "ORDER BY ptc.chunk_index ASC"

                if target_paper_ids and len(target_paper_ids) > 0:
                    cur.execute(
                        f"""
                        SELECT ptc.id, ptc.paper_id, 'text_chunk' as source_type, ptc.text_content, ptc.page_start, ptc.page_end,
                               ptc.section_title, NULL as figure_number, NULL as caption,
                               pp.title as paper_title, pp.authors, pp.year, pp.pdf_url,
                               0.85 as similarity
                        FROM paper_text_chunks ptc
                        JOIN project_papers pp ON ptc.paper_id = pp.paper_id AND ptc.project_id = pp.project_id
                        WHERE ptc.project_id = %s
                          AND pp.analysis_status = 'analyzed'
                          AND ptc.paper_id = ANY(%s)
                        {order_clause}
                        LIMIT %s
                        """,
                        (project_id, target_paper_ids, limit)
                    )
                else:
                    cur.execute(
                        f"""
                        SELECT ptc.id, ptc.paper_id, 'text_chunk' as source_type, ptc.text_content, ptc.page_start, ptc.page_end,
                               ptc.section_title, NULL as figure_number, NULL as caption,
                               pp.title as paper_title, pp.authors, pp.year, pp.pdf_url,
                               0.85 as similarity
                        FROM paper_text_chunks ptc
                        JOIN project_papers pp ON ptc.paper_id = pp.paper_id AND ptc.project_id = pp.project_id
                        WHERE ptc.project_id = %s
                          AND pp.analysis_status = 'analyzed'
                        {order_clause}
                        LIMIT %s
                        """,
                        (project_id, limit)
                    )
                rows = cur.fetchall()
            evidence = []
            seen_texts = set()
            for r in rows:
                content = (r[3] or "").strip()
                # Deduplicate near-duplicate snippets
                preview = content[:100]
                if preview in seen_texts:
                    continue
                seen_texts.add(preview)

                evidence.append({
                    "id": r[0],
                    "paper_id": r[1],
                    "source_type": r[2],
                    "content_text": content,
                    "page_start": r[4],
                    "page_end": r[5],
                    "section_title": r[6] or "General Section",
                    "figure_number": r[7],
                    "caption": r[8],
                    "paper_title": r[9],
                    "authors": r[10] or "Unknown Authors",
                    "year": r[11],
                    "pdf_url": r[12] or f"https://arxiv.org/abs/{r[1]}",
                    "similarity": float(r[13]) if r[13] is not None else 0.0,
                })
            return evidence


def answer_research_question(
    project_id: str,
    query: str,
    recent_history: Optional[List[Dict[str, str]]] = None,
    target_paper_ids: Optional[List[str]] = None,
    api_key: Optional[str] = None
) -> QAResult:
    """
    Executes grounded Retrieval-Augmented Generation (RAG):
    1. Validates eligible analyzed papers.
    2. Retrieves top vector evidence across analyzed papers.
    3. Synthesizes a grounded answer using the configured Gemini chatbot model.
    4. Generates traceable citations mapped to verified database paper records and physical pages.
    """
    eligible_papers = get_eligible_analyzed_papers(project_id)
    if not eligible_papers:
        return QAResult(
            success=True,
            answer=(
                "**No Analyzed Papers in Library Yet**\n\n"
                "I cannot answer questions or synthesize claims without verified paper evidence. "
                "Currently, there are no analyzed papers available in this project.\n\n"
                "**Next Step:** Please navigate to **Upload & Analysis** in the left sidebar, "
                "select your downloaded PDFs, and click **Analyze** to index their full text, equations, and figures."
            ),
            eligible_papers_count=0,
            has_sufficient_evidence=False,
            notice="No eligible analyzed papers"
        )

    if not settings.GEMINI_API_KEY.strip():
        return QAResult(
            success=False,
            answer="Gemini answer generation is not configured. Set GEMINI_API_KEY in the backend environment and restart the backend.",
            eligible_papers_count=len(eligible_papers),
            has_sufficient_evidence=False,
            notice="Gemini API key is missing",
        )

    # Resolve paper mentions against canonical project records before retrieval.
    # A failed title lookup must never silently broaden a paper-specific request.
    from services.paper_comparator import resolve_target_papers

    query_mentions = list(target_paper_ids or [])
    query_mentions.append(query)
    resolved_papers = resolve_target_papers(eligible_papers, query_mentions)
    explicit_scope = bool(target_paper_ids) or bool(
        re.search(r"(?:from|in|about|regarding)\s+(?:this\s+)?[\"'“”].{4,}[\"'“”]", query, re.IGNORECASE)
    )
    if explicit_scope and not resolved_papers:
        return QAResult(
            success=True,
            answer=(
                "I couldn’t match the paper you named to an analyzed paper in this project. "
                "Please check the title or choose one of the analyzed papers."
            ),
            eligible_papers_count=len(eligible_papers),
            has_sufficient_evidence=False,
            notice="Requested paper could not be resolved",
        )
    resolved_ids = [p["paper_id"] for p in resolved_papers] if resolved_papers else None

    # Retrieve vector evidence
    evidence = retrieve_relevant_evidence(
        project_id=project_id,
        query_text=query,
        target_paper_ids=resolved_ids,
        limit=20 if re.search(r"\b(limitations?|weakness(?:es)?|constraints?|caveats?|future\s+work|assumptions?|unaddressed)\b", query, re.IGNORECASE) else 12,
        api_key=api_key
    )

    if not evidence or max((item["similarity"] for item in evidence), default=0.0) < 0.20:
        # Even with papers analyzed, if cosine similarity is extremely low, evidence is insufficient
        titles_list = "\n".join([f"- **{p['title']}** ({p['authors']}, {p['year'] or 'N/A'})" for p in eligible_papers])
        return QAResult(
            success=True,
            answer=(
                "**Insufficient Evidence in Analyzed Papers**\n\n"
                f"I reviewed the analyzed literature available in this project, but found no sufficiently relevant findings "
                f"addressing: *\"{query}\"*.\n\n"
                f"**Currently Analyzed Papers in Project ({len(eligible_papers)}):**\n{titles_list}\n\n"
                "Because I strictly ground answers on your analyzed literature rather than hallucinating general claims, "
                "I cannot establish this conclusion. You can search and download related papers to analyze them into this project."
            ),
            eligible_papers_count=len(eligible_papers),
            has_sufficient_evidence=False,
            notice="Relevant evidence not found in analyzed papers"
        )

    # Format context for LangChain ChatOpenAI
    context_blocks = []
    citation_catalog: List[CitationItem] = []

    for idx, ev in enumerate(evidence, start=1):
        p_start = ev["page_start"]
        p_end = ev["page_end"]
        if p_start and p_end and p_start != p_end:
            page_label = f"PDF Pages {p_start}–{p_end}"
        elif p_start:
            page_label = f"PDF Page {p_start}"
        else:
            page_label = "PDF Document"

        is_vis = ev["source_type"] == "visual_item"
        visual_tag = f" [Figure/Visual: {ev['figure_number']}]" if is_vis and ev.get("figure_number") else ""

        claim_summary = ev["caption"] if (is_vis and ev.get("caption")) else ev["content_text"][:140].replace("\n", " ") + "..."

        citation_catalog.append(CitationItem(
            citation_index=idx,
            paper_id=ev["paper_id"],
            paper_title=ev["paper_title"],
            authors=ev["authors"],
            year=ev["year"],
            section_title=ev["section_title"],
            page_start=p_start,
            page_end=p_end,
            page_label=page_label,
            claim_supported=claim_summary,
            pdf_url=ev["pdf_url"],
            is_visual=is_vis,
            figure_number=ev.get("figure_number"),
        ))

        source_header = f"[Source {idx}] Paper: '{ev['paper_title']}' | Section: {ev['section_title']} | {page_label}{visual_tag}"
        context_blocks.append(f"{source_header}\nContent:\n{ev['content_text']}")

    context_str = "\n\n----------------------------------------\n\n".join(context_blocks)
    limitations_question = bool(re.search(
        r"\b(limitations?|weakness(?:es)?|constraints?|caveats?|future\s+work|assumptions?|unaddressed)\b",
        query,
        re.IGNORECASE,
    ))
    limitation_coverage = ""
    if limitations_question:
        relevant_sections = sorted({
            ev["section_title"] for ev in evidence
            if re.search(r"limit|caveat|weakness|discussion|conclusion|future|assumption|scope|threat", ev["section_title"], re.IGNORECASE)
        })
        retrieved_sections = ", ".join(relevant_sections) if relevant_sections else "none of the limitation-related sections"
        limitation_coverage = (
            f"\n\nLIMITATIONS EVIDENCE COVERAGE: Retrieved limitation-related sections: {retrieved_sections}. "
            "These are selected excerpts, not a verified exhaustive search of the full paper. Do not claim that the authors state no limitations anywhere in the paper. "
            "If the excerpts do not show an explicit limitation, say only that none was found in the retrieved evidence, then clearly separate any evidence-grounded potential limitations inferred from the study."
        )

    system_prompt = (
        "You are SupervisorX, an expert evidence-grounded scientific research assistant. "
        "Your task is to answer the user's research question strictly using the provided verified source evidence.\n\n"
        "MANDATORY EVIDENCE GROUNDING RULES:\n"
        "1. GROUNDING: Answer ONLY using the facts, figures, methods, and findings explicitly reported in the provided sources. "
        "DO NOT extrapolate or hallucinate scientific claims, numbers, or conclusions.\n"
        "2. INLINE CITATIONS: For every claim, statistic, or methodological detail you present, attach an inline citation bracket "
        "referencing the source number, for example: 'Dynamic gating masks achieve sub-quadratic complexity [1].'\n"
        "3. MULTI-PAPER SYNTHESIS: If evidence comes from multiple papers, synthesize them clearly, distinguishing which paper "
        "reported which finding or limitation.\n"
        "4. VISUAL CITATIONS: If citing a figure or visual description, explicitly mention that it derives from the paper's visual analysis.\n"
        "5. INSUFFICIENT EVIDENCE: If the sources only partially answer the question, answer what is supported and state explicitly "
        "what could not be established from the available analyzed papers.\n"
        "6. PAPER SCOPE: When the question names a paper, answer only about that paper. Do not introduce other papers.\n"
        "7. LIMITATIONS: For limitations questions, first list only limitations explicitly stated in the paper with citations. "
        "Do not claim that the full paper contains no author-stated limitations unless the full text was searched. If the supplied excerpts contain none, state only that no explicit limitations were found in the retrieved evidence. "
        "Only then, if useful, add a separate section titled 'Potential limitations inferred from the study'; label each as your analysis and ground it in the paper's assumptions, scope, or methods.\n"
        "8. COMPLETENESS: Write complete sentences and finish each thought. Never use ellipses to truncate an answer. If evidence is incomplete, state that clearly.\n"
        "9. STRUCTURE: Use clear markdown with concise academic language and a list when requested.\n"
        "10. DO NOT generate a separate references list at the end; the frontend creates the references drawer from citation metadata."
    )

    user_prompt = f"User Question: {query}{limitation_coverage}\n\nVERIFIED RESEARCH EVIDENCE FROM ANALYZED PAPERS:\n\n{context_str}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    answer_text = ""
    incomplete_answer = False
    response_received = False
    try:
        llm = build_chatbot_llm(
            model_name=settings.CHATBOT_MODEL,
            temperature=0.15,
            max_tokens=2500,
            request_timeout=35.0,
        )
        resp = llm.invoke(messages)
        response_received = True
        answer_text = (resp.content or "").strip()
        finish_reason = (getattr(resp, "response_metadata", {}) or {}).get("finish_reason")
        if finish_reason in {"length", "max_tokens"} or re.search(r"(?:\.{3}|…)\s*$", answer_text):
            incomplete_answer = True
            raise ValueError("Gemini returned an incomplete answer")
        if not answer_text:
            raise ValueError("Gemini returned an empty answer")
    except Exception as e:
        logger.warning("Gemini Q&A generation failed (%s)", type(e).__name__)
        err_str = str(e).lower()
        if any(marker in err_str for marker in ("429", "rate limit", "resource_exhausted", "quota")):
            message = "Gemini returned a quota or rate-limit error. Check your Google AI Studio quota or try again later."
            notice = "Gemini quota or rate limit"
        elif incomplete_answer or (response_received and not answer_text):
            message = "Gemini did not return a complete answer. Please try again later."
            notice = "Gemini answer unavailable"
        else:
            message = "Gemini answer generation failed. Check the backend configuration and try again."
            notice = "Gemini provider error"
        return QAResult(
            success=False,
            answer=message,
            citations=[],
            eligible_papers_count=len(eligible_papers),
            papers_used=[],
            has_sufficient_evidence=False,
            notice=notice,
        )

    # Filter citation_catalog to only those citation indices actually referenced in the answer text,
    # or keep top relevant if none were formatted with brackets
    referenced_indices = set(int(m) for m in re.findall(r"\[(\d+)\]", answer_text))
    active_citations = [c for c in citation_catalog if c.citation_index in referenced_indices]
    if not active_citations:
        active_citations = citation_catalog[:4]

    unique_papers_used = list(dict.fromkeys([c.paper_title for c in active_citations]))

    return QAResult(
        success=True,
        answer=answer_text,
        citations=active_citations,
        eligible_papers_count=len(eligible_papers),
        papers_used=unique_papers_used,
        has_sufficient_evidence=True
    )
