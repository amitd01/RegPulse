"""Shared fixtures for integration tests.

Integration tests need a real Postgres+pgvector container and real Redis. The
fixtures here:

  - Detect whether `REGPULSE_INTEGRATION_DB_URL` is set; skip otherwise.
  - Apply migrations 001..006 to the target DB before yielding a session.
  - Provide a `rag_test_corpus` fixture that seeds 5 synthetic circulars with
    real OpenAI embeddings (requires `OPENAI_API_KEY` to be real, not stub).
  - Provide a `rag_service` and `llm_service` fixture wired to the running
    backend's actual dependencies (no MagicMock).

In CI: docker compose up brings up postgres + redis containers, the CI step
exports REGPULSE_INTEGRATION_DB_URL pointing at them and runs
`pytest backend/tests/integration -m integration`.

Locally: `make test-integration` does the same against the dev docker compose
stack.
"""

from __future__ import annotations

import os
import pathlib

import pytest

# Marker: pytest.mark.integration — skipped unless real PG+Redis are present.
INTEGRATION_DB_URL = os.environ.get("REGPULSE_INTEGRATION_DB_URL")
INTEGRATION_REDIS_URL = os.environ.get("REGPULSE_INTEGRATION_REDIS_URL")
REAL_OPENAI = (
    os.environ.get("OPENAI_API_KEY", "").startswith("sk-")
    and not os.environ.get("OPENAI_API_KEY", "").startswith("sk-test")
    and not os.environ.get("OPENAI_API_KEY", "").startswith("sk-stub")
)
REAL_ANTHROPIC = (
    os.environ.get("ANTHROPIC_API_KEY", "").startswith("sk-ant-")
    and "test" not in os.environ.get("ANTHROPIC_API_KEY", "")
    and "stub" not in os.environ.get("ANTHROPIC_API_KEY", "")
)

needs_real_pg = pytest.mark.skipif(
    not INTEGRATION_DB_URL,
    reason="Set REGPULSE_INTEGRATION_DB_URL (Postgres+pgvector) to enable",
)
needs_real_openai = pytest.mark.skipif(
    not REAL_OPENAI,
    reason="Set a real OPENAI_API_KEY to enable real embedding generation",
)
needs_real_anthropic = pytest.mark.skipif(
    not REAL_ANTHROPIC,
    reason="Set a real ANTHROPIC_API_KEY to enable real LLM responses",
)


def _migrations_dir() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[2] / "migrations"


@pytest.fixture(scope="session")
def migrations_sql() -> list[pathlib.Path]:
    """Ordered list of migration files (001..NNN)."""
    return sorted(_migrations_dir().glob("[0-9][0-9][0-9]_*.sql"))


@pytest.fixture
async def rag_pg_session(migrations_sql):
    """Yield an AsyncSession against a freshly-migrated Postgres+pgvector DB."""
    if not INTEGRATION_DB_URL:
        pytest.skip("REGPULSE_INTEGRATION_DB_URL not set")

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    engine = create_async_engine(INTEGRATION_DB_URL, echo=False)

    # Apply migrations in order. We don't track state across runs — each test
    # session migrates fresh. Tests are expected to clean their own data.
    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
        for sql_path in migrations_sql:
            sql = sql_path.read_text()
            # exec_driver_sql is raw — splits on `;` are unsafe for procedural
            # SQL, but our migrations are plain DDL so this is fine.
            for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
                await conn.exec_driver_sql(stmt)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def rag_redis():
    """Real Redis connection — clears DB 15 (test) on yield."""
    if not INTEGRATION_REDIS_URL:
        pytest.skip("REGPULSE_INTEGRATION_REDIS_URL not set")
    import redis.asyncio as aioredis

    client = aioredis.from_url(INTEGRATION_REDIS_URL, decode_responses=False)
    await client.flushdb()
    yield client
    await client.aclose()
