import os
from pydantic import BaseModel

class Settings(BaseModel):
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "/storage")
    PAPERS_DIR: str = os.getenv(
        "PAPERS_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "all_papers")
    )

settings = Settings()
