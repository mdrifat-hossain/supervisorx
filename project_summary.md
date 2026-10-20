# Project Summary: AI-Powered Research Assistant

## Purpose

Build an AI-powered research assistant for students, researchers, and academics. It should help users discover academic papers, process and analyze them, ask evidence-grounded questions, compare findings across papers, and generate PDF summaries.

## Problem Being Solved

Research workflows are time-consuming: users must find papers, download and read them, compare methods and results, and identify useful findings. Answers from general-purpose chatbots may not show exactly where their claims came from. This project prioritizes traceability to source documents.

## Primary User Flow

1. Create a research project and enter a topic or research objective.
2. Search academic sources (for example, arXiv) and review paper metadata.
3. Select and download available papers.
4. Extract PDF text and metadata; extract figures/tables where supported and use OCR when needed.
5. Clean and chunk the content, generate embeddings, and index it.
6. Save paper/project metadata and searchable content.
7. Analyze papers and store useful analysis results.
8. Ask questions about one paper or a paper collection.
9. Retrieve relevant passages and generate answers with source citations.
10. Generate an individual or cross-paper report and export it as PDF.

## Core Capabilities

- **Paper discovery:** Search supported academic APIs and show available metadata, abstracts, authors, dates, and links.
- **PDF processing:** Extract and clean text and metadata, with optional figure/table extraction and OCR.
- **Semantic retrieval:** Find relevant passages by meaning, using embeddings and a vector database.
- **Grounded research chat:** Answer using retrieved source passages; cite paper, page, section, and supporting text where available.
- **Paper analysis:** Extract objectives, contributions, methods, model architectures, datasets, experimental settings, metrics, results, limitations, and future work.
- **Cross-paper synthesis:** Compare similarities and differences, with conclusions grounded in evidence.
- **PDF reports:** Produce structured summaries with citations.
- **Project management:** Keep topics, selected papers, conversations, and reports organized per project.
- **Reusable paper library:** Reuse downloaded and processed papers across projects where compatible and current.
- **Configurable AI providers:** Support local models through Ollama and configured cloud/provider APIs. Users provide their own credentials and pay applicable usage costs.
- **Fallback routing:** Where supported, switch to a configured alternative provider when limits are reached, while preserving context and communicating when fallback cannot be used.

## Proposed Architecture and Stack

| Layer | Proposed technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend/API | FastAPI, Python |
| Relational data | PostgreSQL |
| Vector search | Qdrant |
| Local model runtime | Ollama |
| Hosted model integration | OpenAI-compatible APIs and provider-specific integrations |
| PDF extraction | PyMuPDF |
| OCR | An appropriate OCR engine when required |
| Embeddings | Configurable embedding models |
| Background jobs | ARQ + Redis, if needed |
| PDF report generation | LaTeX and PDF compilation tools |
| Source control | Git and GitHub |

**Important:** This is the proposed architecture from the project proposal, not proof that every component is already implemented. Inspect the codebase, dependency files, environment configuration, and tests before making implementation claims or changes.

## Data and Evidence Principles

- Keep paper metadata and project records in the relational database.
- Store searchable chunks and embeddings in the vector database.
- Preserve useful source metadata such as paper ID, page, section, and source URL.
- Ground answers and synthesis in retrieved passages.
- Cite sources so users can verify claims.
- Clearly distinguish statements in the papers from model interpretation.
- Acknowledge when the retrieved evidence is insufficient.
- Isolate user and project data appropriately.
- Reuse existing paper files and processed data only when they are compatible and up to date.

## Initial Scope and Priorities

Prioritize an end-to-end workflow for supported, primarily text-based research PDFs:

1. Project management and academic paper discovery.
2. Paper selection, downloading, and duplicate detection.
3. PDF extraction, chunking, embeddings, and indexing.
4. Evidence-grounded question answering with citations.
5. Single-paper and multi-paper analysis.
6. Structured summary generation and PDF export.
7. Reusable paper library and configurable model providers.

Advanced OCR, detailed figure interpretation, large-scale parallel processing, sophisticated autonomous agents, and advanced research-gap detection are incremental features rather than required assumptions for the first version.

## Constraints and Cost Model

- Academic API coverage, paper availability, permissions, and rate limits may restrict discovery and downloads.
- Free-tier model availability and quotas can change.
- Users are expected to supply their own API credentials and cover applicable hosted-model costs.
- Provider fallback works only when the alternative is configured and available.
- Background processing through ARQ and Redis is proposed only if required by the implementation.

## Guidance for an AI Coding Agent

Before changing code:

1. Inspect the repository structure, README files, dependency manifests, environment examples, migrations, and tests.
2. Determine which features are implemented, partially implemented, or only proposed.
3. Treat this summary as product intent, not as evidence of existing implementation.
4. Preserve source traceability throughout PDF extraction, chunking, retrieval, answers, and generated reports.
5. Avoid claiming a citation, page number, or finding unless it is supported by stored source information.
6. Check for duplicate paper downloads and stale processed data before reprocessing.
7. Keep secrets out of source control; use environment variables or secure configuration for API credentials.
8. Make changes incrementally and run relevant tests.

## Success Criteria

The system should let a user go from a research topic to a searchable paper collection, ask questions whose answers cite verifiable source passages, compare papers with evidence, and export structured summaries to PDF. It should also support multiple projects, reuse compatible paper data, and allow users to configure their own model providers and costs.
