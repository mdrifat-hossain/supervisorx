import unittest
from unittest.mock import patch, MagicMock
from services.paper_screener import (
    parse_and_validate_evaluations,
    screen_candidates,
    _heuristic_screen_candidate,
)
from arxiv_service import iterative_search_and_screen, normalize_arxiv_id


class TestPaperScreener(unittest.TestCase):

    def test_normalize_arxiv_id(self):
        self.assertEqual(normalize_arxiv_id("2403.1192v1"), "2403.1192")
        self.assertEqual(normalize_arxiv_id("2403.1192v3"), "2403.1192")
        self.assertEqual(normalize_arxiv_id("http://arxiv.org/abs/2403.1192v2"), "2403.1192")
        self.assertEqual(normalize_arxiv_id("math.GT/0309136v1"), "math.GT/0309136")

    def test_parse_and_validate_evaluations_valid(self):
        valid_ids = ["p1", "p2"]
        raw_json = '''
        {
            "evaluations": [
                {
                    "paper_id": "p1",
                    "relevance_score": 9,
                    "is_relevant": true,
                    "relevance_reason": "Directly evaluates GNNs on molecular binding tasks.",
                    "matched_criteria": ["graph neural networks", "drug discovery"]
                },
                {
                    "paper_id": "p2",
                    "relevance_score": 2,
                    "is_relevant": false,
                    "relevance_reason": "Topic is baking and cooking, completely unrelated.",
                    "matched_criteria": []
                }
            ]
        }
        '''
        results = parse_and_validate_evaluations(raw_json, valid_ids, min_score=7)
        self.assertEqual(len(results), 2)
        
        eval1 = results.get("p1")
        self.assertIsNotNone(eval1)
        self.assertEqual(eval1["relevance_score"], 9)
        self.assertTrue(eval1["is_relevant"])
        self.assertEqual(eval1["matched_criteria"], ["graph neural networks", "drug discovery"])

        eval2 = results.get("p2")
        self.assertIsNotNone(eval2)
        self.assertEqual(eval2["relevance_score"], 2)
        self.assertFalse(eval2["is_relevant"])

    def test_parse_and_validate_clamps_scores_and_derives_relevance(self):
        valid_ids = ["p1"]
        # LLM tries to give score 15 and is_relevant false (inconsistent)
        raw_json = '''
        {
            "evaluations": [
                {"paper_id": "p1", "relevance_score": 15, "is_relevant": false, "relevance_reason": "Exceeds max"}
            ]
        }
        '''
        results = parse_and_validate_evaluations(raw_json, valid_ids, min_score=7)
        self.assertEqual(len(results), 1)
        # Clamped to 10, is_relevant derived in code from score >= 7 (true)
        self.assertEqual(results["p1"]["relevance_score"], 10)
        self.assertTrue(results["p1"]["is_relevant"])

    def test_parse_and_validate_rejects_unknown_ids_and_handles_missing(self):
        valid_ids = ["valid-id-1", "valid-id-2"]
        # LLM returns an unknown id and omits valid-id-2
        raw_json = '''
        {
            "evaluations": [
                {"paper_id": "hallucinated-id-99", "relevance_score": 10, "relevance_reason": "Made up"},
                {"paper_id": "valid-id-1", "relevance_score": 8, "relevance_reason": "Good match"}
            ]
        }
        '''
        results = parse_and_validate_evaluations(raw_json, valid_ids, min_score=7)
        self.assertEqual(len(results), 1)
        self.assertIn("valid-id-1", results)
        self.assertNotIn("hallucinated-id-99", results)

    @patch("requests.post")
    def test_parse_and_validate_malformed_json_fallback(self, mock_post):
        # Mock requests.post returning malformed JSON
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "INVALID JSON OUTPUT FROM LLM {"}}]
        }
        mock_post.return_value = mock_resp

        candidates = [
            {"paper_id": "p1", "title": "Neural Network Architectures", "summary": "We present a new transformer architecture."}
        ]
        # Calling screen_candidates will catch parsing error and invoke deterministic heuristic fallback
        screened = screen_candidates("Transformer neural network architectures", candidates, api_key="test-key", min_score=7)
        self.assertEqual(len(screened), 1)
        self.assertEqual(screened[0]["paper_id"], "p1")
        self.assertIn("relevance_score", screened[0])
        self.assertIn("relevance_reason", screened[0])


@patch("arxiv_service.fetch_openalex_candidates", return_value=[])
@patch("arxiv_service.generate_academic_query", return_value="mock academic query")
class TestIterativeSearchAndScreen(unittest.TestCase):

    @patch("arxiv_service.fetch_arxiv_candidates")
    def test_key_quality_rule_never_backfill_below_threshold(self, mock_fetch, mock_query, mock_oa):
        """
        REGRESSION TEST FOR CORE QUALITY PRINCIPLE:
        If user requests 10 papers, but only 6 qualify (score >= 7) across candidates,
        the system returns exactly 6 qualifying papers, NEVER padded with the sub-threshold ones.
        """
        batch1_candidates = [
            {
                "paper_id": f"2401.{1000+i}",
                "title": f"Title {i}",
                "authors": [f"Author {i}"],
                "summary": f"Abstract {i}",
                "published": "2024-01-01",
                "pdf_url": f"https://arxiv.org/pdf/2401.{1000+i}",
                "entry_id": f"https://arxiv.org/abs/2401.{1000+i}",
            }
            for i in range(15)
        ]
        called = [False]
        def fetch_mock(*args, **kwargs):
            if not called[0]:
                called[0] = True
                return batch1_candidates
            return []
        mock_fetch.side_effect = fetch_mock

        with patch("arxiv_service.screen_candidates") as mock_screen:
            def mock_screener_side_effect(research_objective, candidates, api_key=None, min_score=7):
                screened_list = []
                for idx, c in enumerate(candidates):
                    item = dict(c)
                    if idx < 6:
                        item["relevance_score"] = 8
                        item["is_relevant"] = True
                        item["relevance_reason"] = "Directly relevant method and findings"
                        item["matched_criteria"] = ["methodology"]
                    else:
                        item["relevance_score"] = 4
                        item["is_relevant"] = False
                        item["relevance_reason"] = "Weak relevance, tangential domain"
                        item["matched_criteria"] = []
                    screened_list.append(item)
                return screened_list

            mock_screen.side_effect = mock_screener_side_effect

            result = iterative_search_and_screen(
                research_objective="Specific deep learning task",
                target_count=10,
                batch_size=15,
                max_candidates_to_screen=30,
                min_score=7,
            )

            # STRICT VERIFICATION:
            # 1. Returned papers must be exactly 6, NOT 10
            self.assertEqual(len(result["papers"]), 6)
            self.assertEqual(result["papers_found"], 6)
            self.assertEqual(result["target_count"], 10)
            self.assertEqual(result["search_status"], "search_exhausted")
            
            # 2. Every single returned paper must have relevance_score >= 7
            for p in result["papers"]:
                self.assertGreaterEqual(p["relevance_score"], 7)

    @patch("arxiv_service.fetch_arxiv_candidates")
    def test_multi_batch_retrieval_reaches_target(self, mock_fetch, mock_query, mock_oa):
        """
        Test that when Batch 1 yields only 3 relevant papers, the pipeline continues
        to Batch 2 and successfully reaches target count (5 papers).
        """
        batch1 = [
            {"paper_id": f"2401.{100+i}", "title": f"B1 Title {i}", "summary": f"Abstract {i}", "published": "2024-01-01"}
            for i in range(5)
        ]
        batch2 = [
            {"paper_id": f"2401.{200+i}", "title": f"B2 Title {i}", "summary": f"Abstract {i}", "published": "2024-01-01"}
            for i in range(5)
        ]
        batches = [batch1, batch2]
        call_count = [0]
        def fetch_mock(*args, **kwargs):
            if call_count[0] < len(batches):
                res = batches[call_count[0]]
                call_count[0] += 1
                return res
            return []
        mock_fetch.side_effect = fetch_mock

        with patch("arxiv_service.screen_candidates") as mock_screen:
            def screener_mock(research_objective, candidates, api_key=None, min_score=7):
                res = []
                for c in candidates:
                    item = dict(c)
                    score = 8 if c["paper_id"] in ["2401.100", "2401.101", "2401.102", "2401.200", "2401.201", "2401.202"] else 3
                    item["relevance_score"] = score
                    item["is_relevant"] = (score >= min_score)
                    item["relevance_reason"] = "Evaluated"
                    res.append(item)
                return res

            mock_screen.side_effect = screener_mock

            result = iterative_search_and_screen(
                research_objective="Target topic",
                target_count=5,
                batch_size=5,
                max_candidates_to_screen=20,
                min_score=7,
            )

            self.assertGreaterEqual(result["papers_found"], 5)
            self.assertEqual(result["search_status"], "target_reached")

    @patch("arxiv_service.fetch_arxiv_candidates")
    def test_deduplication_across_arxiv_versions(self, mock_fetch, mock_query, mock_oa):
        """
        Verify that papers with same normalized arXiv id (e.g., 2401.0001v1 and 2401.0001v2)
        are deduplicated and not counted twice.
        """
        candidates = [
            {"paper_id": "2401.0001v1", "title": "Paper Version 1", "summary": "Same paper v1", "published": "2024-01-01"},
            {"paper_id": "2401.0001v2", "title": "Paper Version 2", "summary": "Same paper v2", "published": "2024-01-02"},
            {"paper_id": "2401.0002v1", "title": "Paper Two", "summary": "Different paper", "published": "2024-01-01"},
        ]
        called = [False]
        def fetch_mock(*args, **kwargs):
            if not called[0]:
                called[0] = True
                return candidates
            return []
        mock_fetch.side_effect = fetch_mock

        with patch("arxiv_service.screen_candidates") as mock_screen:
            def screener_mock(research_objective, candidates, api_key=None, min_score=7):
                res = []
                for c in candidates:
                    item = dict(c)
                    item["relevance_score"] = 9
                    item["is_relevant"] = True
                    item["relevance_reason"] = "Very relevant"
                    res.append(item)
                return res

            mock_screen.side_effect = screener_mock

            result = iterative_search_and_screen(
                research_objective="Topic",
                target_count=5,
                batch_size=5,
                max_candidates_to_screen=10,
                min_score=7,
            )

            # 2401.0001v2 should be deduplicated, so only 2 unique papers returned
            self.assertEqual(len(result["papers"]), 2)
            paper_ids = [p["paper_id"] for p in result["papers"]]
            self.assertIn("2401.0001v1", paper_ids)
            self.assertIn("2401.0002v1", paper_ids)


class TestOpenAlexAndDownload(unittest.TestCase):

    @patch("requests.get")
    def test_fetch_openalex_candidates_enforces_oa_and_avoids_ieee_paywall(self, mock_get):
        from arxiv_service import fetch_openalex_candidates

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [
                {
                    "id": "https://openalex.org/W1000",
                    "title": "Deep Learning with Transformers",
                    "doi": "https://doi.org/10.1109/TLA.2023.10172138",
                    "publication_year": 2023,
                    "abstract_inverted_index": {"This": [0], "paper": [1], "presents": [2], "transformer": [3], "models": [4], "for": [5], "accurate": [6], "classification": [7], "tasks": [8], "across": [9], "large": [10], "scale": [11], "datasets": [12]},
                    "open_access": {
                        "is_oa": True,
                        "oa_url": "https://oa.upm.es/76652/3/Using_Transformers_Models.pdf",
                    },
                    "best_oa_location": {
                        "pdf_url": "https://oa.upm.es/76652/3/Using_Transformers_Models.pdf",
                        "landing_page_url": "https://oa.upm.es/76652/",
                    },
                    "primary_location": {
                        "landing_page_url": "https://doi.org/10.1109/TLA.2023.10172138",
                    }
                }
            ]
        }
        mock_get.return_value = mock_resp

        candidates = fetch_openalex_candidates(query="Deep Learning", batch_size=5)
        self.assertEqual(len(candidates), 1)
        paper = candidates[0]
        # Verified that entry_url uses the open-access repository, NOT the paywalled 10.1109 IEEE DOI
        self.assertNotIn("10.1109", paper["entry_url"])
        self.assertEqual(paper["entry_url"], "https://oa.upm.es/76652/")
        self.assertEqual(paper["pdf_url"], "https://oa.upm.es/76652/3/Using_Transformers_Models.pdf")

    @patch("requests.get")
    def test_download_paper_direct_pdf_url(self, mock_get):
        import tempfile
        import shutil
        import os
        from arxiv_service import download_paper

        temp_dir = tempfile.mkdtemp()
        try:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.iter_content = MagicMock(return_value=[b"%PDF-1.5 test content" * 100])
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp

            path = download_paper(
                paper_id="oa_W1000",
                download_dir=temp_dir,
                pdf_url="https://oa.upm.es/76652/3/Using_Transformers_Models.pdf",
                title="Deep Learning with Transformers",
            )
            self.assertTrue(os.path.exists(path))
            self.assertTrue(path.endswith(".pdf"))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @patch("arxiv_service.generate_academic_query", return_value="Transformer Text")
    @patch("arxiv_service.fetch_arxiv_candidates")
    @patch("arxiv_service.fetch_openalex_candidates", return_value=[])
    @patch("arxiv_service.screen_candidates")
    def test_iterative_search_and_screen_exclude_ids(self, mock_screen, mock_oa, mock_fetch, mock_query):
        from arxiv_service import iterative_search_and_screen

        mock_fetch.return_value = [
            {"paper_id": "2401.0001", "title": "Paper One", "summary": "Abstract 1"},
            {"paper_id": "2401.0002", "title": "Paper Two", "summary": "Abstract 2"},
        ]
        mock_screen.return_value = [
            {"paper_id": "2401.0002", "title": "Paper Two", "relevance_score": 9, "is_relevant": True}
        ]

        # Pass 2401.0001 as exclude_id
        result = iterative_search_and_screen(
            research_objective="Transformer Text",
            target_count=1,
            exclude_ids=["2401.0001"],
            batch_size=5,
        )

        # 2401.0001 should be excluded completely
        returned_ids = [p["paper_id"] for p in result["papers"]]
        self.assertNotIn("2401.0001", returned_ids)
        self.assertIn("2401.0002", returned_ids)
        self.assertIn("2401.0001", result["screened_ids"])


if __name__ == "__main__":
    unittest.main()


