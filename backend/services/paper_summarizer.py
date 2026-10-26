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

SUMMARY_POINT_LABELS = [
    "Core Problem & Objective",
    "Methodology & Architecture",
    "Experimental Setup & Datasets",
    "Key Findings & Reported Metrics",
    "Limitations & Open Questions",
]


def _normalize_outline_text(value: str) -> str:
    value = re.sub(r"^\s*#{1,6}\s*", "", value)
    value = re.sub(r"^\s*\d+[.)]\s*", "", value)
    value = re.sub(r"^\s*paper\s+\d+[.:)]?\s*", "", value, flags=re.IGNORECASE)
    value = value.strip().strip("*_` ")
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _number_summary_outline(answer: str, papers: List[Dict[str, Any]]) -> str:
    """Give each paper a global number and restart the five summary point numbers per paper."""
    title_lookup = {
        _normalize_outline_text(str(paper.get("title") or "")): (index, str(paper.get("title") or ""))
        for index, paper in enumerate(papers, start=1)
        if paper.get("title")
    }
    if not title_lookup:
        return answer

    lines = answer.splitlines()
    output: List[str] = []
    current_paper_index = 0
    paper_number = 0
    current_has_point_one = False
    seen_papers = set()

    for raw_line in lines:
        line = raw_line.strip()
        normalized_line = _normalize_outline_text(line)
        paper_match = title_lookup.get(normalized_line)
        if paper_match:
            title = paper_match[1]
            if normalized_line not in seen_papers:
                seen_papers.add(normalized_line)
                paper_number += 1
            current_paper_index = paper_number
            current_has_point_one = False
            if output and output[-1].strip() in {"---", "***", "___"}:
                output.pop()
            output.extend(["", f"## Paper {current_paper_index}. {title}", ""])
            continue

        # Convert each standard section label, whether inline or already written as a heading,
        # into a numbered subheading that starts at one for every paper.
        cleaned = re.sub(r"^\s*#{1,6}\s*", "", line)
        cleaned = re.sub(r"^\s*[-*]\s+", "", cleaned)
        cleaned = cleaned.strip().strip("*_` ")
        cleaned = re.sub(r"^\s*\d+[.)]\s*", "", cleaned)
        colon_index = cleaned.find(":")
        label_text = cleaned[:colon_index] if colon_index >= 0 else cleaned
        normalized_label = _normalize_outline_text(label_text)
        point_number = next(
            (index for index, label in enumerate(SUMMARY_POINT_LABELS, start=1)
             if _normalize_outline_text(label) == normalized_label),
            None,
        )
        if point_number == 1 and (not current_paper_index or current_has_point_one):
            if paper_number < len(papers):
                paper_number += 1
                current_paper_index = paper_number
                paper_title = str(papers[paper_number - 1].get("title") or f"Analyzed Paper {paper_number}")
                output.extend(["", f"## Paper {current_paper_index}. {paper_title}", ""])
                current_has_point_one = False

        if current_paper_index and point_number:
            value = cleaned[colon_index + 1:].strip() if colon_index >= 0 else ""
            output.extend([f"### {point_number}. {SUMMARY_POINT_LABELS[point_number - 1]}"])
            if value:
                output.append(value)
            if point_number == 1:
                current_has_point_one = True
            continue

        if line in {"---", "***", "___"}:
            continue
        output.append(raw_line)

    return "\n".join(output).strip()


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
    all_papers_request = bool(
        re.search(
            r"\b(?:all|every|each)(?:\s+of)?\s+(?:(?:the|analyzed|eligible|downloaded|available|indexed|remaining)\s+){0,4}(?:papers?|studies|articles)\b|"
            r"\b(?:every|each)\s+(?:(?:analyzed|eligible|downloaded|available|indexed)\s+)?paper\b|"
            r"\ball\s+(?:(?:the|analyzed|eligible|downloaded|available|indexed)\s+){0,3}papers?\s+(?:that\s+are\s+)?(?:analyzed|downloaded|indexed)\b",
            lower_q,
        )
    )
    if all_papers_request:
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

    # Retrieve evidence by report section so each paper contributes objective,
    # method, experiment, result, and limitation evidence instead of only generic matches.
    evidence_queries = [
        "research paper problem motivation research question objective and contribution",
        "research paper methodology model architecture algorithm design and implementation",
        "research paper experimental setup datasets benchmarks sample sizes and evaluation metrics",
        "research paper results findings quantitative metrics comparisons and conclusions",
        "research paper limitations assumptions threats to validity future work and open questions",
    ]
    retrieval_queries = evidence_queries + [focus_query]
    evidence_query_vectors = None
    try:
        evidence_query_vectors = generate_embeddings_batch(retrieval_queries, api_key=api_key)
    except Exception as e:
        logger.info(f"Section query vectors skipped or offline: {e}")
        evidence_query_vectors = None

    all_evidence = []
    citation_catalog: List[CitationItem] = []
    paper_evidence_map: Dict[str, List[Dict[str, Any]]] = {}
    citation_counter = 1

    chunk_limit_per_paper = 6 if len(target_papers) > 2 else 10

    for p in target_papers:
        pid = p["paper_id"]
        p_evidence = []
        if evidence_query_vectors and len(evidence_query_vectors) == len(retrieval_queries):
            seen_evidence_ids = set()
            for evidence_query, query_vector in zip(evidence_queries, evidence_query_vectors[:-1]):
                matches = retrieve_relevant_evidence(
                    project_id=project_id,
                    query_text=evidence_query,
                    target_paper_ids=[pid],
                    limit=2 if len(target_papers) <= 2 else 1,
                    api_key=api_key,
                    query_vector=query_vector,
                )
                for match in matches:
                    evidence_id = match.get("id") or (
                        match.get("paper_id"), match.get("page_start"), match.get("page_end"),
                        match.get("section_title"), match.get("content_text"),
                    )
                    if evidence_id not in seen_evidence_ids:
                        seen_evidence_ids.add(evidence_id)
                        p_evidence.append(match)
            if len(p_evidence) < chunk_limit_per_paper:
                general_matches = retrieve_relevant_evidence(
                    project_id=project_id,
                    query_text=focus_query,
                    target_paper_ids=[pid],
                    limit=chunk_limit_per_paper,
                    api_key=api_key,
                    query_vector=evidence_query_vectors[-1],
                )
                for match in general_matches:
                    evidence_id = match.get("id") or (
                        match.get("paper_id"), match.get("page_start"), match.get("page_end"),
                        match.get("section_title"), match.get("content_text"),
                    )
                    if evidence_id not in seen_evidence_ids:
                        seen_evidence_ids.add(evidence_id)
                        p_evidence.append(match)
                    if len(p_evidence) >= chunk_limit_per_paper:
                        break
        else:
            p_evidence = retrieve_relevant_evidence(
                project_id=project_id,
                query_text=focus_query,
                target_paper_ids=[pid],
                limit=chunk_limit_per_paper,
                api_key=api_key,
            )
        paper_evidence_map[pid] = p_evidence

        for ev in p_evidence[:chunk_limit_per_paper]:
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
        "- Give every requested paper its own numbered heading using its exact title from PAPERS TO SUMMARIZE. The number of paper headings must equal the number of listed papers.\n"
        "- When the user asks for all analyzed papers, include every paper listed in PAPERS TO SUMMARIZE, once each; never silently summarize only a subset.\n"
        "- For comparable numeric results, use a compact Markdown table with clear metric names and one row per model/system instead of a long list of repeated metric bullets. Explain briefly what the values mean and do not claim statistical significance unless the evidence says so.\n"
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
            max_tokens=max(3500, min(8000, 1300 * len(target_papers))),
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

    answer_text = _number_summary_outline(answer_text, target_papers)

    referenced_indices = {
        int(number)
        for match in re.finditer(r"\[(\d+(?:\s*,\s*\d+)*)\]", answer_text)
        for number in re.findall(r"\d+", match.group(1))
    }
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

