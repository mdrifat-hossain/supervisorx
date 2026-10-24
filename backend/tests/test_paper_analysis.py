import os
import unittest
from unittest.mock import patch, MagicMock
import pymupdf

from services.pdf_extractor import extract_pdf_structure_and_chunks
from services.vision_service import analyze_visual_item
from services.embedding_service import generate_embeddings_batch, EXPECTED_DIMENSION

class TestPaperAnalysisPipeline(unittest.TestCase):
    def setUp(self):
        # Create a synthetic academic PDF in memory
        doc = pymupdf.open()
        
        # Page 1: Abstract & Intro
        page1 = doc.new_page(width=612, height=792)
        page1.insert_text((50, 50), "Attention Is All You Need", fontsize=16)
        page1.insert_text((50, 80), "1. Abstract", fontsize=14)
        page1.insert_text(
            (50, 110),
            "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. "
            "We propose the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
            fontsize=11
        )
        page1.insert_text((50, 200), "2. Introduction", fontsize=14)
        page1.insert_text(
            (50, 230),
            "Recurrent neural networks, long short-term memory and gated recurrent neural networks have been firmly established "
            "as state of the art approaches in sequence modeling and transduction problems such as language modeling.",
            fontsize=11
        )

        # Page 2: Architecture & Figure caption
        page2 = doc.new_page(width=612, height=792)
        page2.insert_text((50, 50), "3. Model Architecture", fontsize=14)
        page2.insert_text(
            (50, 80),
            "Most competitive neural sequence transduction models have an encoder-decoder structure. "
            "Here, the encoder maps an input sequence of symbol representations to a sequence of continuous representations.",
            fontsize=11
        )
        # Draw a synthetic diagram box (vector graphic)
        page2.draw_rect(pymupdf.Rect(100, 150, 400, 300), color=(0, 0, 1), fill=(0.9, 0.9, 1))
        page2.insert_text((110, 200), "[Multi-Head Attention Layer Diagram]", fontsize=10)
        # Insert Figure caption
        page2.insert_text((100, 320), "Figure 1: The Transformer model architecture with stacked self-attention.", fontsize=10)

        self.pdf_bytes = doc.tobytes()
        doc.close()

    def test_pdf_extraction_structure_and_chunks(self):
        chunks, visual_items, summary = extract_pdf_structure_and_chunks(
            pdf_bytes=self.pdf_bytes,
            paper_id="test-paper-101",
            project_id="test-project",
            target_chunk_chars=400,
        )

        self.assertGreaterEqual(len(chunks), 1)
        self.assertGreaterEqual(summary["total_pages"], 2)

        # Verify chunk attributes
        chunk = chunks[0]
        self.assertEqual(chunk["paper_id"], "test-paper-101")
        self.assertEqual(chunk["project_id"], "test-project")
        self.assertIn("page_start", chunk)
        self.assertIn("page_end", chunk)
        self.assertIn("section_title", chunk)
        self.assertTrue(len(chunk["text_content"]) > 0)
        self.assertTrue(len(chunk["content_hash"]) > 0)

        # Verify visual items extraction
        self.assertGreaterEqual(len(visual_items), 1)
        vis = visual_items[0]
        self.assertEqual(vis["figure_number"], "1")
        self.assertIn("Figure 1", vis["caption"])
        self.assertEqual(vis["page_number"], 2)
        self.assertTrue(len(vis["base64_image"]) > 0)

    @patch("requests.post")
    def test_vision_vlm_analysis(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": '```json\n{"visual_summary": "Architecture diagram illustrating encoder-decoder multi-head attention.", "visual_type": "architecture_diagram", "visible_labels": "Multi-Head Attention, Feed Forward", "axes_and_units": null, "relationships_or_trends": "Parallel feedforward connection", "limitations_or_uncertainties": null}\n```'
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        dummy_item = {
            "figure_number": "1",
            "caption": "Figure 1: The Transformer model architecture.",
            "section_title": "Model Architecture",
            "visual_type": "figure_chart",
            "base64_image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        }

        result = analyze_visual_item(dummy_item, "Attention Is All You Need", api_key="test-key")
        self.assertIn("encoder-decoder", result["visual_summary"])
        self.assertEqual(result["visual_type"], "architecture_diagram")
        self.assertIn("Multi-Head Attention", result["visible_labels"])

    @patch("requests.post")
    def test_embedding_generation_batch(self, mock_post):
        # 2048-dimensional vector simulation
        dummy_vector = [0.01 * (i % 10) for i in range(EXPECTED_DIMENSION)]
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"index": 0, "embedding": dummy_vector},
                {"index": 1, "embedding": dummy_vector},
            ]
        }
        mock_post.return_value = mock_response

        vectors = generate_embeddings_batch(
            texts=["Text chunk 1", "Figure description 2"],
            api_key="test-key",
            batch_size=2,
        )

        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(vectors[0]), EXPECTED_DIMENSION)
        self.assertEqual(len(vectors[1]), EXPECTED_DIMENSION)

if __name__ == "__main__":
    unittest.main()
