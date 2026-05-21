"""Integration tests for /circulars/{id} and the structured-content path — S4b.2.

These tests close gap F4 from the ReBuild audit: the circular detail page
used to render `document_chunks.chunk_text` directly. Rule 16 reverses that —
retrieval shape ≠ reading shape — and migration 006 adds
`circular_documents.structured_content JSONB` populated by the dual-output
chunker (S4b.1). This suite asserts the persisted JSONB tree round-trips
through `CircularLibraryService.get_detail()` into the
`CircularDetail` Pydantic schema with the v2 renderer's expected shape.

Skipped unless `REGPULSE_INTEGRATION_DB_URL` is set — the structured_content
JSONB cast is Postgres-only and won't work against the SQLite unit suite.
"""

from __future__ import annotations

import json
import uuid

import pytest
from sqlalchemy import text

from .conftest import needs_real_pg

pytestmark = pytest.mark.asyncio


@needs_real_pg
async def test_get_detail_round_trips_structured_content(rag_pg_session):
    """A circular inserted with a structured tree must come back via the
    service in the same shape the v2 detail renderer consumes."""
    doc_id = uuid.uuid4()
    structured = {
        "version": 1,
        "blocks": [
            {"type": "heading", "level": 2, "text": "Master Direction on KYC"},
            {
                "type": "paragraph",
                "text": "All scheduled commercial banks shall update KYC for high-risk customers every 2 years.",
            },
            {
                "type": "list",
                "ordered": False,
                "items": [
                    "High-risk: every 2 years",
                    "Medium-risk: every 8 years",
                    "Low-risk: every 10 years",
                ],
            },
        ],
    }

    await rag_pg_session.execute(
        text(
            """
            INSERT INTO circular_documents (
                id, circular_number, title, rbi_url, status, doc_type,
                impact_level, pending_admin_review, regulator, upload_source,
                structured_content
            ) VALUES (
                :id, 'RBI/2026-27/TEST-KYC', 'Master Direction on KYC',
                'https://rbi.org.in/notifications/PDFs/TEST.pdf',
                'ACTIVE', 'MASTER_DIRECTION', 'HIGH', FALSE, 'RBI', 'scraper',
                CAST(:sc AS JSONB)
            )
            """
        ),
        {"id": doc_id, "sc": json.dumps(structured)},
    )
    await rag_pg_session.commit()

    from app.services.circular_library_service import CircularLibraryService

    svc = CircularLibraryService(rag_pg_session)
    circular = await svc.get_detail(doc_id)

    assert circular is not None
    assert circular.id == doc_id
    assert circular.structured_content == structured

    # Pydantic round-trip — what the route hands back to the frontend.
    from app.schemas.circulars import CircularDetail

    detail = CircularDetail.model_validate(circular)
    assert detail.structured_content is not None
    assert detail.structured_content.version == 1
    assert len(detail.structured_content.blocks) == 3
    assert detail.structured_content.blocks[0].type == "heading"
    assert detail.structured_content.blocks[0].text == "Master Direction on KYC"


@needs_real_pg
async def test_get_detail_returns_none_when_structured_content_absent(rag_pg_session):
    """OCR-fallback / legacy circulars have structured_content NULL — the v2
    renderer falls back to the 'structured preview not available' panel
    (testid `structured-content-unavailable`). The service must not invent
    a tree; the column round-trips as None."""
    doc_id = uuid.uuid4()
    await rag_pg_session.execute(
        text(
            """
            INSERT INTO circular_documents (
                id, circular_number, title, rbi_url, status, doc_type,
                impact_level, pending_admin_review, regulator, upload_source
            ) VALUES (
                :id, 'RBI/2026-27/TEST-LEGACY', 'Legacy circular (no structured)',
                'https://rbi.org.in/notifications/PDFs/LEGACY.pdf',
                'ACTIVE', 'NOTIFICATION', 'LOW', FALSE, 'RBI', 'manual_upload'
            )
            """
        ),
        {"id": doc_id},
    )
    await rag_pg_session.commit()

    from app.services.circular_library_service import CircularLibraryService

    svc = CircularLibraryService(rag_pg_session)
    circular = await svc.get_detail(doc_id)

    assert circular is not None
    assert circular.structured_content is None


@needs_real_pg
async def test_get_detail_missing_id_returns_none(rag_pg_session):
    """Unknown circular id returns None (router converts to 404)."""
    from app.services.circular_library_service import CircularLibraryService

    svc = CircularLibraryService(rag_pg_session)
    result = await svc.get_detail(uuid.uuid4())
    assert result is None
