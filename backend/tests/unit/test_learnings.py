"""Unit tests for Learnings router (v4 G-13 / slice 9b).

Exercises the real implementation against SQLite + fakeredis. The router
talks to `learnings` only; no LLM or vector ops involved.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import String, event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.cache import get_redis
from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.exceptions import (
    RegPulseException,
    generic_exception_handler,
    regpulse_exception_handler,
)
from app.models import Base
from app.models.user import User
from app.routers.learnings import router as learnings_router

_TABLE_NAMES = ["users", "questions", "circular_documents", "learnings"]


def _sqlite_compat_tables():
    """Module-level swap, idempotent on repeat calls."""
    """Build SQLite-friendly copies of the tables we need."""
    tables = []
    for name in _TABLE_NAMES:
        if name not in Base.metadata.tables:
            continue
        t = Base.metadata.tables[name]
        for col in t.columns:
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
                sd = str(col.server_default.arg) if col.server_default.arg else ""
                if "now()" in sd or "'[]'::jsonb" in sd:
                    col.server_default = None  # type: ignore[assignment]
        tables.append(t)
    return tables


# Run the swap at module load time so subsequent test files see the mutated
# column types (avoids fixture-ordering interference).
_sqlite_compat_tables()


@pytest.fixture
async def engine():
    tables = _sqlite_compat_tables()
    eng = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(eng.sync_engine, "connect")
    def _pragma(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=tables)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all, tables=tables)
    await eng.dispose()


@pytest.fixture
async def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def test_user(session_factory) -> User:
    async with session_factory() as s:
        u = User(
            id=str(uuid.uuid4()),  # type: ignore[arg-type]
            email="learner@bigbank.com",
            email_verified=True,
            full_name="Priya Menon",
            credit_balance=10,
            plan="pro",
            is_admin=False,
            is_active=True,
            last_login_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


@pytest.fixture
async def client(session_factory, test_user, fake_redis):
    app = FastAPI()
    app.add_exception_handler(RegPulseException, regpulse_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_exception_handler)  # type: ignore[arg-type]

    async def _db():
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_redis] = lambda: fake_redis
    app.dependency_overrides[require_verified_user] = lambda: test_user

    app.include_router(learnings_router, prefix="/api/v1/learnings")

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
class TestLearnings:
    async def test_empty_state(self, client):
        r = await client.get("/api/v1/learnings")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    async def test_stats_empty(self, client):
        r = await client.get("/api/v1/learnings/stats")
        assert r.status_code == 200
        assert r.json()["data"] == {"total": 0, "this_week": 0, "contributors": 0}

    async def test_create_then_list(self, client):
        payload = {
            "title": "PSL climate-adaptive sub-target is additive, not a carve-out",
            "note": "Confirmed via bilateral with RBI DGBR on 19 Apr.",
            "tags": ["PSL", "Agri"],
            "notify_team": False,
        }
        r = await client.post("/api/v1/learnings", json=payload)
        assert r.status_code == 201
        body = r.json()
        assert body["data"]["title"].startswith("PSL climate-adaptive")
        assert body["data"]["tags"] == ["PSL", "Agri"]
        assert body["data"]["pinned"] is False
        assert body["data"]["user_initials"] == "PM"

        # List should now show 1
        r2 = await client.get("/api/v1/learnings")
        assert r2.status_code == 200
        assert r2.json()["total"] == 1
        assert r2.json()["data"][0]["title"].startswith("PSL")

    async def test_stats_after_create(self, client):
        await client.post(
            "/api/v1/learnings",
            json={"title": "One-liner about SBR glide path"},
        )
        r = await client.get("/api/v1/learnings/stats")
        assert r.status_code == 200
        body = r.json()["data"]
        assert body["total"] == 1
        assert body["this_week"] == 1
        assert body["contributors"] == 1

    async def test_pin_and_get(self, client):
        r = await client.post(
            "/api/v1/learnings",
            json={"title": "Tier-1 floor revised to 10% for UL NBFCs"},
        )
        lid = r.json()["data"]["id"]

        # Pin
        rp = await client.post(f"/api/v1/learnings/{lid}/pin")
        assert rp.status_code == 200
        assert rp.json()["data"]["pinned"] is True

        # Get returns the pinned row
        rg = await client.get(f"/api/v1/learnings/{lid}")
        assert rg.status_code == 200
        assert rg.json()["data"]["pinned"] is True

        # Toggle off
        rp2 = await client.post(f"/api/v1/learnings/{lid}/pin")
        assert rp2.status_code == 200
        assert rp2.json()["data"]["pinned"] is False

    async def test_update(self, client):
        r = await client.post(
            "/api/v1/learnings",
            json={"title": "Initial title"},
        )
        lid = r.json()["data"]["id"]

        ru = await client.patch(
            f"/api/v1/learnings/{lid}",
            json={"title": "Updated title", "tags": ["NEW"]},
        )
        assert ru.status_code == 200
        body = ru.json()["data"]
        assert body["title"] == "Updated title"
        assert body["tags"] == ["NEW"]

    async def test_delete(self, client):
        r = await client.post(
            "/api/v1/learnings", json={"title": "Throwaway"}
        )
        lid = r.json()["data"]["id"]

        rd = await client.delete(f"/api/v1/learnings/{lid}")
        assert rd.status_code == 204

        # Now 404
        rg = await client.get(f"/api/v1/learnings/{lid}")
        assert rg.status_code == 404
        assert rg.json()["detail"]["code"] == "LEARNING_NOT_FOUND"

    async def test_get_nonexistent_404(self, client):
        r = await client.get(f"/api/v1/learnings/{uuid.uuid4()}")
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "LEARNING_NOT_FOUND"

    async def test_pinned_filter(self, client):
        r1 = await client.post(
            "/api/v1/learnings", json={"title": "Plain learning"}
        )
        r2 = await client.post(
            "/api/v1/learnings", json={"title": "Pinned learning"}
        )
        # Pin the second one
        await client.post(f"/api/v1/learnings/{r2.json()['data']['id']}/pin")

        rp = await client.get("/api/v1/learnings", params={"pinned": "true"})
        assert rp.status_code == 200
        rows = rp.json()["data"]
        assert len(rows) == 1
        assert rows[0]["title"] == "Pinned learning"
