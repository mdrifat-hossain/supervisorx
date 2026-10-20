"""
arXiv Service Module for ResearchPilot / SupervisorX
Implements rate-limited academic paper search and direct PDF retrieval
using the official `arxiv` library.
"""

import os
import re
import time
import logging
from typing import List, Dict, Optional
import arxiv
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("arxiv_service")

# Safe arXiv rate limit: 1 request every 3.0 seconds
ARXIV_DELAY_SECONDS = 3.0

# Default storage directory for all downloaded papers
DEFAULT_DOWNLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "storage", "all_papers")
)

# Shared rate-limited arXiv client
_client = arxiv.Client(
    page_size=25,
    delay_seconds=ARXIV_DELAY_SECONDS,
    num_retries=3
)


def _sanitize_filename(name: str) -> str:
    """Sanitize paper title or ID for safe filesystem storage."""
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r"\s+", "_", clean.strip())
    return clean[:120]


def is_paper_downloaded(paper_id: str, download_dir: str = DEFAULT_DOWNLOAD_DIR) -> bool:
    """
    Check if a paper has already been downloaded into the project storage directory.
    Checks for exact file matches by paper_id.
    """
    if not os.path.exists(download_dir):
        return False
    clean_id = paper_id.replace("/", "_")
    for fname in os.listdir(download_dir):
        if fname.startswith(clean_id) and fname.endswith(".pdf"):
            return True
    return False


def list_downloaded_paper_ids(download_dir: str = DEFAULT_DOWNLOAD_DIR) -> List[str]:
    """Return all clean paper IDs currently downloaded in the storage directory."""
    if not os.path.exists(download_dir):
        return []
    downloaded = []
    for fname in os.listdir(download_dir):
        if fname.endswith(".pdf"):
            base = fname[:-4]
            # Match arXiv ID pattern like 2301.12345v1 or 2403.1192
            m = re.match(r"^([a-zA-Z\-]+_)?(\d{4}\.\d{4,5}(v\d+)?)", base)
            if m:
                downloaded.append(m.group(2))
            else:
                downloaded.append(base)
    return downloaded


def search_papers(
    query: str,
    max_results: int = 5,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None
) -> List[Dict]:
    """
    Searches arXiv using arxiv.Search with rate-limiting and optional year range filtering.

    Args:
        query: Academic query string or prompt keywords
        max_results: Maximum number of papers to return
        start_year: Optional starting publication year filter (e.g. 2023)
        end_year: Optional ending publication year filter (e.g. 2026)

    Returns:
        Structured list of dictionaries with paper metadata.
    """
    if not query or not query.strip():
        return []

    # Clean query: strip natural language fluff like "find papers about"
    cleaned_query = query.strip()
    cleaned_query = re.sub(
        r"^(please\s+)?(find|search|show|get|list|explore)\s+(\d+\s+)?(recent\s+)?(peer-reviewed\s+)?papers?\s+(on|about|for|regarding)?\s*",
        "",
        cleaned_query,
        flags=re.IGNORECASE,
    ).strip()

    if not cleaned_query:
        cleaned_query = query.strip()

    # If year filter provided, fetch slightly more candidates to filter by publication year
    fetch_limit = max_results * 3 if (start_year or end_year) else max_results

    try:
        logger.info(f"Querying arXiv for: '{cleaned_query}' (limit={fetch_limit})")
        search = arxiv.Search(
            query=cleaned_query,
            max_results=fetch_limit,
            sort_by=arxiv.SortCriterion.Relevance,
            sort_order=arxiv.SortOrder.Descending,
        )

        results: List[Dict] = []
        for result in _client.results(search):
            published_dt = result.published
            published_year = published_dt.year if published_dt else None

            # Apply year range filter
            if start_year and published_year and published_year < start_year:
                continue
            if end_year and published_year and published_year > end_year:
                continue

            clean_id = result.get_short_id()
            pdf_url = result.pdf_url
            if pdf_url and not pdf_url.endswith(".pdf"):
                pdf_url += ".pdf"

            authors = [author.name for author in result.authors]
            entry_url = result.entry_id or f"https://arxiv.org/abs/{clean_id}"

            is_downloaded = is_paper_downloaded(clean_id)

            results.append({
                "paper_id": clean_id,
                "title": result.title.replace("\n", " ").strip(),
                "authors": authors,
                "summary": result.summary.replace("\n", " ").strip(),
                "published": published_dt.isoformat() if published_dt else "",
                "year": published_year,
                "venue": f"ArXiv:{clean_id}",
                "pdf_url": pdf_url,
                "entry_url": entry_url,
                "primary_category": result.primary_category or "cs.AI",
                "is_downloaded": is_downloaded,
            })

            if len(results) >= max_results:
                break

        return results

    except Exception as e:
        logger.error(f"Error executing arXiv search for '{cleaned_query}': {e}")
        return []


def download_paper(paper_id: str, download_dir: str = DEFAULT_DOWNLOAD_DIR) -> str:
    """
    Fetches the paper by ID using arxiv.Search(id_list=[paper_id]),
    streams the PDF into the common download directory, and returns the saved filepath.

    Args:
        paper_id: Clean arXiv ID (e.g. '2301.12345v1')
        download_dir: Target directory where papers will be stored

    Returns:
        Absolute filepath to the saved PDF file.
    """
    clean_id = paper_id.strip()
    os.makedirs(download_dir, exist_ok=True)

    try:
        logger.info(f"Searching paper by ID: {clean_id}")
        search = arxiv.Search(id_list=[clean_id])
        results = list(_client.results(search))

        if not results:
            raise ValueError(f"Paper with ID '{clean_id}' not found on arXiv.")

        paper = results[0]
        pdf_url = paper.pdf_url
        if not pdf_url.endswith(".pdf"):
            pdf_url += ".pdf"

        # Generate standard filename: {clean_id}_{sanitized_title}.pdf
        clean_title = _sanitize_filename(paper.title)
        filename = f"{clean_id.replace('/', '_')}_{clean_title[:60]}.pdf"
        target_path = os.path.join(download_dir, filename)

        # Stream download PDF with rate-friendly headers
        headers = {
            "User-Agent": "ResearchPilot/1.0 (academic research assistant; mailto:supervisorx@research.org)"
        }
        logger.info(f"Streaming PDF from {pdf_url} to {target_path}")
        response = requests.get(pdf_url, stream=True, headers=headers, timeout=30)
        response.raise_for_status()

        with open(target_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=16384):
                if chunk:
                    f.write(chunk)

        file_size = os.path.getsize(target_path)
        logger.info(f"Successfully downloaded {target_path} ({file_size} bytes)")
        return os.path.abspath(target_path)

    except requests.exceptions.RequestException as re_err:
        logger.error(f"Network error while downloading PDF for '{clean_id}': {re_err}")
        raise RuntimeError(f"Network error downloading paper PDF: {re_err}")
    except Exception as e:
        logger.error(f"Failed to download paper '{clean_id}': {e}")
        raise


# =====================================================================
# CLI Entrypoint Demonstrating Search and Download
# =====================================================================
def main():
    print("=" * 65)
    print(" ResearchPilot / SupervisorX - Academic arXiv Search & Download")
    print("=" * 65)

    user_query = input("\nEnter research topic or query (e.g., 'graph neural networks'): ").strip()
    if not user_query:
        user_query = "graph neural networks"

    count_input = input("Enter max papers to find [default 5]: ").strip()
    max_results = int(count_input) if count_input.isdigit() else 5

    print(f"\nScanning arXiv (cs.AI, cs.LG) with safe 3.0s rate-limit for '{user_query}'...")
    papers = search_papers(user_query, max_results=max_results, start_year=2023, end_year=2026)

    if not papers:
        print("No papers discovered matching your criteria.")
        return

    print(f"\nDiscovered {len(papers)} Open Access Preprints:\n")
    for idx, paper in enumerate(papers, start=1):
        author_str = ", ".join(paper["authors"][:3])
        if len(paper["authors"]) > 3:
            author_str += " et al."
        dl_status = "[Already in Project]" if paper["is_downloaded"] else "[Available]"
        print(f"[{idx}] {paper['title']}")
        print(f"    Authors: {author_str} ({paper['year']})")
        print(f"    ID: {paper['paper_id']} | Venue: {paper['venue']} | Status: {dl_status}")
        print(f"    URL: {paper['entry_url']}")
        print(f"    Abstract: {paper['summary'][:160]}...\n")

    selection = input("Enter paper number to download to project (or press Enter to exit): ").strip()
    if selection.isdigit():
        sel_idx = int(selection) - 1
        if 0 <= sel_idx < len(papers):
            selected_paper = papers[sel_idx]
            print(f"\nDownloading #{selected_paper['paper_id']}: '{selected_paper['title']}'...")
            try:
                saved_path = download_paper(selected_paper["paper_id"])
                print(f"[SUCCESS] Download successful!")
                print(f"  Saved to: {saved_path}")
            except Exception as e:
                print(f"[ERROR] Download failed: {e}")
        else:
            print("Invalid selection.")


if __name__ == "__main__":
    main()
