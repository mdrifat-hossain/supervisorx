import os
import sys
from urllib.parse import quote, urlsplit, urlunsplit
import psycopg

def get_database_url() -> str:
    value = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
    if not value:
        raise ValueError("Database URL is not configured")
    parsed = urlsplit(value)
    pooler = os.getenv("SUPABASE_DB_POOLER_HOST")
    if pooler and parsed.hostname and parsed.hostname.startswith("db.") and parsed.hostname.endswith(".supabase.co"):
        project_ref = (urlsplit(os.getenv("SUPABASE_URL", "")).hostname or "").split(".")[0]
        if project_ref:
            password = quote(parsed.password or "", safe="")
            netloc = f"postgres.{project_ref}:{password}@{pooler}:5432"
            return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))
    return value

MIGRATIONS_SQL = """
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Extend project_papers with analysis status and metadata
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '{}'::jsonb;
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS analysis_error TEXT;
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS figures_count INTEGER DEFAULT 0;
ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS vectors_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_project_papers_status ON project_papers(project_id, analysis_status);

-- Table for tracking background analysis jobs
CREATE TABLE IF NOT EXISTS paper_processing_jobs (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    paper_id VARCHAR(128),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_stage VARCHAR(100) DEFAULT 'validating',
    progress_percent INTEGER DEFAULT 0,
    total_papers INTEGER DEFAULT 1,
    processed_papers INTEGER DEFAULT 0,
    current_paper_title TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_paper_jobs_project ON paper_processing_jobs(project_id, status);

-- Table for extracted text chunks
CREATE TABLE IF NOT EXISTS paper_text_chunks (
    id VARCHAR(128) PRIMARY KEY,
    paper_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    chunk_index INTEGER NOT NULL,
    page_start INTEGER NOT NULL,
    page_end INTEGER NOT NULL,
    section_title TEXT,
    section_path TEXT,
    content_type VARCHAR(50) DEFAULT 'text_chunk',
    text_content TEXT NOT NULL,
    source_file_path TEXT,
    content_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paper_text_chunks_paper ON paper_text_chunks(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_text_chunks_project ON paper_text_chunks(project_id);

-- Table for extracted visual items (charts, figures, diagrams, tables)
CREATE TABLE IF NOT EXISTS paper_visual_items (
    id VARCHAR(128) PRIMARY KEY,
    paper_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    page_number INTEGER NOT NULL,
    figure_number VARCHAR(50),
    caption TEXT,
    visual_type VARCHAR(50),
    visual_description TEXT,
    visible_labels TEXT,
    axes_and_units TEXT,
    relationships_or_trends TEXT,
    limitations_or_uncertainties TEXT,
    image_path TEXT,
    content_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paper_visual_items_paper ON paper_visual_items(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_visual_items_project ON paper_visual_items(project_id);

-- Unified Vector Storage using pgvector dimension 2048
CREATE TABLE IF NOT EXISTS paper_vectors (
    id VARCHAR(128) PRIMARY KEY,
    paper_id VARCHAR(128) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(128),
    content_text TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    section_title TEXT,
    section_path TEXT,
    figure_number VARCHAR(50),
    caption TEXT,
    source_file_path TEXT,
    content_hash VARCHAR(64),
    embedding_model VARCHAR(100),
    embedding vector(2048),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paper_vectors_paper ON paper_vectors(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_vectors_project ON paper_vectors(project_id);
CREATE INDEX IF NOT EXISTS idx_paper_vectors_source ON paper_vectors(source_type, source_id);
"""

def apply_migrations():
    url = get_database_url()
    print("Applying database migrations to Supabase PostgreSQL...")
    with psycopg.connect(url, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute(MIGRATIONS_SQL)
        conn.commit()
    print("✓ All migrations successfully applied!")

if __name__ == "__main__":
    apply_migrations()
