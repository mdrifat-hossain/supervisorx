import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.rag_service import answer_research_question, get_eligible_analyzed_papers
from services.paper_comparator import compare_analyzed_papers
from services.paper_summarizer import summarize_analyzed_papers
from services.intent_router import route_user_intent

def run_tests():
    proj_id = "nlp-related-research-work-xxyjo"
    papers = get_eligible_analyzed_papers(proj_id)
    print(f"Eligible analyzed papers in {proj_id}: {len(papers)}")
    for p in papers:
        print(f" - [{p['paper_id']}] {p['title'][:45]}... (chunks: {p['chunks_count']}, vectors: {p['vectors_count']})")

    # 1. Router
    print("\n--- TEST 1: Intent Router ---")
    r1 = route_user_intent("Find 5 recent papers on transformer attention")
    assert r1.intent == "paper_search", f"Expected paper_search, got {r1.intent}"
    print("Search query correctly routed to:", r1.intent)

    r2 = route_user_intent("What is the dynamic gating mechanism in Gated Sparse Attention?")
    assert r2.intent == "paper_qa", f"Expected paper_qa, got {r2.intent}"
    print("QA query correctly routed to:", r2.intent)

    r3 = route_user_intent("Compare the analyzed papers in terms of architecture and results")
    assert r3.intent == "compare_papers", f"Expected compare_papers, got {r3.intent}"
    print("Compare query correctly routed to:", r3.intent)

    r4 = route_user_intent("Summarize the Gated Sparse Attention paper in simple language")
    assert r4.intent == "summarize_papers", f"Expected summarize_papers, got {r4.intent}"
    print("Summarize query correctly routed to:", r4.intent)

    # 2. Grounded Q&A
    print("\n--- TEST 2: Evidence-Grounded Q&A with Traceable Citations ---")
    qa = answer_research_question(
        project_id=proj_id,
        query="Explain how Gated Sparse Attention achieves computational efficiency without losing performance"
    )
    assert qa.success is True, "QA failed"
    assert len(qa.citations) > 0, "No citations generated"
    print(f"QA Succeeded! Citations count: {len(qa.citations)}")
    for c in qa.citations[:3]:
        print(f"  [{c.citation_index}] {c.paper_title} | Section: {c.section_title} | {c.page_label}")
        assert c.page_label.startswith("PDF Page"), f"Invalid page label: {c.page_label}"
    print("\nAnswer Excerpt:\n", qa.answer[:300])

    # 3. Summarization
    print("\n--- TEST 3: Structured Paper Summarization ---")
    summ = summarize_analyzed_papers(
        project_id=proj_id,
        query="Summarize the GSA paper"
    )
    assert summ.success is True, "Summary failed"
    assert len(summ.citations) > 0, "No citations in summary"
    print(f"Summary Succeeded! Citations count: {len(summ.citations)}")
    print("\nSummary Excerpt:\n", summ.answer[:300])

    # 4. Comparison
    print("\n--- TEST 4: Paper Comparison ---")
    comp = compare_analyzed_papers(
        project_id=proj_id,
        query="Compare the analyzed papers"
    )
    assert comp.success is True, "Comparison failed"
    print(f"Comparison Succeeded! Compared: {comp.compared_papers}")
    print("\nComparison Excerpt:\n", comp.answer[:300])

    print("\nALL WORKFLOW TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
