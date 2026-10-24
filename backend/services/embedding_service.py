import logging
import time
from typing import List, Optional
import requests
from config import settings

logger = logging.getLogger("embedding_service")

EXPECTED_DIMENSION = 2048

def generate_embeddings_batch(
    texts: List[str],
    api_key: Optional[str] = None,
    batch_size: int = 8,
    max_retries: int = 3,
) -> List[List[float]]:
    """
    Calls nvidia/nemotron-3-embed-1b:free via OpenRouter embeddings endpoint.
    Batch generates 2048-dimensional dense vectors for text chunks and visual descriptions.
    """
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        raise ValueError("OpenRouter API key is required for embedding generation")

    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://supervisorx.ai",
        "X-Title": "SupervisorX Paper Embeddings",
    }

    all_embeddings: List[List[float]] = []

    # Process in bounded batches
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        # Clean and truncate any single input that exceeds token limits
        cleaned_batch = [t.strip()[:4000] if len(t.strip()) > 4000 else t.strip() for t in batch]

        payload = {
            "model": settings.EMBEDDING_MODEL,
            "input": cleaned_batch,
        }

        success = False
        last_error = ""

        for attempt in range(max_retries):
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_items = data.get("data", [])
                    # Sort by index to maintain exact alignment
                    raw_items.sort(key=lambda x: x.get("index", 0))

                    batch_vectors = [item["embedding"] for item in raw_items]
                    # Validate dimension
                    for vec in batch_vectors:
                        if len(vec) != EXPECTED_DIMENSION:
                            raise ValueError(
                                f"Model returned unexpected vector dimension {len(vec)}, expected {EXPECTED_DIMENSION}"
                            )

                    all_embeddings.extend(batch_vectors)
                    success = True
                    break
                elif resp.status_code == 429:
                    wait_sec = (attempt + 1) * 3
                    logger.warning(f"Embedding rate limit (429), retrying in {wait_sec}s...")
                    time.sleep(wait_sec)
                else:
                    last_error = f"HTTP {resp.status_code}: {resp.text}"
                    logger.error(f"Embedding request failed: {last_error}")
                    time.sleep(2)
            except Exception as e:
                last_error = str(e)
                logger.error(f"Embedding request error (attempt {attempt+1}): {e}")
                time.sleep(2)

        if not success:
            raise RuntimeError(f"Failed to generate embeddings after {max_retries} attempts: {last_error}")

    return all_embeddings
