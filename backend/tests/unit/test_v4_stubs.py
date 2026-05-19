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


class TestLearningsStub:
    @pytest.mark.asyncio
    async def test_list_returns_empty_envelope(self, stub_client):
        r = await stub_client.get("/api/v1/learnings")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"] == []
        assert body["total"] == 0

    @pytest.mark.asyncio
    async def test_stats_returns_zeros(self, stub_client):
        r = await stub_client.get("/api/v1/learnings/stats")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"] == {"total": 0, "this_week": 0, "contributors": 0}

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self, stub_client):
        r = await stub_client.get(f"/api/v1/learnings/{uuid.uuid4()}")
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "LEARNING_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_create_returns_501(self, stub_client):
        r = await stub_client.post(
            "/api/v1/learnings",
            json={"title": "PSL climate-adaptive sub-target is additive"},
        )
        assert r.status_code == 501
        assert r.json()["detail"]["code"] == "NOT_IMPLEMENTED_LEARNINGS"

    @pytest.mark.asyncio
    async def test_pin_returns_501(self, stub_client):
        r = await stub_client.post(f"/api/v1/learnings/{uuid.uuid4()}/pin")
        assert r.status_code == 501

    @pytest.mark.asyncio
    async def test_validation_rejects_short_title(self, stub_client):
        r = await stub_client.post("/api/v1/learnings", json={"title": "x"})
        assert r.status_code == 422  # FastAPI validation, contract enforced


# ---------------------------------------------------------------------------
# Debates
# ---------------------------------------------------------------------------


class TestDebatesStub:
    @pytest.mark.asyncio
    async def test_list_returns_empty(self, stub_client):
        r = await stub_client.get("/api/v1/debates")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"] == []
        assert body["open_count"] == 0

    @pytest.mark.asyncio
    async def test_list_with_status_filter(self, stub_client):
        r = await stub_client.get("/api/v1/debates?status=OPEN")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_returns_404(self, stub_client):
        r = await stub_client.get(f"/api/v1/debates/{uuid.uuid4()}")
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "DEBATE_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_create_returns_501(self, stub_client):
        r = await stub_client.post(
            "/api/v1/debates",
            json={
                "title": "Leverage cap interpretation under SBR revision",
                "opening_text": "Does on-and-off-balance-sheet include securitised pools?",
            },
        )
        assert r.status_code == 501
        assert r.json()["detail"]["code"] == "NOT_IMPLEMENTED_DEBATES"

    @pytest.mark.asyncio
    async def test_reply_returns_501(self, stub_client):
        r = await stub_client.post(
            f"/api/v1/debates/{uuid.uuid4()}/reply",
            json={"text": "I disagree because...", "stance": "DISAGREE"},
        )
        assert r.status_code == 501


# ---------------------------------------------------------------------------
# Annotations
# ---------------------------------------------------------------------------


class TestAnnotationsStub:
    @pytest.mark.asyncio
    async def test_list_returns_empty(self, stub_client):
        r = await stub_client.get(f"/api/v1/questions/{uuid.uuid4()}/annotations")
        assert r.status_code == 200
        assert r.json()["data"] == []

    @pytest.mark.asyncio
    async def test_create_returns_501(self, stub_client):
        r = await stub_client.post(
            f"/api/v1/questions/{uuid.uuid4()}/annotations",
            json={"text_selection": "10% effective 1 April 2027", "note": "Verify glide-path"},
        )
        assert r.status_code == 501
        assert r.json()["detail"]["code"] == "NOT_IMPLEMENTED_ANNOTATIONS"

    @pytest.mark.asyncio
    async def test_update_returns_501(self, stub_client):
        r = await stub_client.patch(
            f"/api/v1/annotations/{uuid.uuid4()}",
            json={"resolved": True},
        )
        assert r.status_code == 501

    @pytest.mark.asyncio
    async def test_delete_returns_501(self, stub_client):
        r = await stub_client.delete(f"/api/v1/annotations/{uuid.uuid4()}")
        assert r.status_code == 501


# ---------------------------------------------------------------------------
# FeedbackRequest structured-categories contract
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
        from app.schemas.questions import FeedbackRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            FeedbackRequest(feedback=-1, categories=["A"] * 7)
