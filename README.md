# ResearchPilot (SupervisorX)

ResearchPilot is an AI-powered research assistant for students, researchers, and academics. It helps users discover relevant papers, add papers they already have, analyze and search those papers, ask evidence-grounded questions, compare findings, and export structured summaries as PDF or DOCX.

## Problem and solution

Research work often means searching many publications, downloading and reading PDFs, comparing methods and findings, and checking where each claim came from. ResearchPilot brings those steps into a project-based workspace. Its chatbot retrieves evidence from analyzed papers and can cite the paper, section, and PDF page so users can check the source.

## What the application does

- **Search and rank research papers:** Search supported sources (currently arXiv and OpenAlex). The search workflow collects candidates in batches, screens titles and abstracts for relevance, applies the selected minimum relevance score, and ranks qualifying papers by relevance (with recency as a secondary order). It returns the highest-ranked papers up to the requested count, subject to source availability and the configured screening budget; it does not claim to exhaust all papers on a topic.
- **Use papers from search or upload:** Users can find and download papers through the chatbot, or upload their own PDF papers from a project's **Upload & Analysis** area. Uploaded and downloaded papers become part of that project's research library.
- **Analyze PDF papers:** PyMuPDF extracts PDF text, metadata, page information, and supported structural/visual content. Extracted text is organized into section-aware chunks; supported figures are processed with a vision model. There is no OCR engine in the current pipeline, so scanned/image-only PDFs may not yield usable text.
- **Ask questions with evidence:** Semantic retrieval finds relevant passages from analyzed papers. Answers can include citations linked to paper titles, sections, page numbers, and supporting excerpts.
- **Summarize and compare papers:** Generate structured, evidence-grounded summaries and comparisons across eligible analyzed papers.
- **Export reports:** Generate structured PDF and Word (DOCX) documents with headings, citations, and references.
- **Manage projects and work:** Keep papers, analysis, and conversations in separate project workspaces. The main dashboard includes cross-project status and colored, titled sticky notes that can be used to record pending work and the last project status.
- **Configure provider models in code:** Current backend configuration uses OpenRouter-backed models for paper screening, embeddings, and supported visual analysis, and Gemini for the main research chatbot workflows such as Q&A and summaries (with configured fallback behavior where applicable). No local model runtime is required. Model/provider settings and API integrations can be changed by a developer in backend configuration; the application does not currently offer an end-user model-provider switcher. Provider access, free quotas, and pricing depend on each provider and account.

## Current technology stack

| Layer | Technology currently used | Role |
|---|---|---|
| Web frontend | Next.js, React, TypeScript, Tailwind CSS | Dashboard, project workspaces, paper library, chatbot, uploads, and reports |
| Backend API | Python, FastAPI | Paper search, downloads, analysis orchestration, retrieval, chat, and document export |
| Authentication | Better Auth | Email/password and optional Google/GitHub sign-in |
| Relational database | PostgreSQL, configured to use Supabase in the current hosted-data setup | Users, projects, papers, conversations, and application records |
| Vector search | pgvector extension in PostgreSQL (Supabase PostgreSQL) | Stores and searches paper-chunk and visual-item embeddings |
| PDF storage | Supabase Storage | Stores uploaded/downloaded paper PDFs privately |
| Academic sources | arXiv and OpenAlex | Candidate paper discovery and metadata |
| Main chatbot LLM | Gemini API, selected through backend configuration | Research Q&A, summaries, comparisons, and related synthesis workflows |
| Other hosted model APIs | OpenRouter | Paper relevance screening, embeddings, and supported vision-model calls |
| PDF extraction | PyMuPDF | PDF text, metadata, pages, sections/chunks, and visual extraction |
| Report generation | ReportLab and python-docx | PDF and DOCX output |
| Local development | Docker Compose, with PostgreSQL as a local fallback | Runs the frontend, FastAPI backend, and optional local database |

The implementation does **not** currently use Qdrant, Ollama, Redis/ARQ, an OCR model, or LaTeX report compilation. Supabase PostgreSQL can be replaced by the local Compose PostgreSQL database for development when the Supabase database URL is unset; Supabase Storage is used for persistent research-paper PDFs in the configured setup.

## How the research workflow works

1. Create or open a research project.
2. Search for papers using the chatbot, or upload a PDF you already have in that project's Upload & Analysis area.
3. Select papers to download or analyze.
4. The backend extracts PDF content with PyMuPDF, creates section/page-aware chunks, processes supported visuals, generates embeddings through the configured provider, and stores searchable evidence in PostgreSQL/pgvector.
5. Ask questions, request summaries, or compare papers. The backend retrieves relevant evidence and sends it to the configured LLM workflow.
6. Review inline citations and source references, then export a structured PDF or DOCX when needed.
7. Use dashboard sticky notes to record a project's status or next steps.

## Local setup

### Prerequisites

- Docker Desktop with Docker Compose
- API credentials for the configured Gemini and OpenRouter workflows
- Supabase credentials if using Supabase PostgreSQL and Storage; otherwise use the local PostgreSQL service for development

### Configure and start

1. Copy .env.example to .env and fill in the required secrets. Do not commit .env. Set a strong BETTER_AUTH_SECRET, database credentials, INTERNAL_API_KEY, and the provider keys needed for the features you plan to run. For Supabase, configure SUPABASE_DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_STORAGE_BUCKET.
2. Set BETTER_AUTH_URL to http://localhost:3000 for local development. Configure Google or GitHub OAuth credentials only if you want those sign-in options.
3. Build and start the local services:

   docker compose up --build -d

4. Create Better Auth's database tables:

   docker compose exec frontend npm run auth:migrate

5. Open http://localhost:3000. The FastAPI service is available on port 8000 for local development.

For production, configure production-grade runtime commands, secrets, database/storage connectivity, OAuth callback URLs, and trusted origins for the chosen hosting provider. The current Compose files are for local development and are not, by themselves, proof of a production deployment.

## Security and data notes

- Keep .env, provider API keys, Supabase service credentials, and INTERNAL_API_KEY private and server-side.
- Paper access is scoped to authenticated project ownership. Supabase paper PDFs are stored in a private bucket and served through controlled access.
- Do not place Supabase secret keys or internal service keys in NEXT_PUBLIC_ variables.
- Search results depend on academic source coverage, provider limits, relevance thresholds, and screening budgets.
- OCR is not implemented. Text extraction quality depends on the PDF containing extractable text.
- Provider quotas and pricing may change; verify current terms with the configured provider.

## Repository layout

- frontend/ — Next.js application and authenticated frontend API routes
- backend/ — FastAPI application, paper discovery, analysis, retrieval, AI services, and document generation
- backend/migrations.py — PostgreSQL/pgvector schema setup
- compose.yaml — Local development services
- .env.example — Environment-variable template (contains placeholders, not secrets)

## Project documentation

See [project_summary.md](project_summary.md) for the system purpose, implementation workflow, current stack, scope, and known limitations.
