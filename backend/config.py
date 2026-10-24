import os
from pydantic import BaseModel

class Settings(BaseModel):
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "nvidia/nemotron-3-embed-1b:free")
    VISION_MODEL: str = os.getenv("VISION_MODEL", "nvidia/nemotron-3.5-super-vl:free")
    TEXT_MODEL: str = os.getenv("TEXT_MODEL", "nvidia/nemotron-3.5-lightning:free")
    CHAT_FALLBACK_MODEL: str = os.getenv("CHAT_FALLBACK_MODEL", "nvidia/nemotron-3.5-lightning:free")
    # Primary model for the full research chatbot workflow.
    CHATBOT_MODEL: str = os.getenv("CHATBOT_MODEL", "gemini-3.5-flash-lite")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    QUERY_FORMULATION_MODEL: str = os.getenv("QUERY_FORMULATION_MODEL", "nvidia/nemotron-3.5-lightning:free")
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "/storage")
    PAPERS_DIR: str = os.getenv(
        "PAPERS_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "all_papers")
    )
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")
    SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "research-papers")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")

settings = Settings()
