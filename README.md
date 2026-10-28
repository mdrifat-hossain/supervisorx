# SupervisorX — Autonomous AI Research Assistant

<div align="center">

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Deploy%20Link-blue?style=for-the-badge&logo=vercel)](URL_PLACEHOLDER)
[![Demo Video](https://img.shields.io/badge/🎬%20Demo%20Video-Watch%20Walkthrough-red?style=for-the-badge&logo=youtube)](URL_PLACEHOLDER)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-2048%20dims-blueviolet?style=flat-square)](https://github.com/pgvector/pgvector)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash%20Lite-orange?style=flat-square&logo=google)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

<p align="center">
  <b>A full-lifecycle academic research platform featuring candidate paper screening, vision-language figure parsing, dense pgvector retrieval, evidence-grounded chat with exact page citations, cross-paper comparison matrices, and automated PDF/DOCX synthesis report export.</b>
</p>

[Key Features](#-key-features) • [AI Model Stack](#-multi-model-ai-stack--orchestration) • [System Comparison](#-competitive-comparison-matrix) • [Future Scope](#-future-scope--research-roadmap) • [Setup Guide](#-local-setup--getting-started) • [Architecture](#-system-architecture)

</div>

---

> [!IMPORTANT]
## 🚀 Quick Access Links
- 🌐 **Live Application:** [Launch SupervisorX](https://supervisorx.onrender.com)
- 🎥 **System Walkthrough & Video Demo:** [Watch the Demo](https://drive.google.com/drive/folders/1mFxcdEu2xUNdVA3ss5RCPRMJ4a4eet8C?usp=drive_link)
- 📄 **Project Proposal & Final Report:** [Access Project Documents](https://drive.google.com/drive/folders/1mFxcdEu2xUNdVA3ss5RCPRMJ4a4eet8C?usp=drive_link)
---

## 📌 Problem & Vision

Academic researchers, graduate students, and AI/ML engineers spend countless hours reading literature, cross-referencing preprints, and synthesizing state-of-the-art methodology benchmarks. Existing generic LLM chat wrappers often suffer from:
1. **Unverifiable Hallucinations:** Fabricated citations and lack of exact physical page numbers.
2. **Information Overload:** Keyword searches on repositories yield dozens of noisy, irrelevant papers.
3. **Ignored Visual Content:** Diagrams, neural network architectures, and benchmark charts in PDFs are discarded by standard text parsers.
4. **Fragmented Tooling:** Disjointed workflows across search engines, note apps, PDF viewers, and word processors.

**SupervisorX** solves this by acting as an intelligent, project-scoped research supervisor. It orchestrates the entire research workflow: from querying scientific repositories and screening candidate abstracts to extracting structured sections and diagrams, indexing them into 2048-dimensional vector space, generating answers grounded with page-level citations, and exporting publication-ready synthesis reports.

---

## 🚀 Key Features

### 1. 🔍 Automated Academic Discovery & Intelligent Candidate Screening
- **Multi-Repository Discovery:** Directly queries open scientific repositories (arXiv API and OpenAlex API) for the latest preprints and peer-reviewed literature.
- **Query Expansion & Cleansing:** Converts natural language prompts into high-precision Boolean academic queries.
- **LLM-Powered Relevance Screening:** Analyzes candidate titles and abstracts using a structured 1–10 rubric to filter out low-relevance papers before ingestion, conserving storage and vector quota.
- **Score-Based Ranking:** Candidates are ranked by relevance score and publication recency.

### 2. 💬 Conversational Research Chatbot & Copilot
- **Natural Language Paper Discovery:** Search, screen, and import candidate papers directly through interactive chat prompts.
- **Evidence-Grounded Q&A:** Ask complex methodological, architectural, or domain questions across all analyzed papers in the project, receiving answers strictly grounded in retrieved evidence with exact page-level citations.
- **Conversational Report Generation:** Request structured comparative summaries, benchmark tables, and export-ready research reports directly within the chat dialogue.
- **Dynamic Multi-Turn Intent Routing:** Intelligently switches between searching, deep document analysis, cross-paper comparison, and synthesis without manual mode configuration.

### 3. 📑 Advanced PDF Ingestion & Vision-Language Figure Parsing
- **Hierarchical Section Extraction:** Powered by **PyMuPDF (`fitz`)**, extracting clean text structures, section headers, authors, DOI, and physical page indices.
- **Multimodal Visual Diagram Analysis:** Detects and extracts architecture diagrams, flowcharts, and empirical plots. Extracted figures are analyzed by a Vision-Language Model (`nvidia/nemotron-3.5-super-vl:free`) to generate semantic textual descriptions indexed alongside the document text.
- **Section-Aware Chunking:** Chunks respect document hierarchy, preserving scientific context and preventing arbitrary sentence cutoffs.

### 4. 🧠 Dense Vector Search & Verifiable Citations
- **High-Dimensional Embeddings:** Utilizes 2048-dimensional dense vector embeddings (`nvidia/nemotron-3-embed-1b:free`) stored in **PostgreSQL with `pgvector`**.
- **Rate-Limit Resilience:** Features a built-in 3-minute circuit breaker to automatically pause and recover from API rate limits (HTTP 429) during bulk ingestion.
- **Verifiable In-Line Citations:** Every claim returned by the primary LLM is anchored to the paper title, section name, and exact physical PDF page number.

### 5. 📊 Multi-Paper Comparative Synthesis Matrix
- Synthesizes findings across multiple papers in a single project.
- Generates structured side-by-side comparison tables analyzing methodology, dataset benchmarks, loss functions, compute requirements, and limitations.

### 6. 📄 Automated Research Report Generation
- **ReportLab PDF Engine:** Compiles publication-styled PDF reports complete with headers, metadata tables, executive summaries, comparative tables, and bibliographic citations.
- **python-docx Word Export:** Generates editable `.docx` manuscripts formatted for academic editing and collaborative writing.

### 7. 🗂️ Project-Scoped Workspaces & Document Vault
- **Isolated Research Spaces:** Organizes papers, conversation sessions, and analysis logs into isolated project workspaces.
- **Cross-Project Document Vault:** Import papers across multiple projects seamlessly without duplicating PDF storage or recalculating vector embeddings.
- **Priority Research Task Ledger:** Main dashboard includes interactive sticky notes tagged by priority (`High`, `Medium`, `Low`) to record pending readings, research questions, and experimental hypotheses.

---

## 🤖 Multi-Model AI Stack & Orchestration

SupervisorX uses a dual-engine architecture combining Google Gemini with a multi-model OpenRouter fallback chain:

| Workflow Stage | Primary Model | Provider | Redundancy / Fallback Chain | Function & Role |
|---|---|---|---|---|
| **Primary Research Chatbot & Synthesis** | `gemini-3.5-flash-lite` | Google Gemini (OpenAI-compatible) | `nvidia/nemotron-3.5-lightning:free` (OpenRouter) | Handles core research dialogue, multi-paper synthesis, evidence-grounded Q&A, and citation formulation. |
| **User Intent Routing** | `gemini-3.5-flash-lite` | Google Gemini | OpenRouter fallback | Classifies user prompts into 8 distinct research intents (`FIND_PAPERS`, `ANALYZE_PAPER`, `SUMMARIZE_PAPERS`, `COMPARE_PAPERS`, `GENERATE_REPORT`, etc.). |
| **Query Formulation & Expansion** | `minimax/minimax-m3.1-flash:free` | OpenRouter | 1. `liquid/lfm-2.5-2.6b:free`<br>2. `nvidia/nemotron-3.5-lightning:free`<br>3. Regex Heuristics | Expands conversational input into targeted academic search strings with Boolean operators for arXiv and OpenAlex. |
| **Candidate Relevance Screening** | `minimax/minimax-m3.1-flash:free` | OpenRouter | 1. `liquid/lfm-2.5-2.6b:free`<br>2. `nvidia/nemotron-3.5-lightning:free` | Evaluates preprint abstracts against research criteria using a 1–10 scoring rubric; outputs structured JSON filtering decisions. |
| **Visual Figure & Architecture Parsing** | `nvidia/nemotron-3.5-super-vl:free` | OpenRouter | `minimax/minimax-m3.1-flash:free` | Multimodal Vision-Language Model (VLM) inspecting extracted PDF figures, neural architectures, and plots to generate searchable semantic captions. |
| **Dense Vector Embeddings** | `nvidia/nemotron-3-embed-1b:free` | OpenRouter | Configurable embedding endpoints | Generates 2048-dimensional dense vectors for text chunks and visual descriptions; includes an automatic 3-minute rate-limit circuit breaker. |

---

## 📊 Competitive Comparison Matrix

How does **SupervisorX** compare to other leading academic research tools and PDF assistants?

| Feature / Capability | SupervisorX | Connected Papers | Elicit | Consensus | ChatPDF / PDF.ai | NotebookLM | Perplexity AI |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Project-Scoped Workspaces** | ✅ **Yes** | ❌ No | ⚠️ Partial | ❌ No | ❌ No | ✅ Yes | ⚠️ Collections |
| **Automated Academic Discovery (arXiv/OpenAlex)** | ✅ **Yes** | ⚠️ Citations Only | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Multi-Model Candidate Relevance Screening** | ✅ **Yes (1–10 Rubric)**| ❌ No | ⚠️ Limited | ⚠️ Summary only | ❌ No | ❌ No | ❌ No |
| **VLM Architecture & Diagram Parsing** | ✅ **Yes (VLM)** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Exact Physical Page & Section Citations** | ✅ **Yes** | ❌ No | ⚠️ Abstract level | ⚠️ Abstract level | ⚠️ Page only | ✅ Yes | ⚠️ URL only |
| **Multi-Paper Comparative Synthesis Matrix** | ✅ **Yes** | ❌ No | ✅ Yes | ⚠️ Brief | ❌ No | ⚠️ Manual | ⚠️ Brief |
| **Export Formats (PDF & DOCX)** | ✅ **ReportLab & Word**| ❌ No | ⚠️ CSV/BibTeX | ⚠️ CSV/BibTeX | ❌ No | ❌ Markdown only| ❌ No |
| **Cross-Project Paper Vault (No Duplication)** | ✅ **Yes** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Integrated Priority Task Ledger** | ✅ **Yes (Sticky Notes)**| ❌ No | ❌ No | ❌ No | ❌ No | ⚠️ Notes | ❌ No |
| **Self-Hostable Architecture with pgvector** | ✅ **Yes (Docker)** | ❌ Closed SaaS | ❌ Closed SaaS | ❌ Closed SaaS | ❌ Closed SaaS | ❌ Closed SaaS | ❌ Closed SaaS |

### Why SupervisorX Stands Out:
1. **End-to-End Ownership:** Handles the full pipeline from raw discovery to publication-ready `.docx` / `.pdf` reports within one integrated environment.
2. **Deep Multimodal Understanding:** Unlike tools that treat PDFs as plain text, SupervisorX parses diagrams, flowcharts, and benchmark figures with Vision-Language Models.
3. **Verifiable Traceability:** Zero blind trust—every claim is accompanied by clickable citations leading directly to the paper section and physical PDF page.
4. **Zero-Duplication Architecture:** Papers can be shared across multiple projects without wasting storage or recomputing expensive embeddings.

---

## 🔮 Future Scope & Research Roadmap

The long-term vision for SupervisorX is to transition from an interactive research assistant into a fully autonomous research scientist:

```
               [ SupervisorX Future Roadmap ]
                             |
         +-------------------+-------------------+
         |                                       |
         v                                       v
[ Autonomous Research Agent ]        [ Paper-to-Code ML Copilot ]
- Multi-step literature exploration   - Extracts mathematical formulations
- Autonomous hypothesis generation    - Synthesizes PyTorch/JAX models
- Recursive citation tree crawling    - Generates training loops & configs
- Automated gap analysis synthesis    - Reproducibility benchmark scripts
```

### 1. 🤖 Dedicated Autonomous Research Agents
- **Autonomous Literature Traversal:** An autonomous agent capable of executing open-ended research goals (e.g., *"Investigate state-of-the-art token pruning techniques in Vision Transformers over the last 3 years"*).
- **Recursive Citation Crawling:** Autonomously follows forward and backward citation graphs to uncover foundational and derivative works.
- **Automated Research Gap Identification:** Synthesizes literature matrices to explicitly identify unaddressed contradictions, benchmark discrepancies, or unexplored methodology combinations.

### 2. 💻 Paper-to-Code ML Copilot
- **Equation-to-Tensor Translation:** Automatically parses mathematical equations, loss formulations, and pseudo-code from papers and translates them into modular, documented **PyTorch** or **JAX** code blocks.
- **Architecture Skeleton Generation:** Utilizes the VLM diagram parsing pipeline to generate neural network class definitions (`nn.Module`) matching the exact visual schema of the paper.
- **Reproduction & Benchmark Kits:** Synthesizes ready-to-run training pipelines, synthetic data loaders, and hyperparameter configuration files (`yaml` / `Hydra`) to accelerate empirical reproduction.

---

## 🛠️ System Architecture

```
ResearchPilot (SupervisorX)
│
├── frontend/               # Next.js 14 App Router (React, TypeScript, Tailwind CSS)
│   ├── src/app/            # App routes: /dashboard, /projects, /login, /signup, /author
│   ├── src/components/     # UI components (Chatbot, Document Vault, Sticky Notes, Upload)
│   └── src/lib/            # Better Auth client, API client, Supabase browser SDK
│
├── backend/                # FastAPI Application (Python 3.11+)
│   ├── main.py             # API endpoints and middleware orchestration
│   ├── config.py           # Multi-model environment configuration
│   ├── services/
│   │   ├── chatbot_llm.py  # Gemini & OpenRouter conversational engine
│   │   ├── intent_router.py# 8-intent prompt classifier
│   │   ├── paper_screener.py # 1–10 rubric candidate paper screening
│   │   ├── vision_service.py # Vision-Language Model figure extraction
│   │   ├── embedding_service.py # 2048-dim pgvector embeddings + circuit breaker
│   │   ├── search_service.py # arXiv & OpenAlex academic search integration
│   │   ├── pdf_processor.py  # PyMuPDF section & text extraction
│   │   ├── report_generator.py # ReportLab PDF & python-docx synthesis export
│   │   └── supabase_client.py # PostgreSQL and Supabase Storage manager
│   └── migrations.py       # PostgreSQL schema & pgvector setup
│
├── compose.yaml            # Docker Compose orchestration
└── project_summary.md      # Concise technical architecture & design specification
```

---

## 💻 Local Setup & Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose installed.
- [Node.js](https://nodejs.org/) v18+ (for running frontend outside Docker).
- [Python](https://www.python.org/) 3.11+ (for running backend outside Docker).
- API Keys:
  - **Google Gemini API Key** (for primary research chatbot and intent routing)
  - **OpenRouter API Key** (for candidate screening, vision models, and embeddings)
  - **Supabase Account** (for hosted PostgreSQL with `pgvector` and private Storage bucket; or use the local PostgreSQL container)

---

### Step 1: Clone Repository & Configure Environment

```bash
git clone https://github.com/mdrifat-hossain/supervisorx.git
cd supervisorx
```

Copy the environment variable template:
```bash
cp .env.example .env
```

Edit `.env` and supply your credentials:
```env
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GEMINI_API_KEY=
CHATBOT_MODEL=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

OPENROUTER_API_KEY=

SUPABASE_DATABASE_URL=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_STORAGE_BUCKET=
SUPABASE_DB_POOLER_HOST=
INTERNAL_API_KEY=
BACKEND_URL=
```

---

### Step 2: Launch with Docker Compose

Start all services (Frontend, FastAPI Backend, and local PostgreSQL fallback):

```bash
docker compose up --build -d
```

---

### Step 3: Run Database Migrations

Initialize the Better Auth schema and verify database connectivity:

```bash
docker compose exec frontend npm run auth:migrate
```

Initialize the PostgreSQL and `pgvector` database schema:
```bash
docker compose exec backend python -c "import asyncio; from migrations import run_migrations; asyncio.run(run_migrations())"
```

---

### Step 4: Access the Application

- **Web Application:** Open `http://localhost:3000` in your browser.
- **FastAPI Interactive Docs:** Open `http://localhost:8000/docs`.

---

## 🔒 Security & Privacy Practices

- **Strict User Scoping:** All paper uploads, analysis chunks, chat histories, and notes are strictly validated against project ownership records in PostgreSQL.
- **Private Storage:** PDF manuscripts are stored in private Supabase Storage buckets, preventing unauthorized external access.
- **Server-Side API Proxy:** Frontend routes act as a secure proxy; sensitive backend service keys (`INTERNAL_API_KEY`, `SUPABASE_SECRET_KEY`) are never exposed to client-side bundles.

---

## 📄 Author & Attribution

Built with ❤️ by [Md Rifat Hossain](https://github.com/mdrifat-hossain). 

Designed for researchers pushing the frontiers of science.
