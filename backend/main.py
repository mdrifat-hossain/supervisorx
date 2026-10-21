import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from arxiv_service import (
    search_papers,
    download_paper,
    list_downloaded_paper_ids,
    is_paper_downloaded,
    DEFAULT_DOWNLOAD_DIR,
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


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 10
    start_year: Optional[int] = None
    end_year: Optional[int] = None
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
    api_key: Optional[str] = Query(None, description="Optional OpenRouter API key"),
):
    """Search arXiv preprints matching the formulated academic query and year bounds."""
    try:
        # Step 1: Query Formulation via OpenRouter (nvidia/nemotron-3.5-lightning:free)
        formulated_query = generate_academic_query(query, api_key=api_key)

        # Step 2: Search arXiv with rate-limiting
        papers = search_papers(
            query=formulated_query,
            max_results=limit,
            start_year=start_year,
            end_year=end_year,
        )
        return {
            "success": True,
            "raw_query": query,
            "formulated_query": formulated_query,
            "count": len(papers),
            "papers": papers,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search")
def search_endpoint(req: SearchRequest):
    """
    Search endpoint as specified in SupervisorX specification:
    1. Formulates query via OpenRouter Query Formulation Model.
    2. Queries arXiv with safe rate limits.
    3. Returns structured paper cards.
    """
    try:
        formulated_query = generate_academic_query(req.query, api_key=req.api_key)
        papers = search_papers(
            query=formulated_query,
            max_results=req.limit or 10,
            start_year=req.start_year,
            end_year=req.end_year,
        )
        return {
            "success": True,
            "raw_query": req.query,
            "formulated_query": formulated_query,
            "count": len(papers),
            "papers": papers,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/papers/download")
def download_arxiv_paper(req: DownloadPaperRequest):
    """Download paper PDF into the project common storage directory."""
    try:
        if not req.paper_id or not req.paper_id.strip():
            raise HTTPException(status_code=400, detail="Paper ID is required")

        filepath = download_paper(req.paper_id.strip())
        filename = os.path.basename(filepath)
        file_size = os.path.getsize(filepath)

        return {
            "success": True,
            "paper_id": req.paper_id,
            "filename": filename,
            "filepath": filepath,
            "file_size": file_size,
            "message": "Paper downloaded successfully to project storage.",
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
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