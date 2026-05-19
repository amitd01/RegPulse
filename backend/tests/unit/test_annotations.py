"""Unit tests for Annotations router (v4 G-15 / slice 10a)."""

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
from app.routers.annotations import flat as annotations_flat_router
from app.routers.annotations import question_scoped as annotations_question_router

_TABLE_NAMES = ["users", "questions", "circular_documents", "annotations"]


def _sqlite_compat():
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


_sqlite_compat()


@pytest.fixture
async def engine():
    tables = _sqlite_compat()
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
            email="annotator@bigbank.com",
            email_verified=True,
            full_name="Anjali Sharma",
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

    app.include_router(annotations_question_router, prefix="/api/v1/questions")
    app.include_router(annotations_flat_router, prefix="/api/v1/annotations")

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
class TestAnnotations:
    async def test_empty_list_for_question(self, client):
        qid = uuid.uuid4()
        r = await client.get(f"/api/v1/questions/{qid}/annotations")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    async def test_create_then_list(self, client):
        qid = uuid.uuid4()
        payload = {
            "text_selection": "10% effective 1 April 2027",
            "note": "Verify glide-path is 3 quarters not 4",
            "anchor_offset": 42,
        }
        r = await client.post(f"/api/v1/questions/{qid}/annotations", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()["data"]
        assert body["text_selection"] == "10% effective 1 April 2027"
        assert body["note"].startswith("Verify glide-path")
        assert body["anchor_offset"] == 42
        assert body["resolved"] is False
        assert body["user_initials"] == "AS"

        rl = await client.get(f"/api/v1/questions/{qid}/annotations")
        assert rl.status_code == 200
        assert rl.json()["total"] == 1
        assert rl.json()["data"][0]["text_selection"] == "10% effective 1 April 2027"

    async def test_update_marks_resolved(self, client):
        qid = uuid.uuid4()
        r = await client.post(
            f"/api/v1/questions/{qid}/annotations",
            json={"text_selection": "abc", "note": "Initial"},
        )
        aid = r.json()["data"]["id"]

        ru = await client.patch(
            f"/api/v1/annotations/{aid}", json={"resolved": True}
        )
        assert ru.status_code == 200
        assert ru.json()["data"]["resolved"] is True

    async def test_update_note_text(self, client):
        qid = uuid.uuid4()
        r = await client.post(
            f"/api/v1/questions/{qid}/annotations",
            json={"text_selection": "abc", "note": "Initial note"},
        )
        aid = r.json()["data"]["id"]
        ru = await client.patch(
            f"/api/v1/annotations/{aid}", json={"note": "Revised note"}
        )
        assert ru.status_code == 200
        assert ru.json()["data"]["note"] == "Revised note"

    async def test_delete(self, client):
        qid = uuid.uuid4()
        r = await client.post(
            f"/api/v1/questions/{qid}/annotations",
            json={"text_selection": "abc", "note": "Throwaway"},
        )
        aid = r.json()["data"]["id"]
        rd = await client.delete(f"/api/v1/annotations/{aid}")
        assert rd.status_code == 204

        rl = await client.get(f"/api/v1/questions/{qid}/annotations")
        assert rl.json()["total"] == 0

    async def test_patch_nonexistent_returns_404(self, client):
        r = await client.patch(
            f"/api/v1/annotations/{uuid.uuid4()}", json={"resolved": True}
        )
        assert r.status_code == 404
        assert r.json()["detail"]["code"] == "ANNOTATION_NOT_FOUND"

    async def test_delete_nonexistent_returns_404(self, client):
        r = await client.delete(f"/api/v1/annotations/{uuid.uuid4()}")
        assert r.status_code == 404
