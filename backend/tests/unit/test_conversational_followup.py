"""Unit tests for conversational follow-up message building."""

from app.services.llm_service import _build_user_message, _format_conversation_history
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
