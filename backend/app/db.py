"""Async SQLAlchemy engine, session factory, and get_db() dependency."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

_settings = get_settings()

# Pool args only apply to connection-pooling drivers (e.g. asyncpg), not SQLite.
_pool_kwargs: dict = {}
if "sqlite" not in _settings.DATABASE_URL:
    _pool_kwargs = {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}

engine = create_async_engine(
    _settings.DATABASE_URL,
    echo=(_settings.ENVIRONMENT == "dev"),
    **_pool_kwargs,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an AsyncSession and auto-closes."""
    async with async_session_factory() as session:
        yield session
