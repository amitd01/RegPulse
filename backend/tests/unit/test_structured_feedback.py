"""Wiring tests for structured-feedback categories (v4 G-16 / slice 9d).

The PATCH /questions/{id}/feedback endpoint persists categories alongside the
classic thumb. Until a proper schema column lands, categories are folded into
feedback_comment as a JSON envelope.

The contract is locked in `test_v4_stubs.TestStructuredFeedbackContract`. This
file additionally verifies the envelope-building logic without round-tripping
through the full SQLite test bed.
"""

from __future__ import annotations

import json

import pytest

from app.schemas.questions import FeedbackRequest


def _envelope(req: FeedbackRequest) -> str | None:
    """Replica of the route's serialisation step (router lines 544–558).

    Keep in sync with backend/app/routers/questions.py:submit_feedback.
    """
    if req.categories:
        return json.dumps({"comment": req.comment or "", "categories": req.categories})
    return req.comment


class TestFeedbackEnvelope:
    def test_plain_thumb_stores_as_bare_comment(self):
        env = _envelope(FeedbackRequest(feedback=1, comment="Spot on."))
        assert env == "Spot on."

    def test_no_categories_no_comment_stores_none(self):
        env = _envelope(FeedbackRequest(feedback=1))
        assert env is None

    def test_categories_wrap_in_json_envelope(self):
        env = _envelope(
            FeedbackRequest(
                feedback=-1,
                comment="Cited circular doesn't say that",
                categories=["MISINTERPRETED_CITATION", "CONFIDENCE_OFF"],
            )
        )
        assert env is not None
        data = json.loads(env)
        assert data["comment"].startswith("Cited circular")
        assert set(data["categories"]) == {
            "MISINTERPRETED_CITATION",
            "CONFIDENCE_OFF",
        }

    def test_categories_without_comment_envelope_has_empty_comment(self):
        env = _envelope(FeedbackRequest(feedback=-1, categories=["WRONG_TEAM"]))
        assert env is not None
        data = json.loads(env)
        assert data["categories"] == ["WRONG_TEAM"]
        assert data["comment"] == ""

    def test_categories_max_six(self):
        # Schema-level validation
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            FeedbackRequest(feedback=-1, categories=["A"] * 7)


class TestEnvelopeInverse:
    """Round-trip via json.loads to confirm consumers can decode the envelope."""

    def test_roundtrip_categories(self):
        env = _envelope(
            FeedbackRequest(
                feedback=-1,
                comment="Multi-issue feedback",
                categories=["MISSING_CIRCULAR", "UNCLEAR_LANGUAGE", "OTHER"],
            )
        )
        out = json.loads(env)  # type: ignore[arg-type]
        assert isinstance(out, dict)
        assert out["comment"] == "Multi-issue feedback"
        assert out["categories"] == [
            "MISSING_CIRCULAR",
            "UNCLEAR_LANGUAGE",
            "OTHER",
        ]
