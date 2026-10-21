import sys
import os

# Add parent directory to path so imports work seamlessly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from arxiv_service import (
    search_papers,
    download_paper,
    list_downloaded_paper_ids,
    is_paper_downloaded,
    DEFAULT_DOWNLOAD_DIR,
)

# Alias search_arxiv to search_papers for master prompt compatibility
search_arxiv = search_papers
download_pdf = download_paper
