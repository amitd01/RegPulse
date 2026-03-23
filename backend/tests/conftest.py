"""Shared test fixtures for backend tests."""

from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
from app.models.circular import CircularDocument, CircularStatus, DocType, DocumentChunk, ImpactLevel
from app.models.user import User


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """In-memory SQLite async session for unit tests.

    NOTE: pgvector and PostgreSQL-specific features are NOT available.
    Use integration tests with a real PostgreSQL for those.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def sample_user(async_session: AsyncSession) -> User:
    """Create a sample verified user."""
    user = User(
        id=uuid.uuid4(),
        email="test@acmebank.com",
        email_verified=True,
        full_name="Test User",
        credit_balance=10,
        plan="pro",
        is_admin=False,
        is_active=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_circulars(async_session: AsyncSession) -> list[CircularDocument]:
    """Create sample circulars for testing."""
    circulars = [
        CircularDocument(
            id=uuid.uuid4(),
            circular_number="RBI/2024-25/01",
            title="Master Direction on KYC Requirements for Banks",
            doc_type=DocType.MASTER_DIRECTION,
            department="Department of Regulation",
            issued_date=date(2024, 6, 15),
            effective_date=date(2024, 7, 1),
            rbi_url="https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=11566",
            status=CircularStatus.ACTIVE,
            impact_level=ImpactLevel.HIGH,
            action_deadline=date(2024, 9, 30),
            affected_teams=["Compliance", "Operations", "Risk"],
            tags=["KYC", "AML", "Customer Due Diligence"],
            regulator="RBI",
        ),
        CircularDocument(
            id=uuid.uuid4(),
            circular_number="RBI/2024-25/02",
            title="Guidelines on Digital Lending",
            doc_type=DocType.CIRCULAR,
            department="Department of Regulation",
            issued_date=date(2024, 5, 10),
            effective_date=date(2024, 6, 1),
            rbi_url="https://rbi.org.in/Scripts/NotificationUser.aspx?Id=12345",
            status=CircularStatus.ACTIVE,
            impact_level=ImpactLevel.MEDIUM,
            affected_teams=["Digital Banking", "Compliance"],
            tags=["Digital Lending", "Fintech"],
            regulator="RBI",
        ),
        CircularDocument(
            id=uuid.uuid4(),
            circular_number="RBI/2023-24/98",
            title="Scale Based Regulation Framework for NBFCs",
            doc_type=DocType.CIRCULAR,
            department="Department of Non-Banking Supervision",
            issued_date=date(2023, 12, 1),
            rbi_url="https://rbi.org.in/Scripts/NotificationUser.aspx?Id=12300",
            status=CircularStatus.SUPERSEDED,
            impact_level=ImpactLevel.HIGH,
            affected_teams=["Risk", "Compliance"],
            tags=["NBFC", "SBR"],
            regulator="RBI",
        ),
        CircularDocument(
            id=uuid.uuid4(),
            circular_number="RBI/2024-25/03",
            title="Notification on Priority Sector Lending Targets",
            doc_type=DocType.NOTIFICATION,
            department="Department of Priority Sector Lending",
            issued_date=date(2024, 8, 20),
            rbi_url="https://rbi.org.in/Scripts/NotificationUser.aspx?Id=12400",
            status=CircularStatus.ACTIVE,
            impact_level=ImpactLevel.LOW,
            affected_teams=["Lending", "Agriculture Finance"],
            tags=["PSL", "Agriculture"],
            regulator="RBI",
        ),
    ]

    for c in circulars:
        async_session.add(c)
    await async_session.commit()

    for c in circulars:
        await async_session.refresh(c)

    return circulars
