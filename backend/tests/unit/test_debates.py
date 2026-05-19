"""Unit tests for Debates router (v4 G-14 / slice 9c)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
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
from app.routers.debates import router as debates_router

_TABLE_NAMES = [
    "users",
    "questions",
    "circular_documents",
    "debates",
    "debate_replies",
]


def _sqlite_compat_tables():
    """Module-level swap, idempotent on repeat calls. Pre-rebuild pattern (still
    used in test_account.py); LR4.1 explains the MagicMock-from_attributes
    interaction this enables."""
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


# Run the swap at module load time (before any fixture-created engine), so
# subsequent test files importing User see the already-mutated column types.
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
            email="debater@bigbank.com",
            email_verified=True,
            full_name="Raghav Krishnan",
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

    app.include_router(debates_router, prefix="/api/v1/debates")

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
class TestDebates:
    async def test_empty_list(self, client):
        r = await client.get("/api/v1/debates")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0
        assert body["open_count"] == 0

    async def test_create_then_list(self, client):
        payload = {
            "title": "Leverage cap interpretation under SBR revision",
            "opening_text": "Does on-and-off-balance-sheet include securitised pools?",
            "initial_stance": "NEUTRAL",
        }
        r = await client.post("/api/v1/debates", json=payload)
        assert r.status_code == 201
        body = r.json()["data"]
        assert body["title"].startswith("Leverage cap")
        assert body["status"] == "OPEN"
        assert body["reply_count"] == 0

        rl = await client.get("/api/v1/debates")
        assert rl.status_code == 200
        assert rl.json()["total"] == 1
        assert rl.json()["open_count"] == 1

    async def test_reply_increments_stance_counts(self, client):
        # Create
        r = await client.post(
            "/api/v1/debates",
            json={
                "title": "PSL climate-adaptive — additive or carve-out?",
                "opening_text": "Reading paragraph 4 of RBI/2024-25/.. ",
            },
        )
        did = r.json()["data"]["id"]

        # Two AGREE + one DISAGREE replies
        for stance in ("AGREE", "AGREE", "DISAGREE"):
            rp = await client.post(
                f"/api/v1/debates/{did}/reply",
                json={"text": f"My take ({stance})", "stance": stance},
            )
            assert rp.status_code == 200, f"reply failed: {rp.status_code} {rp.text}"

        # Detail reflects counts
        rd = await client.get(f"/api/v1/debates/{did}")
        body = rd.json()["data"]
        assert body["reply_count"] == 3
        assert body["agree_count"] == 2
        assert body["disagree_count"] == 1
        assert len(body["replies"]) == 3

    async def test_resolve(self, client):
        r = await client.post(
            "/api/v1/debates",
            json={"title": "Test debate one", "opening_text": "Some opening text"},
        )
        assert r.status_code == 201, r.text
        did = r.json()["data"]["id"]

        rr = await client.patch(
            f"/api/v1/debates/{did}/resolve",
            json={"resolution_text": "Agreed with the disagree side — pools excluded."},
        )
        assert rr.status_code == 200
        body = rr.json()["data"]
        assert body["status"] == "RESOLVED"
        assert body["resolution_text"].startswith("Agreed")
        assert body["resolved_at"] is not None

        # Open count should now be 0
        rl = await client.get("/api/v1/debates")
        assert rl.json()["open_count"] == 0

    async def test_reply_to_resolved_returns_409(self, client):
        r = await client.post(
            "/api/v1/debates",
            json={"title": "Test debate resolved", "opening_text": "Opening"},
        )
        assert r.status_code == 201, r.text
        did = r.json()["data"]["id"]
        await client.patch(
            f"/api/v1/debates/{did}/resolve",
            json={"resolution_text": "Resolved."},
        )
        rr = await client.post(
            f"/api/v1/debates/{did}/reply",
            json={"text": "Another reply", "stance": "AGREE"},
        )
        assert rr.status_code == 409
        assert rr.json()["detail"]["code"] == "DEBATE_RESOLVED"

    async def test_get_nonexistent_404(self, client):
        r = await client.get(f"/api/v1/debates/{uuid.uuid4()}")
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "DEBATE_NOT_FOUND"

    async def test_status_filter(self, client):
        # Create + resolve one; create another and leave OPEN
        r1 = await client.post(
            "/api/v1/debates",
            json={"title": "First debate", "opening_text": "Opening one"},
        )
        assert r1.status_code == 201, f"create failed: {r1.status_code} {r1.text}"
        await client.patch(
            f"/api/v1/debates/{r1.json()['data']['id']}/resolve",
            json={"resolution_text": "Done."},
        )
        r2 = await client.post(
            "/api/v1/debates",
            json={"title": "Second debate", "opening_text": "Opening two"},
        )
        assert r2.status_code == 201, f"second create: {r2.status_code} {r2.text}"

        ro = await client.get("/api/v1/debates", params={"status": "OPEN"})
        assert ro.json()["total"] == 1
        assert ro.json()["data"][0]["title"] == "Second debate"

        rr = await client.get("/api/v1/debates", params={"status": "RESOLVED"})
        assert rr.json()["total"] == 1
        assert rr.json()["data"][0]["title"] == "First debate"
