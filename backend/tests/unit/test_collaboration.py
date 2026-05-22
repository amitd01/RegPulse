"""Unit tests for team collaboration — learnings, debates, annotations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import String, event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models import Base
from app.models.collaboration import Debate, DebateReply, DebateStance, DebateStatus, TeamLearning
from app.models.question import Question
from app.models.user import User
from app.routers.annotations import router as annotations_router
from app.routers.debates import router as debates_router
from app.routers.learnings import router as learnings_router

_TABLES = [
    Base.metadata.tables[t]
    for t in (
        "users",
        "questions",
        "team_learnings",
        "debates",
        "debate_replies",
        "annotations",
        "annotation_replies",
    )
    if t in Base.metadata.tables
]


def _patch_sqlite_tables(tables):
    for tbl in tables:
        for col in tbl.columns:
            if hasattr(col.type, "as_uuid"):
                col.type = String(36)  # type: ignore[assignment]
            if type(col.type).__name__ == "Vector":
                col.type = String(36)  # type: ignore[assignment]
                col.nullable = True
            if type(col.type).__name__ == "JSONB":
                col.type = String(4000)  # type: ignore[assignment]
                col.nullable = True
            if type(col.type).__name__ == "Enum":
                col.type = String(50)  # type: ignore[assignment]
            if col.server_default is not None:
                sd_text = str(col.server_default.arg) if col.server_default.arg else ""
                if "now()" in sd_text or "'[]'::jsonb" in sd_text:
                    col.server_default = None  # type: ignore[assignment]


@pytest.fixture
async def collab_engine():
    eng = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(eng.sync_engine, "connect")
    def _pragma(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    async with eng.begin() as conn:
        _patch_sqlite_tables(_TABLES)
        await conn.run_sync(Base.metadata.create_all, tables=_TABLES)

    yield eng

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all, tables=_TABLES)
    await eng.dispose()


@pytest.fixture
async def collab_factory(collab_engine):
    return async_sessionmaker(collab_engine, expire_on_commit=False)


async def _make_user(factory, email: str, *, is_admin: bool = False) -> User:
    async with factory() as session:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            email_verified=True,
            full_name=email.split("@")[0].title(),
            credit_balance=10,
            plan="free",
            is_admin=is_admin,
            is_active=True,
            last_login_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _make_question(factory, user: User) -> Question:
    async with factory() as session:
        q = Question(
            id=str(uuid.uuid4()),
            user_id=user.id,
            question_text="What is the LCR requirement?",
            answer_text="The Liquidity Coverage Ratio must be maintained at 100%.",
            quick_answer="Maintain LCR at 100%.",
            credit_deducted=True,
            created_at=datetime.now(UTC),
        )
        session.add(q)
        await session.commit()
        await session.refresh(q)
        return q


@pytest.fixture
async def collab_users(collab_factory):
    user_a = await _make_user(collab_factory, "alice@bigbank.com")
    user_b = await _make_user(collab_factory, "bob@bigbank.com")
    outsider = await _make_user(collab_factory, "carol@otherbank.com")
    admin = await _make_user(collab_factory, "admin@bigbank.com", is_admin=True)
    return {"alice": user_a, "bob": user_b, "outsider": outsider, "admin": admin}


@pytest.fixture
async def collab_client(collab_factory, collab_users):
    current = {"user": collab_users["alice"]}

    app = FastAPI()

    async def _get_db():
        async with collab_factory() as s:
            yield s

    async def _get_user():
        return current["user"]

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[require_verified_user] = _get_user
    app.include_router(learnings_router, prefix="/api/v1/learnings")
    app.include_router(debates_router, prefix="/api/v1/debates")
    app.include_router(annotations_router, prefix="/api/v1/annotations")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, current


@pytest.mark.asyncio
async def test_learning_org_sharing_and_pin(collab_client, collab_users):
    client, current = collab_client

    resp = await client.post(
        "/api/v1/learnings",
        json={"title": "LCR tip", "note": "Always check HQLA composition.", "tags": ["LCR", "liquidity"]},
    )
    assert resp.status_code == 201
    learning_id = resp.json()["id"]

    current["user"] = collab_users["bob"]
    listed = await client.get("/api/v1/learnings")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["title"] == "LCR tip"

    current["user"] = collab_users["outsider"]
    outsider_list = await client.get("/api/v1/learnings")
    assert outsider_list.json()["total"] == 0

    current["user"] = collab_users["alice"]
    pin = await client.post(f"/api/v1/learnings/{learning_id}/pin", json={"pinned": True})
    assert pin.status_code == 200
    assert pin.json()["is_pinned"] is True

    stats = await client.get("/api/v1/learnings/stats")
    assert stats.status_code == 200
    assert stats.json()["total"] == 1
    assert stats.json()["pinned_count"] == 1


@pytest.mark.asyncio
async def test_debate_resolve_and_lock(collab_client, collab_users):
    client, current = collab_client

    created = await client.post(
        "/api/v1/debates",
        json={"title": "LCR debate", "description": "Is 100% LCR sufficient?"},
    )
    assert created.status_code == 201
    debate_id = created.json()["data"]["id"]

    current["user"] = collab_users["bob"]
    reply = await client.post(
        f"/api/v1/debates/{debate_id}/replies",
        json={"content": "Yes, RBI mandates it.", "stance": "AGREE"},
    )
    assert reply.status_code == 201

    resolve_denied = await client.post(
        f"/api/v1/debates/{debate_id}/resolve",
        json={"final_decision": "We adopt 100% LCR."},
    )
    assert resolve_denied.status_code == 200
    assert resolve_denied.json()["success"] is False

    current["user"] = collab_users["alice"]
    resolved = await client.post(
        f"/api/v1/debates/{debate_id}/resolve",
        json={"final_decision": "Team adopts 100% LCR with monthly review."},
    )
    assert resolved.status_code == 200
    assert resolved.json()["data"]["status"] == "RESOLVED"

    locked = await client.post(
        f"/api/v1/debates/{debate_id}/replies",
        json={"content": "Late reply", "stance": "DISAGREE"},
    )
    assert locked.status_code == 200
    assert locked.json()["code"] == "DEBATE_LOCKED"


@pytest.mark.asyncio
async def test_org_teammate_can_view_source_question(collab_factory, collab_users):
    """Teammates can open a learning's linked Q&A (same email domain)."""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.dependencies.auth import require_verified_user
    from app.routers.questions import router as questions_router

    question = await _make_question(collab_factory, collab_users["alice"])
    current = {"user": collab_users["bob"]}

    app = FastAPI()

    async def _get_db():
        async with collab_factory() as s:
            yield s

    async def _get_user():
        return current["user"]

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[require_verified_user] = _get_user
    app.include_router(questions_router, prefix="/api/v1/questions")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/api/v1/questions/{question.id}")

    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(question.id)

    current["user"] = collab_users["outsider"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        blocked = await client.get(f"/api/v1/questions/{question.id}")

    assert blocked.status_code == 404


@pytest.mark.asyncio
async def test_annotations_org_scoped(collab_client, collab_factory, collab_users):
    client, current = collab_client
    question = await _make_question(collab_factory, collab_users["alice"])

    create = await client.post(
        "/api/v1/annotations",
        json={
            "question_id": str(question.id),
            "selected_text": "100%",
            "note": "Key threshold",
            "start_offset": 45,
            "end_offset": 48,
            "anchor_path": ["p", "0"],
        },
    )
    assert create.status_code == 201
    ann_id = create.json()["id"]

    current["user"] = collab_users["bob"]
    listed = await client.get("/api/v1/annotations", params={"question_id": str(question.id)})
    assert listed.status_code == 200
    assert len(listed.json()["data"]) == 1

    reply = await client.post(
        f"/api/v1/annotations/{ann_id}/replies",
        json={"content": "Agreed — cite RBI circular too."},
    )
    assert reply.status_code == 201

    current["user"] = collab_users["outsider"]
    blocked = await client.get("/api/v1/annotations", params={"question_id": str(question.id)})
    assert blocked.json()["success"] is False
