import os
import re
import json
import logging
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from config import settings
from services.chatbot_llm import build_chatbot_llm

logger = logging.getLogger("intent_router")

VALID_INTENTS = {
    "paper_search",
    "paper_qa",
    "compare_papers",
    "summarize_papers",
    "mixed_research_request",
    "clarification_needed",
    "general_chat",
}


class RouterResult(BaseModel):
    intent: str = Field(description="One of: paper_search, paper_qa, compare_papers, summarize_papers, mixed_research_request, clarification_needed, general_chat")
    extracted_query: str = Field(default="", description="The specific core scientific topic, question, or keyword query")
    target_papers: List[str] = Field(default_factory=list, description="Titles, IDs, or references to specific papers mentioned (e.g. ['2601.15305', 'second paper'])")
    comparison_dimensions: List[str] = Field(default_factory=list, description="Dimensions to compare if compare_papers (e.g. methodology, datasets, metrics)")
    summary_focus: Optional[str] = Field(default=None, description="Focus of summary (e.g. methodology, limitations, findings, full)")
    clarification_prompt: Optional[str] = Field(default=None, description="Clarifying question if clarification_needed")
    reasoning: Optional[str] = Field(default=None, description="Brief explanation for intent choice")


SYSTEM_PROMPT = """You are the scientific intent router for SupervisorX, an AI research assistant.
Analyze the user's latest query along with recent conversation history and classify their intent into exactly ONE of the following:

1. "paper_search":
   - The user wants to discover, search, fetch, or find NEW candidate research papers or preprints from arXiv or academic literature.
   - Examples: "Find papers about gated sparse attention", "Search for radiomics survival prediction literature", "Bring me 5 recent papers on transformer quantization".

2. "paper_qa":
   - The user asks a scientific question, asks for an explanation of a concept, mechanism, formula, finding, or result that should be answered from the ANALYZED papers in their project library.
   - Examples: "What is Gated Sparse Attention and how does its dynamic gating work?", "What are the main limitations reported in the paper?", "Explain the methodology of attention sparsification", "How do the experimental results compare to baseline?".

3. "compare_papers":
   - The user explicitly asks to compare two or more papers in the project library.
   - Examples: "Compare Paper 1 and Paper 2", "Compare these papers across dataset size and accuracy", "What are the key methodological differences between the two analyzed papers?".

4. "summarize_papers":
   - The user asks for a structured summary or walkthrough of one or more papers in their project.
   - Examples: "Summarize the GSA paper", "Give me an executive summary of the analyzed paper", "Explain this paper as if I am a beginner", "Summarize the methodology and limitations".

5. "mixed_research_request":
   - The user asks to BOTH search for papers AND compare/summarize or answer questions in the same message.
   - Example: "Find papers on linear attention and compare their computational complexity".

6. "clarification_needed":
   - The request is severely ambiguous or refers to an unidentifiable paper that cannot be resolved from conversation context.

7. "general_chat":
   - Greetings, conversational courtesies, or capabilities questions ("Hello", "What can you do?", "Thanks!").

CRITICAL INSTRUCTIONS:
- You must respond with a strict, valid JSON object only. No markdown fences, no preamble.
- JSON structure:
{
  "intent": "paper_search" | "paper_qa" | "compare_papers" | "summarize_papers" | "mixed_research_request" | "clarification_needed" | "general_chat",
  "extracted_query": "Clean scientific search or QA query without conversational filler",
  "target_papers": ["list of papers, titles, or relative indices mentioned"],
  "comparison_dimensions": ["methodology", "dataset", "metrics", etc.],
  "summary_focus": "full" | "methodology" | "results" | "limitations",
  "clarification_prompt": null,
  "reasoning": "brief explanation"
}
"""


def _get_langchain_model(model_name: Optional[str] = None, api_key: Optional[str] = None) -> ChatOpenAI:
    return build_chatbot_llm(
        model_name=model_name,
        api_key=api_key,
        temperature=0.0,
        max_tokens=600,
        request_timeout=15.0,
    )


def _heuristic_intent_fallback(text: str) -> RouterResult:
    """Deterministic fallback if the LLM fails to return valid structured JSON."""
    lower = text.lower().strip()

    # Extract target paper mentions
    target_papers = []
    arxiv_matches = re.findall(r"\b\d{4}\.\d{4,5}(?:v\d+)?\b", text)
    if arxiv_matches:
        target_papers.extend(arxiv_matches)

    paper_idx_matches = re.findall(r"\bpaper\s*#?(\d+)\b", lower)
    for idx_str in paper_idx_matches:
        target_papers.append(f"paper {idx_str}")

    # Compare intent
    if any(k in lower for k in ["compare", "comparison", "difference between", "versus", " vs "]):
        return RouterResult(
            intent="compare_papers",
            extracted_query=text,
            target_papers=target_papers,
            reasoning="Heuristic fallback detected comparison keywords"
        )

    # Summarize intent
    if any(k in lower for k in ["summarize", "summary", "give me a brief of", "overview of the paper"]):
        return RouterResult(
            intent="summarize_papers",
            extracted_query=text,
            target_papers=target_papers,
            reasoning="Heuristic fallback detected summarization keywords"
        )

    # Search intent
    search_keywords = ["find papers", "search papers", "look for papers", "show papers", "get papers", "bring papers", "papers about", "preprints about"]
    if any(k in lower for k in search_keywords) or lower.startswith(("find ", "search ", "look for ")):
        return RouterResult(
            intent="paper_search",
            extracted_query=text,
            target_papers=target_papers,
            reasoning="Heuristic fallback detected paper search keywords"
        )

    # Question Answering intent
    qa_starters = ["what ", "how ", "why ", "explain ", "can you explain", "does ", "is there ", "what are ", "which ", "who "]
    if any(lower.startswith(s) for s in qa_starters) or "?" in lower:
        return RouterResult(
            intent="paper_qa",
            extracted_query=text,
            target_papers=target_papers,
            reasoning="Heuristic fallback detected question structure"
        )

    # Default to paper_qa if query looks like a concept, or paper_search if short keyword
    if len(lower.split()) <= 4:
        return RouterResult(
            intent="paper_search",
            extracted_query=text,
            target_papers=target_papers,
            reasoning="Heuristic fallback: short query treated as search"
        )

    return RouterResult(
        intent="paper_qa",
        extracted_query=text,
        target_papers=target_papers,
        reasoning="Heuristic fallback: detailed prompt treated as research Q&A"
    )


def route_user_intent(
    query: str,
    recent_history: Optional[List[Dict[str, str]]] = None,
    api_key: Optional[str] = None
) -> RouterResult:
    """
    Classifies user intent using Gemini, with the existing OpenRouter model as fallback and heuristic recovery.
    """
    clean_prompt = query.strip()
    if not clean_prompt:
        return RouterResult(intent="general_chat", extracted_query="", reasoning="Empty input")

    # Fast-path for common greeting/politeness
    if clean_prompt.lower() in {"hello", "hi", "hey", "help", "who are you", "what can you do"}:
        return RouterResult(
            intent="general_chat",
            extracted_query=clean_prompt,
            reasoning="Conversational greeting"
        )

    # Format context for LangChain
    history_lines = []
    if recent_history:
        for m in recent_history[-4:]:
            role = m.get("role") or m.get("sender") or "user"
            content = m.get("content") or m.get("text") or ""
            if content:
                history_lines.append(f"{role.capitalize()}: {content[:180]}")

    user_context = f"User Request: {clean_prompt}"
    if history_lines:
        user_context = "Recent Conversation History:\n" + "\n".join(history_lines) + f"\n\nLatest Request: {clean_prompt}"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_context),
    ]

    candidate_models = [
        settings.CHATBOT_MODEL,
        settings.CHAT_FALLBACK_MODEL or "nvidia/nemotron-3.5-lightning:free",
    ]

    raw_response = ""
    for model_name in candidate_models:
        try:
            llm = _get_langchain_model(model_name=model_name, api_key=api_key)
            resp = llm.invoke(messages)
            raw_response = resp.content.strip()
            if raw_response:
                break
        except Exception as e:
            logger.warning(f"Intent routing model {model_name} invocation failed: {e}")
            continue

    if not raw_response:
        logger.warning("All LLM models failed for intent routing. Using heuristic fallback.")
        return _heuristic_intent_fallback(clean_prompt)

    # Parse JSON from response
    try:
        # Strip potential markdown formatting
        cleaned_json = raw_response
        if "```json" in cleaned_json:
            cleaned_json = cleaned_json.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_json:
            cleaned_json = cleaned_json.split("```")[1].split("```")[0].strip()

        # Find first { and last }
        start_idx = cleaned_json.find("{")
        end_idx = cleaned_json.rfind("}")
        if start_idx != -1 and end_idx != -1:
            cleaned_json = cleaned_json[start_idx:end_idx + 1]

        data = json.loads(cleaned_json)
        intent = data.get("intent", "").lower().strip()
        if intent not in VALID_INTENTS:
            intent = "paper_qa"

        extracted_q = data.get("extracted_query") or clean_prompt
        target_papers = data.get("target_papers") or []
        comparison_dims = data.get("comparison_dimensions") or []
        summary_focus = data.get("summary_focus")
        clarification_prompt = data.get("clarification_prompt")
        reasoning = data.get("reasoning")

        return RouterResult(
            intent=intent,
            extracted_query=extracted_q,
            target_papers=target_papers if isinstance(target_papers, list) else [str(target_papers)],
            comparison_dimensions=comparison_dims if isinstance(comparison_dims, list) else [],
            summary_focus=summary_focus,
            clarification_prompt=clarification_prompt,
            reasoning=reasoning
        )
    except Exception as parse_err:
        logger.warning(f"Failed to parse LLM intent response '{raw_response}': {parse_err}. Falling back to heuristic.")
        return _heuristic_intent_fallback(clean_prompt)
