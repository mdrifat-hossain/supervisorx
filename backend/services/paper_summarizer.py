import os
import re
import logging
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from config import settings
from services.chatbot_llm import build_chatbot_llm
from services.rag_service import (
    get_eligible_analyzed_papers,
    retrieve_relevant_evidence,
    CitationItem,
)
from services.paper_comparator import resolve_target_papers
from services.embedding_service import generate_embeddings_batch

logger = logging.getLogger("paper_summarizer")


class SummaryResult(BaseModel):
    success: bool
    answer: str
    citations: List[CitationItem] = Field(default_factory=list)
    summarized_papers: List[str] = Field(default_factory=list)
    has_sufficient_evidence: bool = True
    notice: Optional[str] = None


def summarize_analyzed_papers(
    project_id: str,
    query: str,
    target_paper_mentions: Optional[List[str]] = None,
    summary_focus: Optional[str] = None,
    api_key: Optional[str] = None
) -> SummaryResult:
    """
    Generates a structured, evidence-grounded textual summary of one or more analyzed papers:
    1. Checks eligible analyzed papers.
    2. Resolves target paper(s).
    3. Retrieves sections covering objective, methodology, results, and limitations.
    4. Synthesizes structured markdown summary with inline citations [1], [2].
    """
    eligible_papers = get_eligible_analyzed_papers(project_id)
    if not eligible_papers:
        return SummaryResult(
            success=True,
            answer=(
                "**No Analyzed Papers Available for Summarization**\n\n"
                "I cannot summarize papers without verified extracted sections. "
                "Currently, there are no analyzed papers available in this project.\n\n"
                "Please navigate to **Upload & Analysis** to analyze your downloaded papers first."
            ),
            has_sufficient_evidence=False,
            notice="No eligible analyzed papers"
        )

    lower_q = query.lower()
    if re.search(r"\b(?:all|every|each)\s+(?:the\s+)?papers?\b", lower_q):
        target_papers = eligible_papers
    else:
        mentions = list(target_paper_mentions or []) + [query]
        target_papers = resolve_target_papers(eligible_papers, mentions)
        explicit_scope = bool(target_paper_mentions) or bool(
            re.search(r"(?:from|in|about|regarding)\s+(?:this\s+)?[\"'“”].{4,}[\"'“”]", query, re.IGNORECASE)
        )
        if not target_papers and explicit_scope:
            return SummaryResult(
                success=True,
                answer="I couldn’t match the paper you named to an analyzed paper in this project. Please check the title or choose one of the analyzed papers.",
                has_sufficient_evidence=False,
                notice="Requested paper could not be resolved",
            )
        if not target_papers and eligible_papers:
            target_papers = [eligible_papers[0]]

    if not settings.GEMINI_API_KEY.strip():
        return SummaryResult(
            success=False,
            answer="Gemini summary generation is not configured. Set GEMINI_API_KEY in the backend environment and restart the backend.",
            has_sufficient_evidence=False,
            notice="Gemini API key is missing",
        )

    focus_query = query
    if summary_focus:
        focus_query = f"{summary_focus} {query}"

    # Generate query embedding once for all papers (if embeddings service is available)
    query_vector = None
    try:
        q_embs = generate_embeddings_batch([focus_query], api_key=api_key)
        if q_embs and len(q_embs) > 0 and len(q_embs[0]) > 0:
            query_vector = q_embs[0]
    except Exception as e:
        logger.info(f"Query vector generation skipped or offline: {e}")

    all_evidence = []
    citation_catalog: List[CitationItem] = []
    paper_evidence_map: Dict[str, List[Dict[str, Any]]] = {}
    citation_counter = 1

    chunk_limit_per_paper = 6 if len(target_papers) > 2 else 10

    for p in target_papers:
        pid = p["paper_id"]
        p_evidence = retrieve_relevant_evidence(
            project_id=project_id,
            query_text=focus_query,
            target_paper_ids=[pid],
            limit=chunk_limit_per_paper,
            api_key=api_key,
            query_vector=query_vector,
        )
        paper_evidence_map[pid] = p_evidence

        for ev in p_evidence[:8]:
            p_start = ev["page_start"]
            p_end = ev["page_end"]
            if p_start and p_end and p_start != p_end:
                page_label = f"PDF Pages {p_start}–{p_end}"
            elif p_start:
                page_label = f"PDF Page {p_start}"
            else:
                page_label = "PDF Document"

            is_vis = ev["source_type"] == "visual_item"
            claim_summary = ev["caption"] if (is_vis and ev.get("caption")) else ev["content_text"][:140].replace("\n", " ") + "..."

            cite_item = CitationItem(
                citation_index=citation_counter,
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
            )
            citation_catalog.append(cite_item)
            ev["_citation_index"] = citation_counter

            all_evidence.append(
                f"[Source {citation_counter}] Paper: '{ev['paper_title']}' | Section: {ev['section_title']} | {page_label}\n"
                f"{ev['content_text']}"
            )
            citation_counter += 1

    context_str = "\n\n----------------------------------------\n\n".join(all_evidence)

    system_prompt = (
        "You are SupervisorX, an expert scientific research synthesizer. "
        "Your task is to provide a comprehensive, structured textual summary of the analyzed paper(s) based strictly on "
        "the provided verified evidence.\n\n"
        "MANDATORY SUMMARY STRUCTURE (per paper):\n"
        "1. **Core Problem & Objective**: What fundamental problem does this paper address?\n"
        "2. **Methodology & Architecture**: What technical approach, algorithms, or architectures are proposed?\n"
        "3. **Experimental Setup & Datasets**: What benchmarks, sample sizes, or test configurations were used?\n"
        "4. **Key Findings & Reported Metrics**: What quantitative and qualitative results are established?\n"
        "5. **Limitations & Open Questions**: What constraints, failure modes, or unaddressed areas are noted?\n\n"
        "GROUNDING REQUIREMENTS:\n"
        "- Attach inline citations [1], [2] to every specific claim, result, and methodology detail.\n"
        "- If multiple papers are summarized, summarize each paper separately before presenting any synthesis.\n"
        "- For limitations, distinguish author-stated limitations from potential limitations inferred from the study. Never label an inference as an author statement.\n"
        "- Do not guess or invent metrics. If the supplied evidence does not establish a requested fact, say so.\n"
        "- Write complete sentences; do not truncate with ellipses.\n"
        "- Deliver a clean, professional markdown response."
    )

    user_prompt = (
        f"User Summarization Request: {query}\n\n"
        f"PAPERS TO SUMMARIZE: {', '.join([p['title'] for p in target_papers])}\n\n"
        f"VERIFIED EVIDENCE EXCERPTS:\n{context_str}"
    )

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
            max_tokens=3500,
            request_timeout=35.0,
        )
        resp = llm.invoke(messages)
        response_received = True
        answer_text = (resp.content or "").strip()
        finish_reason = (getattr(resp, "response_metadata", {}) or {}).get("finish_reason")
        if finish_reason in {"length", "max_tokens"} or re.search(r"(?:\.{3}|…)\s*$", answer_text):
            incomplete_answer = True
            raise ValueError("Gemini returned an incomplete summary")
        if not answer_text:
            raise ValueError("Gemini returned an empty summary")
    except Exception as e:
        logger.warning("Gemini summary generation failed (%s)", type(e).__name__)
        err_str = str(e).lower()
        if any(marker in err_str for marker in ("429", "rate limit", "resource_exhausted", "quota")):
            reason = "Gemini returned a quota or rate-limit error. Check your Google AI Studio quota or try again later."
            notice = "Gemini quota or rate limit"
        elif incomplete_answer or (response_received and not answer_text):
            reason = "Gemini did not return a complete summary. Please try again later."
            notice = "Gemini summary unavailable"
        else:
            reason = "Gemini summary generation failed. Check the backend configuration and try again."
            notice = "Gemini provider error"
        return SummaryResult(
            success=False,
            answer=reason,
            citations=[],
            summarized_papers=[],
            has_sufficient_evidence=False,
            notice=notice,
        )

    referenced_indices = set(int(m) for m in re.findall(r"\[(\d+)\]", answer_text))
    active_citations = [c for c in citation_catalog if c.citation_index in referenced_indices]
    if not active_citations:
        active_citations = citation_catalog[:8]

    return SummaryResult(
        success=True,
        answer=answer_text,
        citations=active_citations,
        summarized_papers=[p["title"] for p in target_papers],
        has_sufficient_evidence=True
    )

