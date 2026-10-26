# ResearchPilot (SupervisorX) — Project Summary

## Purpose

ResearchPilot is a project-based AI research assistant for students, researchers, and academics. It supports paper discovery, PDF uploads, paper analysis, evidence-grounded chat, cross-paper comparison, structured summaries, and PDF/DOCX report generation.

## Problem

Finding relevant literature and extracting trustworthy findings from many papers takes time. General chatbot answers can also be difficult to verify when they do not identify the source passage. ResearchPilot aims to streamline this work while preserving traceability to the underlying papers.

## Solution and user workflow

1. A user creates or opens a research project.
2. The user asks the chatbot to find papers, or uploads a locally available PDF from that project's Upload & Analysis area.
3. For discovery, the system queries supported academic sources (currently arXiv and OpenAlex), gathers candidates in batches, and screens candidate titles and abstracts for relevance.
4. The system applies a minimum relevance threshold and ranks qualifying papers by relevance score, with recency as a secondary order. It returns the highest-ranked papers up to the requested count, within source availability and the configured screening budget. This is iterative ranked selection, not a guarantee that every paper ever published on a topic has been searched.
5. Selected papers are downloaded or uploaded and stored in the project library.
6. PyMuPDF extracts text and metadata from supported PDFs. The backend forms page- and section-aware chunks, extracts supported visual content, and sends visual analysis to a configured hosted vision model where applicable. The system does not currently include OCR, so scanned/image-only PDFs may not produce searchable text.
7. The backend generates embeddings through a hosted provider and stores paper chunks, source metadata, and vectors in PostgreSQL with pgvector.
8. The chatbot retrieves relevant evidence for Q&A, structured summaries, and comparisons. Responses can include paper title, section, PDF page, and supporting passages.
9. Users can export structured reports as PDF or DOCX and use main-dashboard sticky notes to remember project status and pending work.

## Main capabilities

- **Ranked paper discovery:** arXiv and OpenAlex search; iterative candidate collection; relevance screening; score threshold; top-ranked result selection.
- **Research-paper uploads:** Add an existing PDF through a project's Upload & Analysis workspace.
- **PDF analysis:** Extract text, metadata, page references, sections/chunks, and supported visual items with PyMuPDF and configured AI services. No OCR.
- **Evidence-grounded Q&A:** Semantic retrieval over analyzed papers with citations and source locations.
- **Paper summaries and comparisons:** Structured synthesis across one or more analyzed papers, grounded in retrieved content.
- **Document export:** Structured PDF and DOCX generation, including headings and citations.
- **Project organization:** Separate project workspaces for conversations, papers, and analysis.
- **Sticky notes:** Main-dashboard notes with title, color, and status/reminder content to help users resume work.
- **Authentication and protected data:** Better Auth, project ownership checks, PostgreSQL records, and private Supabase PDF storage.

## Current architecture and technology stack

| Component | Current implementation |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend/API | Python, FastAPI |
| Authentication | Better Auth; email/password and optional Google/GitHub OAuth |
| Relational database | PostgreSQL; Supabase PostgreSQL in the configured persistent setup |
| Vector database/search | pgvector extension in PostgreSQL (Supabase PostgreSQL) |
| PDF file storage | Private Supabase Storage bucket |
| Paper sources | arXiv and OpenAlex |
| Main research chatbot LLM | Gemini API via backend configuration for research Q&A and summaries, plus related synthesis workflows |
| Other hosted AI APIs | OpenRouter-backed screening, embedding, and supported visual-analysis calls |
| PDF processing | PyMuPDF; no OCR engine |
| PDF report generation | ReportLab |
| DOCX report generation | python-docx |
| Local development | Docker Compose with frontend, FastAPI backend, and local PostgreSQL fallback |

No local model runtime is required by the current implementation. Model/provider settings can be changed by a developer in backend configuration when the alternate provider and API are compatible; there is no end-user model-provider selection UI. Provider quotas and pricing depend on provider, model, account, and current terms. Qdrant, Ollama, ARQ/Redis, OCR, and LaTeX compilation are not part of the current stack.

## Evidence and citation approach

The analysis pipeline records paper identifiers, PDF page ranges, section titles, and extracted text for chunks. Embeddings support semantic retrieval from those records. Chat and synthesis workflows use retrieved evidence and return citation metadata so users can trace supported claims to their source paper and location. Citations are only as reliable as the extraction, retrieval, source metadata, and generated answer; scanned PDFs without a text layer are a known limitation because OCR is not implemented.

## Data handling

- PostgreSQL stores application records such as users, projects, papers, chats, and analysis data.
- The pgvector extension stores searchable embeddings alongside research evidence.
- Supabase Storage stores private research-paper PDFs in the configured setup.
- A local PostgreSQL service is available through Docker Compose for local development when Supabase database configuration is omitted.
- Backend requests forwarded by the frontend use a server-only internal key and verify the authenticated user's project ownership.

## Scope and limitations

- Search coverage is limited to supported APIs and the candidates they return; relevance screening has a configurable candidate budget and score threshold.
- Paper downloads depend on source availability and access.
- PDF text extraction works best for text-based PDFs. OCR for scanned/image-only pages is not included.
- AI output and citation quality require human review against original papers.
- Provider availability, model names, quotas, and prices can change.
- A developer can modify backend configuration to use another compatible hosted model provider; users cannot switch providers from the interface.
- The current repository documents and supports local Docker Compose setup; a production deployment must be configured separately.

## Repository map

- frontend/ — Next.js application, dashboards, project views, chatbot, and authenticated routes
- backend/ — FastAPI endpoints, academic search, PDF analysis, retrieval, AI integrations, and report generation
- backend/migrations.py — PostgreSQL and pgvector schema
- compose.yaml — Local development services
- README.md — Setup, features, current stack, and operational notes

## Success criteria

A user should be able to find and rank relevant research papers, add papers they already possess, analyze text-based PDFs, ask questions with traceable evidence, compare and summarize analyzed papers, and export structured reports. Users should also be able to organize research into projects and record reminders on the main dashboard.
