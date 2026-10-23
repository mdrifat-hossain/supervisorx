import os
import hmac
import shutil
import tempfile
from urllib.parse import quote, urlsplit, urlunsplit
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from arxiv_service import (
    search_papers,
    download_paper,
    list_downloaded_paper_ids,
    is_paper_downloaded,
    DEFAULT_DOWNLOAD_DIR,
    iterative_search_and_screen,
)

from services.llm import generate_academic_query

app = FastAPI(
    title="ResearchPilot API",
    description="Backend AI API for ResearchPilot & SupervisorX",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DownloadPaperRequest(BaseModel):
    paper_id: str
    projectId: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None


def _pooler_database_url() -> str:
    value = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
    if not value:
        raise HTTPException(status_code=503, detail="Database is not configured")
    parsed = urlsplit(value)
    pooler = os.getenv("SUPABASE_DB_POOLER_HOST")
    if pooler and parsed.hostname and parsed.hostname.startswith("db.") and parsed.hostname.endswith(".supabase.co"):
        project_ref = (urlsplit(os.getenv("SUPABASE_URL", "")).hostname or "").split(".")[0]
        if not project_ref:
            raise HTTPException(status_code=503, detail="Supabase project URL is not configured")
        password = quote(parsed.password or "", safe="")
        netloc = f"postgres.{project_ref}:{password}@{pooler}:5432"
        return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))
    return value


def _require_project_access(user_id: Optional[str], api_key: Optional[str], project_id: Optional[str]) -> None:
    expected_key = os.getenv("INTERNAL_API_KEY", "")
    if not expected_key or not api_key or not hmac.compare_digest(api_key, expected_key):
        raise HTTPException(status_code=401, detail="Unauthorized service request")
    if not user_id or not project_id:
        raise HTTPException(status_code=401, detail="Authenticated project context is required")
    try:
        import psycopg

        with psycopg.connect(_pooler_database_url(), connect_timeout=10) as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT 1 FROM projects WHERE id = %s AND owner_user_id = %s LIMIT 1",
                    (project_id, user_id),
                )
                if cursor.fetchone() is None:
                    raise HTTPException(status_code=403, detail="Project access denied")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Could not verify project access")


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 10
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    min_score: Optional[int] = 7
    api_key: Optional[str] = None


@app.get("/")
def root():
    return {"message": "ResearchPilot API is running", "service": "arXiv Academic Agent"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/papers/search")
def search_arxiv_papers(
    query: str = Query(..., description="Research query or keywords"),
    limit: int = Query(10, ge=1, le=50, description="Max papers to return"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    min_score: int = Query(7, ge=1, le=10, description="Minimum relevance threshold (1-10)"),
    api_key: Optional[str] = Query(None, description="Optional OpenRouter API key"),
):
    """
    Search arXiv preprints and iteratively screen abstracts using OpenRouter LLM
    against the user's research objective. Returns only papers meeting the relevance threshold.
    """
    try:
        return iterative_search_and_screen(
            research_objective=query,
            target_count=limit,
            start_year=start_year,
            end_year=end_year,
            min_score=min_score,
            api_key=api_key,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
def search_endpoint(req: SearchRequest):
    """
    Unified research discovery endpoint:
    1. Understands user research objective and generates targeted queries.
    2. Fetches candidate batches from arXiv.
    3. Screens titles and abstracts using OpenRouter LLM against relevance criteria.
    4. Iterates until target count is reached or candidate budget exhausted.
    5. Returns transparent relevance scores and explanations for every paper.
    """
    try:
        return iterative_search_and_screen(
            research_objective=req.query,
            target_count=req.limit or 10,
            start_year=req.start_year,
            end_year=req.end_year,
            min_score=req.min_score or 7,
            api_key=req.api_key,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/papers/download")
def download_arxiv_paper(
    req: DownloadPaperRequest,
    x_internal_api_key: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    """Download a PDF to a temporary transfer directory for Supabase upload."""
    transfer_dir = None
    try:
        _require_project_access(x_user_id, x_internal_api_key, req.projectId)
        if not req.paper_id or not req.paper_id.strip():
            raise HTTPException(status_code=400, detail="Paper ID is required")

        transfer_dir = tempfile.mkdtemp(prefix="researchpilot-paper-")
        filepath = download_paper(
            paper_id=req.paper_id.strip(),
            download_dir=transfer_dir,
            pdf_url=req.pdf_url,
            title=req.title,
        )
        filename = os.path.basename(filepath)
        file_size = os.path.getsize(filepath)

        return FileResponse(
            filepath,
            media_type="application/pdf",
            filename=filename,
            headers={"X-Paper-Id": req.paper_id, "X-File-Size": str(file_size)},
            background=BackgroundTask(shutil.rmtree, transfer_dir, ignore_errors=True),
        )
    except HTTPException:
        if transfer_dir:
            shutil.rmtree(transfer_dir, ignore_errors=True)
        raise
    except ValueError as ve:
        if transfer_dir:
            shutil.rmtree(transfer_dir, ignore_errors=True)
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        if transfer_dir:
            shutil.rmtree(transfer_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to download paper: {e}")


@app.get("/api/papers/downloaded")
def get_downloaded_papers():
    """Return all paper IDs that have already been downloaded to the storage directory."""
    try:
        ids = list_downloaded_paper_ids()
        return {
            "success": True,
            "downloaded_ids": ids,
            "storage_dir": DEFAULT_DOWNLOAD_DIR,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
