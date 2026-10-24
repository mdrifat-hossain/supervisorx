"""Provider-aware client construction for the main research chatbot models."""

from typing import Optional

from langchain_openai import ChatOpenAI

from config import settings


GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def build_chatbot_llm(
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    request_timeout: float = 35.0,
) -> ChatOpenAI:
    """Build the Gemini primary client or the existing OpenRouter fallback client."""
    chosen_model = model_name or settings.CHATBOT_MODEL
    if chosen_model == settings.CHATBOT_MODEL:
        key = settings.GEMINI_API_KEY.strip()
        if not key:
            raise ValueError("GEMINI_API_KEY is not configured")
        base_url = GEMINI_OPENAI_BASE_URL
    else:
        key = api_key or settings.OPENROUTER_API_KEY
        if not key:
            raise ValueError("OPENROUTER_API_KEY is not configured for the fallback model")
        base_url = settings.OPENROUTER_BASE_URL

    return ChatOpenAI(
        model=chosen_model,
        openai_api_key=key,
        openai_api_base=base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        request_timeout=request_timeout,
    )
