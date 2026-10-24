from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from services import chatbot_llm, rag_service
from services import paper_summarizer


class GeminiQaTests(unittest.TestCase):
    def setUp(self):
        self.paper = {
            "paper_id": "paper-1",
            "title": "Test Paper on Algorithms",
            "authors": "A. Author",
            "year": 2024,
            "pdf_url": "https://example.test/paper.pdf",
            "chunks_count": 1,
            "vectors_count": 1,
        }
        self.evidence = [{
            "id": "chunk-1",
            "paper_id": "paper-1",
            "source_type": "text_chunk",
            "content_text": "The paper evaluates a greedy algorithm on a fixed dataset.",
            "page_start": 2,
            "page_end": 2,
            "section_title": "Methodology",
            "figure_number": None,
            "caption": None,
            "paper_title": self.paper["title"],
            "authors": self.paper["authors"],
            "year": self.paper["year"],
            "pdf_url": self.paper["pdf_url"],
            "similarity": 0.9,
        }]

    def _patch_retrieval(self):
        return (
            patch.object(rag_service, "get_eligible_analyzed_papers", return_value=[self.paper]),
            patch.object(rag_service, "retrieve_relevant_evidence", return_value=self.evidence),
        )

    def test_uses_only_configured_gemini_model_for_final_answer(self):
        llm = Mock()
        llm.invoke.return_value = SimpleNamespace(
            content="The paper evaluates a greedy algorithm on a fixed dataset [1].",
            response_metadata={"finish_reason": "stop"},
        )
        retrieval_patches = self._patch_retrieval()
        with retrieval_patches[0], retrieval_patches[1] as retrieve, \
             patch.object(rag_service.settings, "GEMINI_API_KEY", "test-gemini-key"), \
             patch.object(rag_service.settings, "CHATBOT_MODEL", "gemini-3.5-flash-lite"), \
             patch.object(chatbot_llm, "ChatOpenAI", return_value=llm) as client:
            result = rag_service.answer_research_question(
                "project-1",
                'From "Test Paper on Algorithms", explain the algorithm',
            )

        self.assertTrue(result.success)
        self.assertEqual(result.citations[0].paper_id, "paper-1")
        client.assert_called_once_with(
            model="gemini-3.5-flash-lite",
            openai_api_key="test-gemini-key",
            openai_api_base=chatbot_llm.GEMINI_OPENAI_BASE_URL,
            temperature=0.15,
            max_tokens=2500,
            request_timeout=35.0,
        )
        llm.invoke.assert_called_once()
        self.assertEqual(retrieve.call_args.kwargs["target_paper_ids"], ["paper-1"])

    def test_missing_gemini_key_returns_clear_error_without_model_call(self):
        with patch.object(rag_service, "get_eligible_analyzed_papers", return_value=[self.paper]), \
             patch.object(rag_service.settings, "GEMINI_API_KEY", ""), \
             patch.object(chatbot_llm, "ChatOpenAI") as client:
            result = rag_service.answer_research_question("project-1", "Explain the algorithm")

        self.assertFalse(result.success)
        self.assertIn("GEMINI_API_KEY", result.answer)
        client.assert_not_called()

    def test_rate_limit_returns_error_without_raw_evidence_or_fallback_call(self):
        llm = Mock()
        llm.invoke.side_effect = RuntimeError("429 RESOURCE_EXHAUSTED quota")
        retrieval_patches = self._patch_retrieval()
        with retrieval_patches[0], retrieval_patches[1], \
             patch.object(rag_service.settings, "GEMINI_API_KEY", "test-gemini-key"), \
             patch.object(chatbot_llm, "ChatOpenAI", return_value=llm) as client:
            result = rag_service.answer_research_question("project-1", "Explain the algorithm")

        self.assertFalse(result.success)
        self.assertIn("quota or rate-limit", result.answer)
        self.assertNotIn(self.evidence[0]["content_text"], result.answer)
        self.assertEqual(result.citations, [])
        client.assert_called_once()
        llm.invoke.assert_called_once()

    def test_all_papers_summary_uses_gemini(self):
        llm = Mock()
        llm.invoke.return_value = SimpleNamespace(
            content="## Test Paper on Algorithms\nThe study evaluates a greedy algorithm [1].",
            response_metadata={"finish_reason": "stop"},
        )
        with patch.object(paper_summarizer, "get_eligible_analyzed_papers", return_value=[self.paper]), \
             patch.object(paper_summarizer, "generate_embeddings_batch", return_value=[]), \
             patch.object(paper_summarizer, "retrieve_relevant_evidence", return_value=self.evidence), \
             patch.object(paper_summarizer.settings, "GEMINI_API_KEY", "test-gemini-key"), \
             patch.object(paper_summarizer.settings, "CHATBOT_MODEL", "gemini-3.5-flash-lite"), \
             patch.object(chatbot_llm, "ChatOpenAI", return_value=llm) as client:
            result = paper_summarizer.summarize_analyzed_papers("project-1", "Summarize methodologies of all papers")

        self.assertTrue(result.success)
        self.assertEqual(result.summarized_papers, [self.paper["title"]])
        client.assert_called_once_with(
            model="gemini-3.5-flash-lite",
            openai_api_key="test-gemini-key",
            openai_api_base=chatbot_llm.GEMINI_OPENAI_BASE_URL,
            temperature=0.15,
            max_tokens=3500,
            request_timeout=35.0,
        )
        llm.invoke.assert_called_once()

    def test_openrouter_fallback_model_keeps_its_existing_provider(self):
        with patch.object(chatbot_llm.settings, "CHATBOT_MODEL", "gemini-3.5-flash-lite"), \
             patch.object(chatbot_llm.settings, "OPENROUTER_API_KEY", "test-openrouter-key"), \
             patch.object(chatbot_llm.settings, "OPENROUTER_BASE_URL", "https://openrouter.example/v1"), \
             patch.object(chatbot_llm, "ChatOpenAI") as client:
            chatbot_llm.build_chatbot_llm("nvidia/nemotron-3.5-lightning:free")

        client.assert_called_once_with(
            model="nvidia/nemotron-3.5-lightning:free",
            openai_api_key="test-openrouter-key",
            openai_api_base="https://openrouter.example/v1",
            temperature=0.2,
            max_tokens=2048,
            request_timeout=35.0,
        )


if __name__ == "__main__":
    unittest.main()
