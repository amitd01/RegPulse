"""Unit tests for conversational follow-up message building and fallback rules."""

from app.services.llm_service import (
    _build_user_message,
    _compute_confidence_follow_up,
    _format_conversation_history,
    _should_apply_consult_expert_fallback,
)
from app.services.rag_service import RetrievedChunk


def test_format_conversation_history_includes_turns():
    text = _format_conversation_history([("What is KYC?", "KYC requires...")])
    assert "Turn 1" in text
    assert "What is KYC?" in text
    assert "KYC requires" in text


def test_build_user_message_with_history():
    msg = _build_user_message(
        "Does this apply to NBFCs?",
        [],
        conversation_history=[("What is KYC?", "KYC norms apply.")],
    )
    assert "Prior conversation" in msg
    assert "follow-up question" in msg
    assert "Does this apply to NBFCs?" in msg


def test_build_user_message_without_history():
    chunk = RetrievedChunk(
        chunk_id="c1",
        document_id="d1",
        chunk_index=0,
        chunk_text="Sample regulatory text.",
        token_count=10,
        circular_number="RBI/2024/01",
        title="Test Circular",
        rbi_url="https://rbi.org.in/example",
    )
    msg = _build_user_message("What is KYC?", [chunk])
    assert "Prior conversation" not in msg
    assert "RBI/2024/01" in msg


def test_follow_up_skips_consult_expert_when_answer_and_history():
    history = [("What is KYC?", "KYC norms apply to banks.")]
    validated = {
        "detailed_interpretation": "For NBFCs, the same KYC principles apply with asset-tier nuances.",
        "citations": [],
        "confidence_score": 0.4,
    }
    chunks = _make_chunk_list(1)
    confidence = _compute_confidence_follow_up(validated, chunks, history)
    assert confidence >= 0.5
    assert not _should_apply_consult_expert_fallback(
        confidence=confidence,
        validated=validated,
        chunks=chunks,
        is_follow_up=True,
        conversation_history=history,
    )


def test_follow_up_still_fallback_without_chunks_or_answer():
    history = [("What is KYC?", "KYC norms apply.")]
    validated = {"detailed_interpretation": "", "citations": []}
    assert _should_apply_consult_expert_fallback(
        confidence=0.1,
        validated=validated,
        chunks=[],
        is_follow_up=True,
        conversation_history=history,
    )


def _make_chunk_list(n: int) -> list[RetrievedChunk]:
    return [
        RetrievedChunk(
            chunk_id=f"c{i}",
            document_id=f"d{i}",
            chunk_index=i,
            chunk_text="Regulatory excerpt.",
            token_count=10,
            circular_number="RBI/2024/01",
            title="Test",
            rbi_url="https://rbi.org.in/test",
        )
        for i in range(n)
    ]
