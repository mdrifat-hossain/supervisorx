# SupervisorX — Project Summary & Architecture

## Executive Overview

**SupervisorX** is a full-stack, project-scoped AI research assistant designed for researchers, machine learning practitioners, and academics. The platform streamlines the academic research lifecycle: from targeted paper discovery across open scientific repositories to deep document parsing, multi-modal visual architecture analysis, dense vector retrieval with page-level citations, multi-paper comparative synthesis, and automated report compilation (PDF/DOCX).

Unlike single-document Q&A tools or ungrounded generative chatbots, SupervisorX organizes research into isolated **Project Workspaces**, enforces rigorous candidate relevance screening, extracts both textual sections and visual diagrams, and anchors all AI assertions to verifiable paper titles, sections, and exact PDF page numbers.

---

## Problem Statement & Target Audience

### The Problem
1. **Literature Overload:** Researchers must sift through hundreds of papers across arXiv and OpenAlex, where keyword searches return noisy, irrelevant preprints.
2. **Ungrounded Hallucinations:** Commercial generic LLMs lack direct access to proprietary or specialized PDFs, often fabricating citations or misattributing methodologies.
3. **Fragmented Workflows:** Exploring papers, taking notes, comparing architectures, extracting figures, and synthesizing literature reviews typically require 4–5 disjointed applications.
4. **Black-Box Figures & Architectures:** Most PDF chat applications discard images, plots, and architecture diagrams, missing critical algorithmic insights.

### Target Audience
- Academic researchers & graduate students conducting systematic literature reviews.
- Machine learning & AI scientists tracking state-of-the-art model architectures and empirical benchmarks.
- R&D teams requiring evidence-grounded technical synthesis and automated publication reports.

---

## Core System Architecture & Workflow Pipeline

```
  +-----------------------------------------------------------------------------------+
  |                               Next.js 14 Web Frontend                             |
  |  Project Spaces | Paper Vault | Chatbot & Synthesis | Document Export | Sticky Tasks  |
  +-----------------------------------------+-----------------------------------------+
                                            | REST / Streaming (Internal Key Auth)
                                            v
  +-----------------------------------------------------------------------------------+
  |                               FastAPI Backend Service                             |
  |  Intent Routing | Academic Search | PDF Pipeline | Embeddings | Grounded Synthesis |
  +-------+--------------------+---------------------+--------------------+-----------+
          |                    |                     |                    |
          v                    v                     v                    v
   Academic APIs         Multi-Model LLM        PyMuPDF + VLM       PostgreSQL + pgvector
   - arXiv API           - Gemini API (Primary) - Section Chunker   - Supabase / Local
   - OpenAlex API        - OpenRouter (Fallback)- Visual Parser     - 2048-dim Vectors
                         - Screening Chain                          - Supabase Storage
```

### End-to-End Workflow

1. **Project Initiation:** The user creates an isolated research project (e.g., *"Diffusion Models for Medical Imaging"*). All queries, document libraries, conversation sessions, and notes are scoped to this project workspace.
2. **Query Formulation & Expansion:** The user inputs an initial query. An OpenRouter-backed model chain reformulates the natural language prompt into high-precision Boolean academic search queries.
3. **Academic Discovery & Iterative Screening:**
   - The backend queries arXiv and OpenAlex in batches.
   - Candidate papers (titles + abstracts) pass through a dedicated LLM screening evaluator that scores relevance on a 1–10 rubric.
   - Only candidates exceeding the minimum score threshold are presented to the user, ranked by relevance and recency.
4. **Document Ingestion & Analysis:**
   - Selected candidate papers or user-uploaded PDFs are stored in private Supabase Storage.
   - **PyMuPDF Engine** extracts clean text structures, hierarchical section headers, and physical page indices.
   - **Visual Figure Parsing:** Vector diagrams, model architectures, and data plots are extracted and evaluated by a Vision-Language Model (`nvidia/nemotron-3.5-super-vl:free`), generating semantic visual captions.
5. **Dense Vector Embeddings & Vector Storage:**
   - Text chunks and visual annotations are embedded using a high-dimensional vector model (`nvidia/nemotron-3-embed-1b:free`, 2048 dimensions).
   - Vectors, metadata, and chunk text are indexed in PostgreSQL using the `pgvector` extension.
   - A built-in circuit breaker prevents rate-limit cascading during bulk ingestion.
6. **Intent Classification & Grounded Chat:**
   - A LangChain-powered intent router classifies user prompts into 8 distinct research intents.
   - For document queries, hybrid semantic search retrieves the top-$k$ relevant chunks from the project's library.
   - The primary LLM (Google Gemini) synthesizes answers strictly grounded in retrieved evidence, outputting inline citations containing paper title, section name, and exact physical page numbers.
7. **Cross-Paper Comparison & Report Generation:**
   - The system compares methodologies, datasets, and benchmark results across multiple papers in tabular formats.
   - Users export comprehensive literature review summaries into formatted PDF (ReportLab) or Microsoft Word (python-docx) documents.
8. **Research Task Ledger:**
   - The main dashboard provides an interactive priority-tagged sticky note board (High, Medium, Low) to preserve research context, track pending readings, and log hypotheses.

---

## Multi-Model AI Stack & Roles

SupervisorX leverages a resilient, multi-tiered AI model architecture combining Google Gemini with specialized OpenRouter inference endpoints:

| Component / Task | Primary Model | Provider | Fallback / Redundancy Chain | Key Role & Execution Details |
|---|---|---|---|---|
| **Main Research Chatbot & Synthesis** | `gemini-3.5-flash-lite` | Google Gemini (OpenAI-compatible API) | `nvidia/nemotron-3.5-lightning:free` (OpenRouter) | Drives multi-turn research conversations, complex paper synthesis, methodology breakdowns, and evidence-grounded Q&A with strict citation discipline. |
| **User Intent Classification** | `gemini-3.5-flash-lite` | Google Gemini | OpenRouter fallback | Routes incoming prompts into 8 distinct execution pathways (e.g., `FIND_PAPERS`, `ANALYZE_PAPER`, `SUMMARIZE_PAPERS`, `COMPARE_PAPERS`, `GENERATE_REPORT`). |
| **Query Formulation & Expansion** | `minimax/minimax-m3.1-flash:free` | OpenRouter | 1. `liquid/lfm-2.5-2.6b:free`<br>2. `nvidia/nemotron-3.5-lightning:free`<br>3. Heuristic Regex Fallback | Reformulates conversational research queries into optimized keyword search terms with Boolean operators for arXiv and OpenAlex APIs. |
| **Candidate Relevance Screening** | `minimax/minimax-m3.1-flash:free` | OpenRouter | 1. `liquid/lfm-2.5-2.6b:free`<br>2. `nvidia/nemotron-3.5-lightning:free` | Evaluates candidate paper abstracts against the user's research topic using a 1–10 scoring rubric; filters out low-relevance results before ingestion. |
| **Visual Figure & Architecture Parsing** | `nvidia/nemotron-3.5-super-vl:free` | OpenRouter | `minimax/minimax-m3.1-flash:free` | Multimodal Vision-Language model that inspects extracted PDF diagrams, neural network architectures, and benchmark plots to generate semantic textual descriptions. |
| **Dense Vector Embeddings** | `nvidia/nemotron-3-embed-1b:free` | OpenRouter | Configurable embedding endpoints | Generates 2048-dimensional dense vector embeddings for section chunks and figure captions; includes an automatic 3-minute circuit breaker on HTTP 429. |

---

## Data Engineering & Storage Architecture

### Relational & Vector Layer (PostgreSQL + pgvector)
- **Projects & Permissions:** Enforces strict user ownership; projects encapsulate papers, chat histories, and notes.
- **Paper Registry:** Tracks paper metadata (title, authors, year, DOI, arXiv ID, abstract, file size, storage URL).
- **Project-Paper Mapping:** Supports cross-project paper reuse without duplicating PDF files or recalculating vector embeddings.
- **pgvector Vector Table (`vector(2048)`):** Stores dense embeddings alongside paper IDs, chunk text, section titles, and page index numbers for cosine similarity search.
- **Activity Log & Notes:** Records research timelines and priority-tagged sticky notes (`HIGH`, `MEDIUM`, `LOW`).

### File Storage Layer (Supabase Storage)
- PDF documents are securely uploaded and stored in private Supabase Storage buckets.
- Downloaded preprints from open-access sources (arXiv, OpenAlex) are ingested directly into private storage.

### Authentication & Access Control (Better Auth)
- Robust authentication supporting Email/Password with session cookies and optional Google / GitHub OAuth.
- Frontend server-side API routes act as an authenticated proxy to the FastAPI backend, utilizing a cryptographically secure `INTERNAL_API_KEY`.

---

## Technical Specifications Summary

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons, Glassmorphic Design System.
- **Backend:** FastAPI (Python 3.11+), Pydantic v2, HTTPX, LangChain Core.
- **Document Processing:** PyMuPDF (`fitz`), ReportLab (PDF generation), `python-docx` (Word generation).
- **Database & Storage:** PostgreSQL 15+, `pgvector` extension, Supabase Storage SDK.
- **Containerization:** Docker Compose for multi-container orchestration (Frontend, Backend, local PostgreSQL fallback).

---

## Current Scope & Operational Boundaries

- **Academic Search Breadth:** Paper discovery relies on open APIs (arXiv and OpenAlex) subject to their upstream availability and rate limits.
- **Screening Budget:** Candidate discovery operates within a configurable screening budget (default: 15–20 candidates per batch) to ensure fast response times and quota efficiency.
- **Text-Layer Dependent Extraction:** PDF extraction utilizes high-fidelity native text and vector shape extraction via PyMuPDF. PDFs containing purely rasterized images without text layers are handled gracefully but yield optimal results when text layers exist.
- **Verified Human-in-the-Loop:** All AI syntheses provide clickable paper titles, sections, and page references so researchers can easily verify source integrity against the original manuscript.
