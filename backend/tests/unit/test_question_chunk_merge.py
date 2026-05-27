"""Unit tests for follow-up chunk merge helpers in questions router."""

from app.routers.questions import _chunks_from_stored, _merge_chunks
from app.services.rag_service import RetrievedChunk


def test_chunks_from_stored_rehydrates():
    stored = [
        {
            "chunk_id": "abc",
            "document_id": "doc-1",
            "chunk_index": 0,
            "chunk_text": "KYC requirements apply.",
            "token_count": 12,
            "circular_number": "RBI/2024/01",
            "title": "KYC Master",
            "rbi_url": "https://rbi.org.in/kyc",
        }
    ]
    chunks = _chunks_from_stored(stored)
    assert len(chunks) == 1
    assert chunks[0].chunk_id == "abc"
    assert chunks[0].circular_number == "RBI/2024/01"


def test_merge_chunks_deduplicates_by_id():
    a = RetrievedChunk(
        chunk_id="same",
        document_id="d1",
        chunk_index=0,
        chunk_text="A",
        token_count=1,
        circular_number="RBI/1",
        title="T",
        rbi_url="https://rbi.org.in/1",
    )
    b = RetrievedChunk(
        chunk_id="other",
        document_id="d2",
        chunk_index=1,
        chunk_text="B",
        token_count=1,
        circular_number="RBI/2",
        title="T2",
        rbi_url="https://rbi.org.in/2",
    )
    c = RetrievedChunk(
        chunk_id="same",
        document_id="d1",
        chunk_index=0,
        chunk_text="A duplicate",
        token_count=1,
        circular_number="RBI/1",
        title="T",
        rbi_url="https://rbi.org.in/1",
    )
    merged = _merge_chunks([a, b], [c])
    assert [x.chunk_id for x in merged] == ["same", "other"]
    assert merged[0].chunk_text == "A"
