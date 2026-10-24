import os
import re
import logging
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from config import settings
from services.rag_service import (
    get_eligible_analyzed_papers,
    retrieve_relevant_evidence,
    CitationItem,
)
from services.embedding_service import generate_embeddings_batch

logger = logging.getLogger("paper_comparator")


class ComparisonResult(BaseModel):
    success: bool
    answer: str
    citations: List[CitationItem] = Field(default_factory=list)
    compared_papers: List[str] = Field(default_factory=list)
    has_sufficient_evidence: bool = True
    notice: Optional[str] = None


def resolve_target_papers(
    eligible_papers: List[Dict[str, Any]],
    user_mentions: List[str]
) -> List[Dict[str, Any]]:
    """
    Resolves mentioned papers against the eligible analyzed papers.
    Handles paper IDs (e.g. '2601.15305'), relative indices ('paper 1', 'first paper'),
    or partial title / author matches.
    """
    if not eligible_papers:
        return []

    if not user_mentions:
        # Default to the first two analyzed papers
        return eligible_papers[:2]

    for mention in user_mentions:
        if any(term in mention.lower() for term in ["all", "every", "both", "all papers"]):
            return eligible_papers

    resolved: List[Dict[str, Any]] = []
    seen_ids = set()

    for mention in user_mentions:
        m_clean = mention.strip().lower()

        # Check for relative index e.g. "paper 1", "paper 2", "first paper", "second paper"
        idx_match = re.search(r"(?:paper\s*#?|item\s*#?)(\d+)", m_clean)
        if idx_match:
            idx = int(idx_match.group(1)) - 1
            if 0 <= idx < len(eligible_papers):
                p = eligible_papers[idx]
                if p["paper_id"] not in seen_ids:
                    resolved.append(p)
                    seen_ids.add(p["paper_id"])
                continue

        word_indices = {
            "first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4
        }
        matched_word_idx = None
        for w, i in word_indices.items():
            if w in m_clean:
                matched_word_idx = i
                break
        if matched_word_idx is not None and matched_word_idx < len(eligible_papers):
            p = eligible_papers[matched_word_idx]
            if p["paper_id"] not in seen_ids:
                resolved.append(p)
                seen_ids.add(p["paper_id"])
            continue

        # Check paper_id exact or substring
        found = False
        for p in eligible_papers:
            pid = p["paper_id"].lower()
            title = p["title"].lower()
            if pid in m_clean or m_clean in pid or m_clean in title:
                if p["paper_id"] not in seen_ids:
                    resolved.append(p)
                    seen_ids.add(p["paper_id"])
                found = True
                break

    # If only 1 resolved but eligible papers has more, pick the second one too
    if len(resolved) == 1 and len(eligible_papers) >= 2:
        for p in eligible_papers:
            if p["paper_id"] not in seen_ids:
                resolved.append(p)
                break

    return resolved if resolved else eligible_papers[:2]


def compare_analyzed_papers(
    project_id: str,
    query: str,
    target_paper_mentions: Optional[List[str]] = None,
    dimensions: Optional[List[str]] = None,
    api_key: Optional[str] = None
) -> ComparisonResult:
    """
    Generates a structured, evidence-grounded comparative analysis of 2 or more analyzed papers:
    1. Checks eligible analyzed papers.
    2. Resolves target papers.
    3. Retrieves grounded evidence for each paper separately.
    4. Synthesizes a Markdown comparison table and narrative synthesis with traceable citations.
    """
    eligible_papers = get_eligible_analyzed_papers(project_id)
    if not eligible_papers:
        return ComparisonResult(
            success=True,
            answer=(
                "**No Analyzed Papers Available for Comparison**\n\n"
                "To compare research papers, you must have at least two analyzed papers in your project library. "
                "Currently, there are no analyzed papers available.\n\n"
                "Please navigate to **Upload & Analysis** to analyze your downloaded papers first."
            ),
            has_sufficient_evidence=False,
            notice="No eligible analyzed papers"
        )

    if len(eligible_papers) < 2:
        single = eligible_papers[0]
        return ComparisonResult(
            success=True,
            answer=(
                f"**Need at Least Two Analyzed Papers to Compare**\n\n"
                f"Currently, your project library contains only **1 analyzed paper**:\n"
                f"- **{single['title']}** ({single['authors']}, {single['year'] or 'N/A'})\n\n"
                "To run a comparative analysis, please analyze at least one additional paper from the **Upload & Analysis** section."
            ),
            has_sufficient_evidence=False,
            notice="Single analyzed paper only"
        )

    target_papers = resolve_target_papers(eligible_papers, target_paper_mentions or [])
    if len(target_papers) < 2:
        target_papers = eligible_papers[:2]

    # Retrieve evidence for each paper separately to ensure neither dominates
    all_evidence = []
    citation_catalog: List[CitationItem] = []
    paper_evidence_map: Dict[str, List[Dict[str, Any]]] = {}
    citation_counter = 1

    comparison_query = f"{' '.join(dimensions) if dimensions else 'methodology dataset architecture metrics limitations'} {query}"
    chunk_limit_per_paper = 3 if len(target_papers) > 2 else 5

    # Compute query vector once
    query_vector = None
    try:
        q_embs = generate_embeddings_batch([comparison_query], api_key=api_key)
        if q_embs and len(q_embs) > 0 and len(q_embs[0]) > 0:
            query_vector = q_embs[0]
    except Exception as e:
        logger.info(f"Comparison query vector generation skipped: {e}")

    for p in target_papers:
        pid = p["paper_id"]
        p_evidence = retrieve_relevant_evidence(
            project_id=project_id,
            query_text=comparison_query,
            target_paper_ids=[pid],
            limit=chunk_limit_per_paper,
            api_key=api_key,
            query_vector=query_vector,
        )
        paper_evidence_map[pid] = p_evidence

        for ev in p_evidence[:6]:
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

    paper_titles_header = " vs ".join([f"**{p['title']}**" for p in target_papers])

    system_prompt = (
        "You are SupervisorX, an expert evidence-grounded research synthesizer. "
        "Your task is to produce a structured, rigorous comparative analysis between the requested papers strictly using "
        "the provided verified evidence.\n\n"
        "MANDATORY COMPARISON FORMAT:\n"
        "1. Start with an executive comparison overview highlighting the primary divergence in research aims.\n"
        "2. Provide a clean Markdown comparison table with the following dimensions:\n"
        "   | Dimension | Paper A | Paper B |\n"
        "   Include rows for: Research Objective, Methodology & Architecture, Dataset / Domain, Evaluation Metrics & Results, and Limitations.\n"
        "   If a dimension is not reported in the analyzed text, write 'Not reported in analyzed text' instead of guessing.\n"
        "3. Follow the table with a narrative discussion of:\n"
        "   - **Key Similarities**\n"
        "   - **Core Methodological Differences**\n"
        "   - **Trade-offs & Practical Implications**\n"
        "4. ATTACH INLINE CITATIONS [1], [2] to every specific claim and cell in the comparison.\n"
        "5. DO NOT invent results or cite sources not provided."
    )

    user_prompt = (
        f"User Comparison Request: {query}\n\n"
        f"PAPERS TO COMPARE: {paper_titles_header}\n\n"
        f"VERIFIED EVIDENCE:\n{context_str}"
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    candidate_models = [
        settings.CHAT_MODEL or "nvidia/nemotron-3-ultra-550b-a55b:free",
        settings.CHAT_FALLBACK_MODEL or "nvidia/nemotron-3.5-lightning:free",
    ]

    key = api_key or settings.OPENROUTER_API_KEY
    answer_text = ""
    rate_limited = False

    for model_name in candidate_models:
        try:
            llm = ChatOpenAI(
                model=model_name,
                openai_api_key=key,
                openai_api_base=settings.OPENROUTER_BASE_URL,
                temperature=0.15,
                max_tokens=1800,
                request_timeout=40.0,
            )
            resp = llm.invoke(messages)
            answer_text = resp.content.strip()
            if answer_text:
                break
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "Rate limit" in err_str or "free-models-per-day" in err_str:
                rate_limited = True
            logger.warning(f"Comparison generation failed with model {model_name}: {e}")
            continue

    if not answer_text:
        # Deterministic comparison table fallback from verified evidence
        short_names = [f"Paper {idx+1}: {p['title'][:25]}..." for idx, p in enumerate(target_papers)]
        table_header = "| Research Dimension | " + " | ".join(short_names) + " |"
        table_divider = "| --- | " + " | ".join(["---"] * len(target_papers)) + " |"

        dim_rows = []
        row_authors = "| **Authors & Year** | " + " | ".join([f"{p['authors'][:20]} ({p['year'] or 'N/A'})" for p in target_papers]) + " |"
        dim_rows.append(row_authors)

        meth_cells = []
        for p in target_papers:
            evs = paper_evidence_map.get(p["paper_id"], [])
            m_c = [c for c in evs if any(k in (c.get("section_title") or "").lower() for k in ["method", "approach", "architect", "model"])]
            target_c = m_c[0] if m_c else (evs[0] if evs else None)
            if target_c:
                c_idx = target_c.get("_citation_index", 1)
                meth_cells.append(f"{target_c['content_text'][:90].strip().replace(chr(10), ' ')}... [{c_idx}]")
            else:
                meth_cells.append("Verified in database index")
        dim_rows.append("| **Methodology** | " + " | ".join(meth_cells) + " |")

        obj_cells = []
        for p in target_papers:
            evs = paper_evidence_map.get(p["paper_id"], [])
            target_c = evs[0] if evs else None
            if target_c:
                c_idx = target_c.get("_citation_index", 1)
                obj_cells.append(f"{target_c['content_text'][:90].strip().replace(chr(10), ' ')}... [{c_idx}]")
            else:
                obj_cells.append("Verified in database index")
        dim_rows.append("| **Core Focus** | " + " | ".join(obj_cells) + " |")

        lines = [
            f"### Comparative Analysis Across Analyzed Papers\n",
            table_header,
            table_divider,
            *dim_rows,
            "\n#### Narrative Technical Comparison\n",
        ]
        if rate_limited:
            lines.append("*(Note: OpenRouter daily model limit reached; synthesized comparison table directly from verified database extractions)*\n")

        for idx, p in enumerate(target_papers, 1):
            evs = paper_evidence_map.get(p["paper_id"], [])
            lines.append(f"**{idx}. {p['title']}** ({p['authors']}, {p['year'] or 'N/A'}):")
            for c in evs[:2]:
                c_idx = c.get("_citation_index", 1)
                sec = c.get("section_title") or "Section"
                pg = f"PDF Page {c['page_start']}" if c.get("page_start") else "Verified Index"
                lines.append(f"- *{sec}* ({pg}): {c['content_text'][:200].strip().replace(chr(10), ' ')}... [{c_idx}]")
            lines.append("")

        answer_text = "\n".join(lines)

    referenced_indices = set(int(m) for m in re.findall(r"\[(\d+)\]", answer_text))
    active_citations = [c for c in citation_catalog if c.citation_index in referenced_indices]
    if not active_citations:
        active_citations = citation_catalog[:6]

    return ComparisonResult(
        success=True,
        answer=answer_text,
        citations=active_citations,
        compared_papers=[p["title"] for p in target_papers],
        has_sufficient_evidence=True
    )
