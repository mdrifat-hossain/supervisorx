import re
import logging
from typing import List, Dict, Optional
import requests
from config import settings

logger = logging.getLogger("llm_service")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

QUERY_FORMULATION_MODELS = [
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemma-4-26b-a4b-it:free",
    "minimax/minimax-m3.1-flash:free"
]

TEXT_MODELS = [
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemma-4-26b-a4b-it:free",
    "minimax/minimax-m3.1-flash:free"
]

VISION_MODELS = [
    "nvidia/nemotron-3.5-super-vl:free",
    "google/gemma-4-26b-a4b-it:free"
]


def _clean_fallback_query(user_prompt: str) -> str:
    """Algorithmic heuristic fallback to extract core academic terms."""
    # Strip leading conversational requests
    cleaned = re.sub(
        r"^(?:please\s+)?(?:can\s+you\s+)?(?:find|search|show|get|fetch|bring|look\s+for|give\s+me)\s+",
        "",
        user_prompt,
        flags=re.IGNORECASE
    )
    # Strip quantity / limits
    cleaned = re.sub(
        r"^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE
    )
    # Strip repeated adjective qualifiers like "recent", "peer-reviewed", "top", "more", "latest"
    cleaned = re.sub(
        r"^(?:(?:recent|new|peer-reviewed|top|more|latest|open-access)\s+)+",
        "",
        cleaned,
        flags=re.IGNORECASE
    )
    # Strip noun phrases like "papers on", "preprints about", "articles for"
    cleaned = re.sub(
        r"^(?:papers?|preprints?|articles?|literature)\s+(?:on|about|for|regarding)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE
    )
    # Strip trailing code/benchmarks/dataset
    cleaned = re.sub(
        r"\s+(?:with\s+benchmarking\s+code|with\s+code|with\s+dataset|from\s+20\d\d\s*(?:-|to)\s*20\d\d).*$",
        "",
        cleaned,
        flags=re.IGNORECASE
    ).strip()

    if not cleaned or len(cleaned) < 3:
        cleaned = user_prompt.strip()

    return cleaned


def generate_academic_query(user_prompt: str, api_key: Optional[str] = None) -> str:
    """
    Transforms natural language user input into clean academic search terms / arXiv Boolean syntax.
    Uses nvidia/nemotron-3.5-lightning:free via OpenRouter with safe fallbacks.
    """
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        logger.info("No OpenRouter API key provided. Using heuristic query cleanser.")
        return _clean_fallback_query(user_prompt)

    headers = {
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": "https://SupervisorX.local",
        "X-Title": "SupervisorX",
        "Content-Type": "application/json"
    }

    system_prompt = (
        "You are an academic search specialist. Given a user request for research papers, "
        "reformulate it into 3-8 essential scientific keyword terms or arXiv query syntax. "
        "Remove conversational fluff (e.g., 'find me', 'recent papers', 'please'). "
        "Output ONLY the search query string with no explanation, punctuation, quotes, or markdown."
    )

    payload = {
        "models": QUERY_FORMULATION_MODELS,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 800
    }

    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=12.0)
        if response.status_code == 200:
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                msg = data["choices"][0].get("message", {})
                content = (msg.get("content") or "").strip()
                # Clean up any surrounding quotes or markdown
                clean_output = re.sub(r"^[`'\"]+|[`'\"]+$", "", content).strip()
                if clean_output and len(clean_output) >= 2:
                    logger.info(f"OpenRouter query formulation: '{user_prompt}' -> '{clean_output}'")
                    return clean_output
        else:
            logger.warning(f"OpenRouter request returned status {response.status_code}: {response.text}")
    except Exception as e:
        logger.warning(f"OpenRouter query formulation failed: {e}. Falling back to heuristic cleaner.")

    return _clean_fallback_query(user_prompt)


def query_llm(
    messages: List[Dict],
    api_key: Optional[str] = None,
    is_vision: bool = False,
    temperature: float = 0.2
) -> str:
    """
    Query OpenRouter with automatic server-side fallback.
    """
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        return "OpenRouter API key is required to query this LLM model."

    headers = {
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": "https://SupervisorX.local",
        "X-Title": "SupervisorX",
        "Content-Type": "application/json"
    }

    models = VISION_MODELS if is_vision else TEXT_MODELS

    payload = {
        "models": models,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 2048
    }

    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=45.0)
        if response.status_code == 200:
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"].strip()
            return "No response generated by model."
        return f"Error from OpenRouter: HTTP {response.status_code} - {response.text}"
    except Exception as e:
        return f"Request failed: {str(e)}"
