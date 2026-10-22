"""
arXiv Service Module for ResearchPilot / SupervisorX
Implements rate-limited academic paper search and direct PDF retrieval
using the official `arxiv` library.
"""

import os
import re
import time
import logging
from typing import List, Dict, Optional, Any, Set
import arxiv
import requests

from services.paper_screener import screen_candidates
from services.llm import generate_academic_query

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


def normalize_arxiv_id(raw_id: str) -> str:
    """Normalize arXiv identifier by removing URL prefix and version suffix (e.g. '2403.1192v2' -> '2403.1192')."""
    if not raw_id:
        return ""
    clean = raw_id.strip()
    if "/" in clean and ("arxiv.org" in clean or clean.startswith("http")):
        clean = clean.split("/")[-1]
    return re.sub(r"v\d+$", "", clean)


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


def fetch_arxiv_candidates(
    query: str,
    offset: int = 0,
    batch_size: int = 15,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
) -> List[Dict]:
    """
    Fetches a single page/batch of candidate papers from arXiv using client pagination.
    Normalizes metadata and applies optional publication year bounds.
    """
    if not query or not query.strip():
        return []

    cleaned_query = query.strip()
    try:
        logger.info(f"Querying arXiv batch: query='{cleaned_query}', offset={offset}, batch_size={batch_size}")
        search = arxiv.Search(
            query=cleaned_query,
            max_results=batch_size,
            sort_by=arxiv.SortCriterion.Relevance,
            sort_order=arxiv.SortOrder.Descending,
        )

        candidates: List[Dict] = []
        for result in _client.results(search, offset=offset):
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

            candidates.append({
                "paper_id": clean_id,
                "title": result.title.replace("\n", " ").strip(),
                "authors": authors,
                "summary": result.summary.replace("\n", " ").strip(),
                "published": published_dt.isoformat() if published_dt else "",
                "year": published_year,
                "venue": f"ArXiv:{clean_id.split('v')[0]}",
                "pdf_url": pdf_url,
                "entry_url": entry_url,
                "primary_category": result.primary_category or "cs.AI",
                "is_downloaded": is_downloaded,
            })

            if len(candidates) >= batch_size:
                break

        return candidates

    except Exception as e:
        logger.error(f"Error fetching arXiv batch (offset={offset}): {e}")
        return []


def decode_openalex_abstract(inverted_index: Optional[Dict]) -> str:
    """Reconstruct abstract from OpenAlex abstract_inverted_index."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    words_positions = []
    for word, positions in inverted_index.items():
        if isinstance(positions, list):
            for pos in positions:
                words_positions.append((pos, word))
    words_positions.sort(key=lambda x: x[0])
    return " ".join(word for _, word in words_positions)


def fetch_openalex_candidates(
    query: str,
    page: int = 1,
    batch_size: int = 15,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
) -> List[Dict]:
    """
    Fetches scholarly candidates from OpenAlex with full abstract and open-access PDF links.
    Restricted strictly to Open Access (is_oa:true) with direct accessible PDF locations.
    """
    if not query or not query.strip():
        return []
    try:
        url = f"https://api.openalex.org/works?search={requests.utils.quote(query.strip())}&per-page={batch_size}&page={page}"
        filters = ["is_oa:true"]
        if start_year and end_year:
            filters.append(f"publication_year:{start_year}-{end_year}")
        elif start_year:
            filters.append(f"from_publication_date:{start_year}-01-01")
        elif end_year:
            filters.append(f"to_publication_date:{end_year}-12-31")
        url += f"&filter={','.join(filters)}"

        headers = {
            "User-Agent": "SupervisorX-AcademicAssistant/1.0 (mailto:contact@supervisorx.ai)"
        }
        resp = requests.get(url, headers=headers, timeout=12.0)
        if resp.status_code != 200:
            logger.warning(f"OpenAlex request returned status {resp.status_code}")
            return []

        data = resp.json()
        results = data.get("results", [])
        candidates: List[Dict] = []

        for item in results:
            raw_title = item.get("title") or ""
            if not raw_title:
                continue

            abstract = decode_openalex_abstract(item.get("abstract_inverted_index"))
            if not abstract or len(abstract.strip()) < 40:
                continue

            work_id = str(item.get("id") or "").replace("https://openalex.org/", "")
            doi = item.get("doi") or ""
            year = item.get("publication_year")

            authors = []
            for authorship in item.get("authorships", []):
                author_obj = authorship.get("author", {})
                if author_obj.get("display_name"):
                    authors.append(author_obj["display_name"])

            best_oa = item.get("best_oa_location") or {}
            oa_info = item.get("open_access", {}) or {}

            # Check if this preprint is available on arXiv
            arxiv_id = ""
            for loc in [best_oa, item.get("primary_location")] + (item.get("locations") or []):
                if not loc:
                    continue
                loc_landing = loc.get("landing_page_url") or ""
                loc_pdf = loc.get("pdf_url") or ""
                m = re.search(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}(?:v\d+)?)", f"{loc_landing} {loc_pdf}")
                if m:
                    arxiv_id = m.group(1)
                    break

            if arxiv_id:
                clean_id = arxiv_id
                entry_url = f"https://arxiv.org/abs/{arxiv_id}"
                pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
                venue_name = "arXiv"
            else:
                clean_id = f"oa_{work_id}"
                pdf_url = best_oa.get("pdf_url") or oa_info.get("oa_url") or ""
                if not pdf_url:
                    # Skip candidates that do not provide a free full-text open-access URL
                    continue

                landing_page = best_oa.get("landing_page_url") or ""
                paywall_domains = ["10.1109", "ieeexplore", "sciencedirect", "springer", "wiley", "nature.com/articles"]
                is_paywalled_landing = any(p in (landing_page or "").lower() for p in paywall_domains)
                is_paywalled_doi = any(p in (doi or "").lower() for p in paywall_domains)

                if landing_page and not is_paywalled_landing:
                    entry_url = landing_page
                elif doi and not is_paywalled_doi:
                    entry_url = doi
                elif pdf_url:
                    entry_url = pdf_url
                else:
                    entry_url = f"https://openalex.org/{work_id}"

                source_obj = best_oa.get("source") or item.get("primary_location", {}).get("source") or {}
                venue_name = source_obj.get("display_name") or "Open Access Repository"

            candidates.append({
                "paper_id": clean_id,
                "title": raw_title.strip(),
                "authors": authors[:5],
                "summary": abstract.strip(),
                "published": item.get("publication_date") or (f"{year}-01-01" if year else ""),
                "year": year,
                "venue": venue_name[:30],
                "pdf_url": pdf_url,
                "entry_url": entry_url,
                "primary_category": "Computer Science",
                "is_downloaded": is_paper_downloaded(clean_id),
            })

        return candidates
    except Exception as e:
        logger.error(f"Error fetching OpenAlex candidates: {e}")
        return []


def iterative_search_and_screen(
    research_objective: str,
    target_count: int = 10,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    min_score: int = 7,
    max_candidates_to_screen: int = 60,
    batch_size: int = 15,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes iterative batch candidate retrieval and LLM abstract relevance screening.
    Continues fetching batches until an oversampled pool of qualified papers is collected,
    reads candidate abstracts, ranks them by relevance, and selects the top target_count.

    Core Rule: NEVER backfills with sub-threshold papers.
    """
    if not research_objective or not research_objective.strip():
        return {
            "success": False,
            "papers": [],
            "count": 0,
            "target_count": target_count,
            "papers_found": 0,
            "candidates_screened": 0,
            "minimum_relevance_score": min_score,
            "search_status": "empty_query",
            "message": "Empty research objective provided.",
            "formulated_query": "",
        }

    # Step 1: Query Formulation via LLM / Clean Heuristic
    formulated_query = generate_academic_query(research_objective, api_key=api_key)
    if not formulated_query or len(formulated_query.strip()) < 3:
        formulated_query = _clean_fallback_query(research_objective)

    # Oversample pool target: if user wants N, gather N+5 to 2N qualifying papers before picking top N
    if target_count >= 15:
        oversample_target = target_count + 10
    else:
        oversample_target = max(target_count + 5, target_count * 2)

    effective_budget = max(max_candidates_to_screen, oversample_target * 2)

    seen_ids: Set[str] = set()
    seen_titles: Set[str] = set()
    qualifying_papers: List[Dict] = []
    total_screened = 0
    offset = 0
    openalex_page = 1

    while len(qualifying_papers) < oversample_target and total_screened < effective_budget:
        remaining_budget = effective_budget - total_screened
        current_batch_size = min(batch_size, remaining_budget)

        # Retrieve candidates from arXiv first
        raw_candidates = fetch_arxiv_candidates(
            query=formulated_query,
            offset=offset,
            batch_size=current_batch_size,
            start_year=start_year,
            end_year=end_year,
        )

        offset += len(raw_candidates)

        # Provider fallback / expansion: if arXiv returned fewer candidates or timed out, query OpenAlex
        if len(raw_candidates) < 5:
            openalex_candidates = fetch_openalex_candidates(
                query=formulated_query,
                page=openalex_page,
                batch_size=current_batch_size,
                start_year=start_year,
                end_year=end_year,
            )
            openalex_page += 1
            raw_candidates.extend(openalex_candidates)

        if not raw_candidates:
            break

        # Deduplicate candidates across queries and batches by canonical ID and normalized title
        unique_batch = []
        for p in raw_candidates:
            raw_id = p.get("paper_id", "")
            canonical_id = normalize_arxiv_id(raw_id)
            title_norm = re.sub(r"[^a-zA-Z0-9]", "", (p.get("title") or "").lower())[:40]

            if canonical_id in seen_ids or (title_norm and title_norm in seen_titles):
                continue

            seen_ids.add(canonical_id)
            if title_norm:
                seen_titles.add(title_norm)
            unique_batch.append(p)

        if not unique_batch:
            if len(raw_candidates) < current_batch_size:
                break
            continue

        # Screen this candidate batch by reading their abstracts against the research objective
        screened_batch = screen_candidates(
            research_objective=research_objective,
            candidates=unique_batch,
            api_key=api_key,
            min_score=min_score,
        )

        total_screened += len(screened_batch)

        for p in screened_batch:
            if p.get("is_relevant", False):
                qualifying_papers.append(p)

        # If provider returned no new raw candidates, stop loop
        if len(raw_candidates) == 0:
            break

    # Determine final search status
    if len(qualifying_papers) >= target_count:
        search_status = "target_reached"
    elif total_screened >= effective_budget:
        search_status = "budget_exhausted"
    else:
        search_status = "search_exhausted"

    # Rank qualifying papers: highest relevance score first, then recency
    qualifying_papers.sort(
        key=lambda x: (x.get("relevance_score", 0), x.get("year") or 0),
        reverse=True
    )

    # Core Rule: Return up to target_count qualifying papers. NEVER backfill!
    selected_papers = qualifying_papers[:target_count]

    # Assign sequential rank IDs 1..N
    for idx, p in enumerate(selected_papers, start=1):
        p["id"] = idx

    if len(selected_papers) >= target_count:
        message = (
            f"Read and screened {total_screened} candidate paper abstracts across arXiv and academic literature. "
            f"Evaluated {len(qualifying_papers)} papers meeting your relevance requirements (score ≥{min_score}/10) "
            f"and selected the top {len(selected_papers)} highest-ranking matches for your objective."
        )
    elif len(selected_papers) > 0:
        message = (
            f"Screened {total_screened} paper abstracts and found {len(selected_papers)} of {target_count} target papers "
            f"that passed the strict relevance threshold (≥{min_score}/10). "
            f"No below-threshold papers were padded."
        )
    else:
        message = (
            f"Screened {total_screened} candidate paper abstracts, but none met the minimum relevance "
            f"threshold of {min_score}/10 for your objective. Try broadening your keywords."
        )

    return {
        "success": True,
        "raw_query": research_objective,
        "formulated_query": formulated_query,
        "target_count": target_count,
        "papers_found": len(selected_papers),
        "candidates_screened": total_screened,
        "minimum_relevance_score": min_score,
        "search_status": search_status,
        "message": message,
        "papers": selected_papers,
        "count": len(selected_papers),
    }


def search_papers(
    query: str,
    max_results: int = 5,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    min_score: int = 7,
    api_key: Optional[str] = None,
) -> List[Dict]:
    """
    Public search API that delegates to iterative_search_and_screen and returns qualifying papers.
    """
    res = iterative_search_and_screen(
        research_objective=query,
        target_count=max_results,
        start_year=start_year,
        end_year=end_year,
        min_score=min_score,
        api_key=api_key,
    )
    return res.get("papers", [])


def download_paper(
    paper_id: str,
    download_dir: str = DEFAULT_DOWNLOAD_DIR,
    pdf_url: Optional[str] = None,
    title: Optional[str] = None,
) -> str:
    """
    Downloads paper PDF into the project common storage directory.
    Supports direct Open Access PDF download from URL, arXiv IDs, and OpenAlex works.

    Args:
        paper_id: Clean ID (e.g. '2301.12345v1' or 'oa_W...')
        download_dir: Target directory where papers will be stored
        pdf_url: Optional direct open-access PDF URL
        title: Optional paper title for human-readable filename

    Returns:
        Absolute filepath to the saved PDF file.
    """
    clean_id = paper_id.strip()
    safe_id = clean_id.replace("/", "_").replace(":", "_")
    os.makedirs(download_dir, exist_ok=True)

    clean_title = _sanitize_filename(title or "paper")[:60]
    filename = f"{safe_id}_{clean_title}.pdf"
    target_path = os.path.join(download_dir, filename)

    # 1. Check if already downloaded with exact target name
    if os.path.exists(target_path) and os.path.getsize(target_path) > 2000:
        logger.info(f"Paper {clean_id} already exists on disk at {target_path}")
        return os.path.abspath(target_path)

    # 2. Check if any file exists starting with safe_id
    for existing in os.listdir(download_dir):
        if existing.startswith(safe_id) and existing.endswith(".pdf"):
            full_existing = os.path.join(download_dir, existing)
            if os.path.getsize(full_existing) > 2000:
                logger.info(f"Found existing file {full_existing} for {clean_id}")
                return os.path.abspath(full_existing)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (SupervisorX Academic Assistant; mailto:contact@supervisorx.ai)"
    }

    # Case A: Direct open-access PDF URL provided
    if pdf_url and (pdf_url.startswith("http://") or pdf_url.startswith("https://")):
        try:
            logger.info(f"Downloading directly from open-access PDF URL: {pdf_url}")
            resp = requests.get(pdf_url, stream=True, headers=headers, timeout=35, allow_redirects=True)
            resp.raise_for_status()

            with open(target_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=16384):
                    if chunk:
                        f.write(chunk)

            if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
                file_size = os.path.getsize(target_path)
                logger.info(f"Successfully downloaded {target_path} ({file_size} bytes)")
                return os.path.abspath(target_path)
            else:
                if os.path.exists(target_path):
                    os.remove(target_path)
                logger.warning(f"Downloaded file was invalid or too small from {pdf_url}")
        except Exception as e:
            logger.warning(f"Direct PDF download failed from {pdf_url}: {e}. Trying fallback methods...")
            if os.path.exists(target_path):
                try:
                    os.remove(target_path)
                except Exception:
                    pass

    # Case B: arXiv ID download
    arxiv_id_match = re.search(r"(\d{4}\.\d{4,5}(?:v\d+)?)", clean_id)
    arxiv_id = arxiv_id_match.group(1) if arxiv_id_match else None

    if arxiv_id:
        arxiv_pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        try:
            logger.info(f"Downloading arXiv preprint from {arxiv_pdf_url}")
            resp = requests.get(arxiv_pdf_url, stream=True, headers=headers, timeout=35, allow_redirects=True)
            resp.raise_for_status()

            with open(target_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=16384):
                    if chunk:
                        f.write(chunk)

            if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
                file_size = os.path.getsize(target_path)
                logger.info(f"Successfully downloaded arXiv PDF {target_path} ({file_size} bytes)")
                return os.path.abspath(target_path)
            else:
                if os.path.exists(target_path):
                    os.remove(target_path)
        except Exception as e:
            logger.warning(f"Direct arXiv URL download failed: {e}. Falling back to arxiv client search...")

        # Fallback to arxiv client search
        try:
            search = arxiv.Search(id_list=[arxiv_id])
            results = list(_client.results(search))
            if results:
                paper = results[0]
                paper_url = paper.pdf_url
                if not paper_url.endswith(".pdf"):
                    paper_url += ".pdf"
                resp = requests.get(paper_url, stream=True, headers=headers, timeout=35)
                resp.raise_for_status()
                with open(target_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=16384):
                        if chunk:
                            f.write(chunk)
                if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
                    return os.path.abspath(target_path)
        except Exception as err:
            logger.error(f"ArXiv client download failed for {arxiv_id}: {err}")

    # Case C: OpenAlex work lookup if clean_id is oa_W... and initial attempt had no pdf_url
    if clean_id.startswith("oa_"):
        work_id = clean_id.replace("oa_", "")
        try:
            logger.info(f"Querying OpenAlex work {work_id} for open access download location...")
            oa_resp = requests.get(f"https://api.openalex.org/works/{work_id}", headers=headers, timeout=12)
            if oa_resp.status_code == 200:
                oa_data = oa_resp.json()
                oa_url = (oa_data.get("best_oa_location") or {}).get("pdf_url") or (oa_data.get("open_access") or {}).get("oa_url")
                if oa_url:
                    resp = requests.get(oa_url, stream=True, headers=headers, timeout=35, allow_redirects=True)
                    resp.raise_for_status()
                    with open(target_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=16384):
                            if chunk:
                                f.write(chunk)
                    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
                        return os.path.abspath(target_path)
        except Exception as oa_err:
            logger.error(f"Failed to fetch OpenAlex work {work_id}: {oa_err}")

    raise ValueError(f"Could not download paper '{clean_id}'. No accessible open-access PDF was available.")


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
