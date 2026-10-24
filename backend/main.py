import os
import hmac
import shutil
import tempfile
from urllib.parse import quote, urlsplit, urlunsplit
from typing import Optional, Union, List
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
    exclude_ids: Optional[Union[List[str], str]] = None


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
    exclude_ids: Optional[str] = Query(None, description="Comma-separated IDs of papers to exclude/ignore"),
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
            exclude_ids=exclude_ids,
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
            exclude_ids=req.exclude_ids,
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


class BatchAnalysisRequest(BaseModel):
    paper_ids: List[str]
    projectId: str
    api_key: Optional[str] = None


class SingleAnalysisRequest(BaseModel):
    paper_id: str
    projectId: str
    api_key: Optional[str] = None


@app.post("/api/projects/{project_id}/papers/analyze-batch")
def analyze_papers_batch(
    project_id: str,
    req: BatchAnalysisRequest,
    x_internal_api_key: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    """Queues and executes sequential analysis across multiple papers."""
    import uuid
    import threading
    from services.paper_analysis_pipeline import run_sequential_paper_analysis, get_db_connection

    _require_project_access(x_user_id, x_internal_api_key, project_id)

    if not req.paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids list cannot be empty")

    job_id = f"job-{uuid.uuid4().hex[:12]}"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO paper_processing_jobs (
                    id, project_id, status, current_stage, progress_percent,
                    total_papers, processed_papers, current_paper_title
                ) VALUES (%s, %s, 'pending', 'validating', 0, %s, 0, 'Queued for Sequential Processing')
                """,
                (job_id, project_id, len(req.paper_ids)),
            )
        conn.commit()

    thread = threading.Thread(
        target=run_sequential_paper_analysis,
        args=(job_id, project_id, req.paper_ids, req.api_key),
        daemon=True,
    )
    thread.start()

    return {
        "success": True,
        "job_id": job_id,
        "total_papers": len(req.paper_ids),
        "status": "processing",
    }


@app.post("/api/projects/{project_id}/papers/{paper_id}/analyze")
def analyze_single_paper_endpoint(
    project_id: str,
    paper_id: str,
    req: SingleAnalysisRequest,
    x_internal_api_key: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    """Queues a single paper for analysis."""
    import uuid
    import threading
    from services.paper_analysis_pipeline import run_sequential_paper_analysis, get_db_connection

    _require_project_access(x_user_id, x_internal_api_key, project_id)

    job_id = f"job-{uuid.uuid4().hex[:12]}"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO paper_processing_jobs (
                    id, project_id, paper_id, status, current_stage, progress_percent,
                    total_papers, processed_papers, current_paper_title
                ) VALUES (%s, %s, %s, 'pending', 'validating', 0, 1, 0, 'Initializing Analysis')
                """,
                (job_id, project_id, paper_id),
            )
        conn.commit()

    thread = threading.Thread(
        target=run_sequential_paper_analysis,
        args=(job_id, project_id, [paper_id], req.api_key),
        daemon=True,
    )
    thread.start()

    return {
        "success": True,
        "job_id": job_id,
        "paper_id": paper_id,
        "status": "processing",
    }


@app.get("/api/projects/{project_id}/analysis/status")
def get_analysis_status(
    project_id: str,
    x_internal_api_key: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    """Returns the latest active or completed analysis job for the project."""
    from services.paper_analysis_pipeline import get_db_connection

    _require_project_access(x_user_id, x_internal_api_key, project_id)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, project_id, paper_id, status, current_stage, progress_percent,
                       total_papers, processed_papers, current_paper_title, error_message,
                       created_at, updated_at, completed_at
                FROM paper_processing_jobs
                WHERE project_id = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (project_id,),
            )
            row = cur.fetchone()

        if not row:
            return {"success": True, "job": None}

        job = {
            "id": row[0],
            "project_id": row[1],
            "paper_id": row[2],
            "status": row[3],
            "current_stage": row[4],
            "progress_percent": row[5],
            "total_papers": row[6],
            "processed_papers": row[7],
            "current_paper_title": row[8],
            "error_message": row[9],
            "created_at": str(row[10]),
            "updated_at": str(row[11]),
            "completed_at": str(row[12]) if row[12] else None,
        }
        return {"success": True, "job": job}


@app.get("/api/projects/{project_id}/papers/{paper_id}/analysis")
def get_paper_analysis_details(
    project_id: str,
    paper_id: str,
    x_internal_api_key: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    """Returns stored analysis insights, text chunks, and visual items for a paper."""
    from services.paper_analysis_pipeline import get_db_connection

    _require_project_access(x_user_id, x_internal_api_key, project_id)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, paper_id, title, authors, venue, year, analysis_status,
                       analyzed_at, insights, chunks_count, figures_count, vectors_count,
                       analysis_error
                FROM project_papers
                WHERE project_id = %s AND (paper_id = %s OR id = %s)
                LIMIT 1
                """,
                (project_id, paper_id, paper_id),
            )
            paper_row = cur.fetchone()
            if not paper_row:
                raise HTTPException(status_code=404, detail="Paper not found")

            # Fetch visual items
            cur.execute(
                """
                SELECT id, page_number, figure_number, caption, visual_type,
                       visual_description, visible_labels, axes_and_units, relationships_or_trends
                FROM paper_visual_items
                WHERE project_id = %s AND paper_id = %s
                ORDER BY page_number ASC
                """,
                (project_id, paper_id),
            )
            visual_rows = cur.fetchall()

        visual_items = [
            {
                "id": v[0],
                "page_number": v[1],
                "figure_number": v[2],
                "caption": v[3],
                "visual_type": v[4],
                "visual_description": v[5],
                "visible_labels": v[6],
                "axes_and_units": v[7],
                "relationships_or_trends": v[8],
            }
            for v in visual_rows
        ]

        return {
            "success": True,
            "paper": {
                "id": paper_row[0],
                "paper_id": paper_row[1],
                "title": paper_row[2],
                "authors": paper_row[3],
                "venue": paper_row[4],
                "year": paper_row[5],
                "status": paper_row[6] or "pending",
                "analyzed_at": str(paper_row[7]) if paper_row[7] else None,
                "insights": paper_row[8] or {},
                "chunks_count": paper_row[9] or 0,
                "figures_count": paper_row[10] or 0,
                "vectors_count": paper_row[11] or 0,
                "error": paper_row[12],
            },
            "visual_items": visual_items,
        }


@app.delete("/api/projects/{project_id}/papers/{paper_id}")
def delete_project_paper(
    project_id: str,
    paper_id: str,
    x_internal_api_key: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    """Deletes a paper and all associated vectors, chunks, and visual records."""
    from services.paper_analysis_pipeline import get_db_connection

    _require_project_access(x_user_id, x_internal_api_key, project_id)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM paper_vectors WHERE project_id = %s AND (paper_id = %s OR id = %s)", (project_id, paper_id, paper_id))
            cur.execute("DELETE FROM paper_text_chunks WHERE project_id = %s AND (paper_id = %s OR id = %s)", (project_id, paper_id, paper_id))
            cur.execute("DELETE FROM paper_visual_items WHERE project_id = %s AND (paper_id = %s OR id = %s)", (project_id, paper_id, paper_id))
            cur.execute("DELETE FROM project_papers WHERE project_id = %s AND (paper_id = %s OR id = %s)", (project_id, paper_id, paper_id))
            cur.execute("UPDATE projects SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = %s), updated_at = NOW() WHERE id = %s", (project_id, project_id))
        conn.commit()

    return {"success": True, "deleted_paper_id": paper_id}
