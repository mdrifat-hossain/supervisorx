"""
Paper Screener Service for ResearchPilot / SupervisorX
Evaluates candidate academic papers against a user's research objective
using OpenRouter LLMs with strict JSON validation and robust fallbacks.
"""

import json
import logging
import re
from typing import List, Dict, Optional, Any
import requests

from config import settings

logger = logging.getLogger("paper_screener")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Maximum 3 fallback models as required by OpenRouter API
SCREENER_MODELS = [
    "minimax/minimax-m3.1-flash:free",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-lightning:free",
]

SCREENER_SYSTEM_PROMPT = """You are a rigorous academic literature reviewer for an AI research assistant called SupervisorX.
Evaluate each candidate research paper against the user's research objective, not merely against superficial keyword overlap.

A paper is relevant ONLY when its described research question, methodology, findings, or contribution materially supports the user's stated objective.

Relevance Scoring Rubric (1 to 10 integer):
- 9–10 (Direct Strong Match): Directly addresses the research question, core task, or primary phenomenon. Methodology and findings closely match.
- 7–8 (Strong Match): Materially addresses the research objective or an explicitly requested component. Provides a directly useful method, benchmark, or finding.
- 5–6 (Partial / Background): Contributes useful background or addresses only part of the question.
- 3–4 (Weak / Tangential): Shares broad terminology, but its primary contribution solves a different problem.
- 1–2 (Irrelevant): Matches broad words without substantive connection.

Instructions:
1. Base evaluations ONLY on the supplied title and abstract. Do not invent findings.
2. For each candidate, provide:
   - "paper_id": exact paper_id string provided in the candidate list
   - "relevance_score": integer between 1 and 10
   - "relevance_reason": concise, evidence-based explanation (1-2 sentences) grounded in the abstract stating specifically why it matches or mismatches.
   - "matched_criteria": array of specific matching aspects, methods, or tasks
3. Output MUST be strict JSON matching this structure:
{
  "evaluations": [
    {
      "paper_id": "...",
      "relevance_score": 9,
      "relevance_reason": "...",
      "matched_criteria": ["..."]
    }
  ]
}
"""


def _heuristic_screen_candidate(objective: str, paper: Dict) -> Dict[str, Any]:
    """
    Fallback deterministic relevance evaluator when LLM is unavailable or malformed.
    Analyzes title and abstract term alignment and penalizes superficial overlap.
    """
    title = (paper.get("title") or "").lower()
    abstract = (paper.get("summary") or "").lower()
    combined_text = f"{title} {abstract}"

    # Extract non-trivial objective terms (3+ chars)
    words = re.findall(r"\b[a-zA-Z]{3,}\b", objective.lower())
    stop_words = {
        "find", "papers", "paper", "recent", "about", "with", "from", "that", "this",
        "peer", "reviewed", "show", "give", "help", "work", "study", "studies", "research"
    }
    keywords = [w for w in words if w not in stop_words]

    if not keywords:
        return {
            "relevance_score": 6,
            "relevance_reason": "Candidate retrieved via query keywords; detailed LLM abstract screening unavailable.",
            "matched_criteria": ["topic overlap"],
        }

    title_matches = [w for w in keywords if re.search(r"\b" + re.escape(w) + r"\b", title)]
    abstract_matches = [w for w in keywords if re.search(r"\b" + re.escape(w) + r"\b", abstract)]
    all_matches = list(set(title_matches + abstract_matches))

    # Scoring heuristic
    coverage = len(all_matches) / len(keywords) if keywords else 0

    if len(title_matches) >= 2 or coverage >= 0.75:
        score = 8
        reason = f"Title and abstract strongly align with key research targets ({', '.join(all_matches[:3])})."
    elif len(title_matches) >= 1 and coverage >= 0.5:
        score = 7
        reason = f"Candidate covers key research objectives ({', '.join(all_matches[:3])}) in title and abstract."
    elif coverage >= 0.4:
        score = 5
        reason = f"Mentions related concepts ({', '.join(all_matches[:3])}) as supporting background."
    elif len(all_matches) > 0:
        score = 3
        reason = f"Tangential mention of '{', '.join(all_matches[:2])}' but focuses primarily on another topic."
    else:
        score = 2
        reason = "Abstract shows minimal substantive alignment with the research objective."

    return {
        "relevance_score": score,
        "relevance_reason": reason,
        "matched_criteria": all_matches,
    }


def parse_and_validate_evaluations(
    raw_response: str,
    valid_ids: List[str],
    min_score: int = 7
) -> Dict[str, Dict[str, Any]]:
    """
    Parses and strictly validates the LLM JSON output against the submitted candidate IDs.
    Ensures every score is within 1-10 and derives is_relevant in code.
    """
    cleaned = raw_response.strip()
    # Strip markdown code blocks
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()

    # Find JSON structure if wrapped in auxiliary text
    json_match = re.search(r"\{[\s\S]*\}", cleaned)
    if json_match:
        cleaned = json_match.group(0)

    data = json.loads(cleaned)
    evaluations_list = data.get("evaluations", [])
    if not isinstance(evaluations_list, list):
        raise ValueError("Invalid format: 'evaluations' must be a list.")

    valid_id_set = set(valid_ids)
    results_by_id: Dict[str, Dict[str, Any]] = {}

    for item in evaluations_list:
        if not isinstance(item, dict):
            continue

        raw_id = str(item.get("paper_id", "")).strip()
        # Normalization match: match either exact ID or ID without version suffix
        matched_id = None
        if raw_id in valid_id_set:
            matched_id = raw_id
        else:
            base_id = raw_id.split("v")[0]
            for vid in valid_id_set:
                if vid == base_id or vid.split("v")[0] == base_id:
                    matched_id = vid
                    break

        if not matched_id or matched_id in results_by_id:
            # Reject unknown candidate IDs or duplicates in the LLM response
            continue

        # Validate score (clamp to 1-10 integer)
        try:
            score_val = int(round(float(item.get("relevance_score", 5))))
            score_val = max(1, min(10, score_val))
        except (ValueError, TypeError):
            score_val = 5

        reason = str(item.get("relevance_reason", "")).strip()
        if not reason or len(reason) < 8:
            reason = "Relevance assessed from abstract methodology and research problem."

        criteria = item.get("matched_criteria", [])
        if not isinstance(criteria, list):
            criteria = []
        criteria = [str(c).strip() for c in criteria if str(c).strip()]

        results_by_id[matched_id] = {
            "relevance_score": score_val,
            "is_relevant": score_val >= min_score,
            "relevance_reason": reason,
            "matched_criteria": criteria,
        }

    return results_by_id


def screen_candidates(
    research_objective: str,
    candidates: List[Dict],
    api_key: Optional[str] = None,
    min_score: int = 7
) -> List[Dict]:
    """
    Evaluates candidate papers against the user's research objective.
    Uses OpenRouter LLM when available, with strict parsing and fallback.

    Args:
        research_objective: The user's research problem / goal.
        candidates: List of paper dicts with 'paper_id', 'title', 'summary', 'authors', etc.
        api_key: Optional OpenRouter API key override.
        min_score: Minimum threshold for qualification (default 7/10).

    Returns:
        The candidates list, with 'relevance_score', 'relevance_reason', 'is_relevant',
        and 'matched_criteria' attached to each paper dict.
    """
    if not candidates:
        return []

    key = api_key or settings.OPENROUTER_API_KEY
    valid_ids = [c["paper_id"] for c in candidates if "paper_id" in c]

    evaluations: Dict[str, Dict[str, Any]] = {}

    if key:
        # Construct compact candidate representation for the LLM
        candidate_prompts = []
        for c in candidates:
            abstract_text = c.get("summary") or "No abstract provided."
            # Truncate very long abstracts to 900 chars to save tokens while keeping core findings
            truncated_abstract = abstract_text[:900] + ("..." if len(abstract_text) > 900 else "")
            authors_str = ", ".join(c.get("authors", [])[:3])
            candidate_prompts.append({
                "paper_id": c["paper_id"],
                "title": c.get("title", ""),
                "authors": authors_str,
                "year": c.get("year"),
                "abstract": truncated_abstract,
            })

        user_content = (
            f"User Research Objective: {research_objective.strip()}\n\n"
            f"Candidate Papers to Screen ({len(candidate_prompts)}):\n"
            f"{json.dumps(candidate_prompts, indent=2)}\n\n"
            f"Evaluate every candidate and return strict JSON with 'evaluations'."
        )

        headers = {
            "Authorization": f"Bearer {key}",
            "HTTP-Referer": "https://SupervisorX.local",
            "X-Title": "SupervisorX Paper Screener",
            "Content-Type": "application/json",
        }

        payload = {
            "models": SCREENER_MODELS,
            "messages": [
                {"role": "system", "content": SCREENER_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.1,
            "max_tokens": 1200,
        }

        try:
            logger.info(f"Screening {len(candidates)} candidates via OpenRouter...")
            response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=20.0)
            if response.status_code == 200:
                data = response.json()
                if "choices" in data and len(data["choices"]) > 0:
                    raw_text = data["choices"][0]["message"].get("content") or ""
                    if raw_text.strip():
                        evaluations = parse_and_validate_evaluations(raw_text, valid_ids, min_score=min_score)
                        logger.info(f"Successfully evaluated {len(evaluations)} of {len(candidates)} papers via LLM.")
                    else:
                        logger.warning("Empty content in LLM response choice; using heuristic screener.")
            else:
                logger.warning(f"OpenRouter screening call failed with status {response.status_code}: {response.text}")
        except Exception as e:
            logger.warning(f"Error during LLM screening: {e}. Applying heuristic screener.")

    # Fill in any candidates that were missed by the LLM or if LLM call failed
    for c in candidates:
        pid = c["paper_id"]
        if pid in evaluations:
            eval_data = evaluations[pid]
        else:
            fallback_eval = _heuristic_screen_candidate(research_objective, c)
            eval_data = {
                "relevance_score": fallback_eval["relevance_score"],
                "is_relevant": fallback_eval["relevance_score"] >= min_score,
                "relevance_reason": fallback_eval["relevance_reason"],
                "matched_criteria": fallback_eval["matched_criteria"],
            }

        c["relevance_score"] = eval_data["relevance_score"]
        c["is_relevant"] = eval_data["is_relevant"]
        c["relevance_reason"] = eval_data["relevance_reason"]
        c["matched_criteria"] = eval_data["matched_criteria"]

    return candidates
