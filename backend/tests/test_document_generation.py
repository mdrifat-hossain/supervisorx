import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.intent_router import route_user_intent
from services.document_models import (
    StructuredDocument,
    SectionModel,
    ContentBlock,
    CitationMetadata,
    parse_markdown_to_document,
)
from services.docx_generator import generate_docx_document
from services.pdf_generator import generate_pdf_document
from services.document_service import store_document_files, get_document_file_path

def test_intent_routing():
    print("\n--- TEST 1: Document Intent Routing ---")
    doc_queries = [
        ("Give me this answer as a PDF", "pdf"),
        ("Summarize all eligible analyzed papers and give me a PDF", "pdf"),
        ("Create a detailed DOCX summary of this paper", "docx"),
        ("Generate a Word document containing this summary", "docx"),
        ("Turn your previous answer into a professionally formatted Word document", "docx"),
        ("Compare these papers in a Word document", "docx"),
    ]
    for q, expected_format in doc_queries:
        res = route_user_intent(q)
        print(f"Query: '{q}' -> Intent: {res.intent}, Format: {getattr(res, 'requested_format', None)}")
        assert res.intent == "generate_document", f"Expected 'generate_document' for '{q}', got {res.intent}"

    # Verify normal queries do NOT trigger document generation
    normal_queries = [
        "Find papers related to lung cancer risk prediction",
        "Explain the methodology of this paper",
        "Summarize this paper",
        "Compare the methodologies of these three papers",
    ]
    for q in normal_queries:
        res = route_user_intent(q)
        assert res.intent != "generate_document", f"Normal query '{q}' incorrectly routed to generate_document!"
    print("Normal queries correctly preserved without file generation triggers.")

def test_structured_document_and_equations():
    print("\n--- TEST 2: Structured Document & Equation Preservation ---")
    latex_eq = r"O\left(\frac{2^{\frac{23}{24} \omega(\Delta_K)}}{\omega(\Delta_K)!}\right)"
    markdown_content = f"""# Comprehensive Analysis of Spectral Gating

## 1. Executive Summary
This report analyzes dynamic gating in sparse transformer architectures.

## 2. Mathematical Formalism
The asymptotic error bound for the multi-head self-attention approximation is given by:

$${latex_eq}$$

In inline prose, the error term ${latex_eq}$ remains bounded under regularized conditions [1].

| Architecture | Sparsity | Error Bound | Speedup |
| :--- | :--- | :--- | :--- |
| Standard Softmax | 0% | 0.00 | 1.0x |
| Dynamic GSA | 68% | <0.02 | 2.4x |
| Block-Sparse | 50% | 0.05 | 1.8x |

### Key Observations
- Linearized attention preserves representation capacity.
- Peak GPU memory is reduced by 42%.

> **Note:** The error bound holds strictly when rank constraints are satisfied.
"""

    citations = [
        CitationMetadata(
            index=1,
            paper_id="2305.18290",
            paper_title="Empirical Study of LayerNorm Entropy Trajectories",
            authors="Dupont & Klein (2023)",
            section_title="4. Complexity Bounds",
            page_label="PDF Page 7",
            claim_supported="Asymptotic error term bound holds under spectral regularization."
        )
    ]

    doc = parse_markdown_to_document(
        title="Comprehensive Analysis of Spectral Gating",
        text=markdown_content,
        document_type="paper_summary",
        format_type="pdf",
        citations=citations
    )

    assert doc.title == "Comprehensive Analysis of Spectral Gating"
    assert len(doc.sections) >= 2
    # Verify equation block was extracted
    all_blocks = [b for sec in doc.sections for b in sec.blocks]
    eq_blocks = [b for b in all_blocks if b.type == "equation"]
    assert len(eq_blocks) >= 1, "Expected at least 1 equation block"
    assert "omega" in eq_blocks[0].latex or "Delta_K" in eq_blocks[0].latex, "LaTeX equation content mismatch"
    print(f"Parsed {len(doc.sections)} sections and {len(eq_blocks)} equation block(s) successfully.")
    return doc

def test_docx_and_pdf_rendering(doc: StructuredDocument):
    print("\n--- TEST 3: DOCX and PDF Rendering ---")
    docx_bytes = generate_docx_document(doc)
    assert len(docx_bytes) > 2000, f"DOCX generation output too small ({len(docx_bytes)} bytes)"
    print(f"DOCX Report successfully generated: {len(docx_bytes):,} bytes")

    pdf_bytes = generate_pdf_document(doc)
    assert len(pdf_bytes) > 2000, f"PDF generation output too small ({len(pdf_bytes)} bytes)"
    print(f"PDF Report successfully generated: {len(pdf_bytes):,} bytes")

    # Store files via document service
    doc_id = "test_doc_001"
    store_document_files(
        project_id="test-project",
        doc_id=doc_id,
        pdf_bytes=pdf_bytes,
        docx_bytes=docx_bytes
    )

    # Verify retrieval of saved files
    pdf_path = get_document_file_path("test-project", doc_id, "pdf")
    docx_path = get_document_file_path("test-project", doc_id, "docx")
    assert pdf_path is not None and os.path.exists(pdf_path), "Saved PDF file missing on disk"
    assert docx_path is not None and os.path.exists(docx_path), "Saved DOCX file missing on disk"
    print(f"Saved document verification passed.\n - PDF: {pdf_path} ({os.path.getsize(pdf_path):,} bytes)\n - DOCX: {docx_path} ({os.path.getsize(docx_path):,} bytes)")

def run_all_tests():
    print("==================================================")
    print("RUNNING SUPERVISORX DOCUMENT GENERATION TEST SUITE")
    print("==================================================")
    test_intent_routing()
    doc = test_structured_document_and_equations()
    test_docx_and_pdf_rendering(doc)
    print("\nALL AUTOMATED DOCUMENT GENERATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_all_tests()
