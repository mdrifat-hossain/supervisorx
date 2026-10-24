import json
import logging
import time
from typing import Dict, Any, Optional
import requests
from config import settings

logger = logging.getLogger("vision_service")

VISION_PROMPT = """You are a senior academic research vision analyst. Analyze this figure/chart/diagram from an academic research paper.
Context:
- Paper: {paper_title}
- Figure/Table: {figure_number}
- Caption: {caption}
- Section: {section_title}

Provide an accurate, concise, factual scientific analysis. Do not hallucinate numbers or claims not visible in the image.
Respond in valid JSON format with the following keys:
{{
  "visual_summary": "Detailed technical summary of what this figure or chart illustrates",
  "visual_type": "chart | plot | architecture_diagram | workflow | table_image | other",
  "visible_labels": "Key labels, method names, or components shown",
  "axes_and_units": "X and Y axis variables and measurement units if applicable, or null",
  "relationships_or_trends": "Observed trends, performance comparisons, or structural relationships",
  "limitations_or_uncertainties": "Any ambiguities, blurriness, or caveats if visible, or null"
}}
"""

def analyze_visual_item(
    item: Dict[str, Any],
    paper_title: str,
    api_key: Optional[str] = None,
    max_retries: int = 3,
) -> Dict[str, Any]:
    """
    Calls nvidia/nemotron-3.5-super-vl:free via OpenRouter to analyze a visual figure/diagram.
    Returns structured visual description fields.
    """
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        return {
            "visual_summary": item.get("caption", "Scientific illustration"),
            "visual_type": item.get("visual_type", "figure"),
            "visible_labels": "",
            "axes_and_units": "",
            "relationships_or_trends": "",
            "limitations_or_uncertainties": "",
        }

    prompt = VISION_PROMPT.format(
        paper_title=paper_title or "Academic Research Paper",
        figure_number=item.get("figure_number", "Figure"),
        caption=item.get("caption", ""),
        section_title=item.get("section_title", "Document"),
    )

    image_url = f"data:image/png;base64,{item['base64_image']}"
    payload = {
        "model": settings.VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
        "temperature": 0.2,
        "max_tokens": 800,
    }

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://supervisorx.ai",
        "X-Title": "SupervisorX Paper Analysis",
    }

    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    models_to_try = [settings.VISION_MODEL, "minimax/minimax-m3.1-flash:free"]

    for model_name in models_to_try:
        payload["model"] = model_name
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                data = resp.json()
                msg = data["choices"][0]["message"]
                raw_content = msg.get("content") or msg.get("reasoning") or ""
                content = str(raw_content).strip()

                if not content:
                    content = item.get("caption", "Scientific figure or diagram")

                # Attempt JSON extraction
                clean_content = content
                if "```json" in clean_content:
                    clean_content = clean_content.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_content:
                    clean_content = clean_content.split("```")[1].split("```")[0].strip()

                try:
                    parsed = json.loads(clean_content)
                    return {
                        "visual_summary": parsed.get("visual_summary") or content,
                        "visual_type": parsed.get("visual_type") or item.get("visual_type", "figure"),
                        "visible_labels": str(parsed.get("visible_labels") or ""),
                        "axes_and_units": str(parsed.get("axes_and_units") or ""),
                        "relationships_or_trends": str(parsed.get("relationships_or_trends") or ""),
                        "limitations_or_uncertainties": str(parsed.get("limitations_or_uncertainties") or ""),
                    }
                except json.JSONDecodeError:
                    return {
                        "visual_summary": content,
                        "visual_type": item.get("visual_type", "figure"),
                        "visible_labels": "",
                        "axes_and_units": "",
                        "relationships_or_trends": "",
                        "limitations_or_uncertainties": "",
                    }
            else:
                logger.warning(f"VLM model {model_name} returned {resp.status_code}, trying fallback if available...")
        except Exception as e:
            logger.warning(f"VLM error with {model_name}: {e}")

    # Fallback if VLM was unavailable or timed out
    return {
        "visual_summary": f"{item.get('figure_number', 'Figure')}: {item.get('caption', 'Visual illustration')}",
        "visual_type": item.get("visual_type", "figure"),
        "visible_labels": "",
        "axes_and_units": "",
        "relationships_or_trends": "",
        "limitations_or_uncertainties": "",
    }

