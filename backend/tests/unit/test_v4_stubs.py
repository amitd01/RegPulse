"""Contract tests for the v4 stub routers (S2).

These tests don't touch the database — the stubs return shape-correct empties on
reads and 501 NOT_IMPLEMENTED on writes. The point is to lock down the OpenAPI
contract so the frontend's generated client matches what the backend will
actually expose once slices 9/10 land the real impl.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.dependencies.auth import require_verified_user
from app.exceptions import (
    RegPulseException,
    generic_exception_handler,
    regpulse_exception_handler,
)
from app.models.user import User
from app.routers.annotations import flat as annotations_flat_router
from app.routers.annotations import question_scoped as annotations_question_router
from app.routers.debates import router as debates_router
from app.routers.learnings import router as learnings_router


@pytest.fixture
def stub_user() -> User:
    """Pure in-memory user object — never persisted, just satisfies the dependency."""
    return User(
        id=str(uuid.uuid4()),  # type: ignore[arg-type]
        email="verified@bigbank.com",
        email_verified=True,
        full_name="Verified User",
        credit_balance=5,
        plan="free",
        is_admin=False,
        is_active=True,
        last_login_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
async def stub_client(stub_user):
    """FastAPI app with only the v4 stub routers mounted + auth bypassed."""
    app = FastAPI()
    app.add_exception_handler(RegPulseException, regpulse_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_exception_handler)  # type: ignore[arg-type]
    app.dependency_overrides[require_verified_user] = lambda: stub_user

    app.include_router(learnings_router, prefix="/api/v1/learnings")
    app.include_router(debates_router, prefix="/api/v1/debates")
    app.include_router(annotations_question_router, prefix="/api/v1/questions")
    app.include_router(annotations_flat_router, prefix="/api/v1/annotations")

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Learnings
# ---------------------------------------------------------------------------


# Learnings stubs replaced by real implementation in slice 9b.
# See backend/tests/unit/test_learnings.py for the live-router tests.


class _RemovedLearningsStub:
    """Placeholder — original stub tests deleted with S9b real implementation."""


# ---------------------------------------------------------------------------
# Debates
# ---------------------------------------------------------------------------


class TestStructuredFeedbackContract:
    def test_feedback_request_accepts_categories(self):
        from app.schemas.questions import FeedbackRequest

        fb = FeedbackRequest(
            feedback=-1,
            comment="The cited circular doesn't actually say that",
            categories=["MISINTERPRETED_CITATION", "CONFIDENCE_OFF"],
        )
        assert fb.categories == ["MISINTERPRETED_CITATION", "CONFIDENCE_OFF"]

    def test_feedback_request_categories_optional(self):
        from app.schemas.questions import FeedbackRequest

        fb = FeedbackRequest(feedback=1)
        assert fb.categories is None

    def test_feedback_request_caps_categories(self):
        from pydantic import ValidationError

        from app.schemas.questions import FeedbackRequest

        with pytest.raises(ValidationError):
            FeedbackRequest(feedback=-1, categories=["A"] * 7)
