"""Celery tasks for the RegPulse scraper pipeline.

Standalone scraper module. NEVER imports from backend/app/.

Tasks:
- daily_scrape: Full crawl of all RBI sections
- priority_scrape: Crawl Circulars + Master Directions only (every 4h)
- process_document: Full pipeline for a single document URL
- generate_summary: AI summary stub (future prompt)

All tasks are idempotent, use bind=True, and have task_soft_time_limit=300.
"""

from __future__ import annotations

import asyncio
import json
import uuid

import structlog
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import text

from scraper.crawler.rbi_crawler import RBI_SECTIONS, RBICrawler
from scraper.db import get_db_session
from scraper.extractor.metadata_extractor import MetadataExtractor
from scraper.extractor.pdf_extractor import PDFExtractor
from scraper.processor.chunker import TextChunker
from scraper.processor.embedder import Embedder
from scraper.processor.impact_classifier import ImpactClassifier
from scraper.processor.supersession_resolver import SupersessionResolver

logger: structlog.stdlib.BoundLogger = structlog.get_logger("regpulse.tasks")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_seen_urls() -> set[str]:
    """Fetch all rbi_url values already in circular_documents."""
    with get_db_session() as db:
        rows = db.execute(text("SELECT rbi_url FROM circular_documents")).fetchall()
        return {row[0] for row in rows}


def _run_async(coro):  # noqa: ANN001, ANN202
    """Run an async coroutine from sync Celery task context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Shouldn't happen in Celery, but handle gracefully
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


@shared_task(bind=True, soft_time_limit=300, max_retries=1, name="scraper.tasks.daily_scrape")
def daily_scrape(self):  # noqa: ANN001, ANN201
    """Full crawl of all RBI sections. Discovers new URLs and enqueues process_document."""
    logger.info("daily_scrape_started")

    # Create a scraper_run record
    run_id = str(uuid.uuid4())
    with get_db_session() as db:
        db.execute(
            text(
                "INSERT INTO scraper_runs (id, status) VALUES (:id, 'RUNNING')"
            ),
            {"id": run_id},
        )
        db.commit()

    try:
        seen_urls = _get_seen_urls()
        crawler = RBICrawler()
        new_docs = _run_async(crawler.get_new_documents(seen_urls=seen_urls))

        enqueued = 0
        for doc_link in new_docs:
            process_document.delay(
                url=doc_link.url,
                title=doc_link.link_text,
                doc_type=doc_link.doc_type,
                scraper_run_id=run_id,
            )
            enqueued += 1

        with get_db_session() as db:
            db.execute(
                text(
                    "UPDATE scraper_runs SET completed_at = now(), status = 'COMPLETED', "
                    "documents_processed = :count WHERE id = :id"
                ),
                {"count": enqueued, "id": run_id},
            )
            db.commit()

        logger.info("daily_scrape_completed", new_documents=enqueued, run_id=run_id)

    except SoftTimeLimitExceeded:
        logger.error("daily_scrape_timeout", run_id=run_id)
        _mark_run_failed(run_id, "Soft time limit exceeded")
        raise
    except Exception as exc:
        logger.error("daily_scrape_failed", error=str(exc), run_id=run_id, exc_info=True)
        _mark_run_failed(run_id, str(exc))
        raise


@shared_task(bind=True, soft_time_limit=300, max_retries=1, name="scraper.tasks.priority_scrape")
def priority_scrape(self):  # noqa: ANN001, ANN201
    """Priority crawl — Circulars + Master Directions only (every 4h)."""
    logger.info("priority_scrape_started")

    priority_sections = {
        k: v
        for k, v in RBI_SECTIONS.items()
        if k in ("Notifications", "Master Directions")
    }

    run_id = str(uuid.uuid4())
    with get_db_session() as db:
        db.execute(
            text("INSERT INTO scraper_runs (id, status) VALUES (:id, 'RUNNING')"),
            {"id": run_id},
        )
        db.commit()

    try:
        seen_urls = _get_seen_urls()
        crawler = RBICrawler()
        new_docs = _run_async(
            crawler.get_new_documents(sections=priority_sections, seen_urls=seen_urls)
        )

        enqueued = 0
        for doc_link in new_docs:
            process_document.delay(
                url=doc_link.url,
                title=doc_link.link_text,
                doc_type=doc_link.doc_type,
                scraper_run_id=run_id,
            )
            enqueued += 1

        with get_db_session() as db:
            db.execute(
                text(
                    "UPDATE scraper_runs SET completed_at = now(), status = 'COMPLETED', "
                    "documents_processed = :count WHERE id = :id"
                ),
                {"count": enqueued, "id": run_id},
            )
            db.commit()

        logger.info("priority_scrape_completed", new_documents=enqueued, run_id=run_id)

    except SoftTimeLimitExceeded:
        logger.error("priority_scrape_timeout", run_id=run_id)
        _mark_run_failed(run_id, "Soft time limit exceeded")
        raise
    except Exception as exc:
        logger.error("priority_scrape_failed", error=str(exc), run_id=run_id, exc_info=True)
        _mark_run_failed(run_id, str(exc))
        raise


@shared_task(
    bind=True,
    soft_time_limit=300,
    max_retries=2,
    default_retry_delay=30,
    name="scraper.tasks.process_document",
)
def process_document(
    self,  # noqa: ANN001
    url: str,
    title: str = "",
    doc_type: str = "OTHER",
    scraper_run_id: str | None = None,
) -> dict:
    """Full pipeline for a single document.

    Pipeline: download → extract text → metadata → chunk → embed → classify impact
    → save to DB → supersession resolution → enqueue generate_summary stub.

    Idempotent: checks if rbi_url already exists before processing.
    """
    logger.info("process_document_started", url=url, title=title[:80])

    # Idempotency check: skip if URL already indexed
    with get_db_session() as db:
        existing = db.execute(
            text("SELECT id FROM circular_documents WHERE rbi_url = :url"),
            {"url": url},
        ).fetchone()
        if existing:
            logger.info("process_document_skipped_duplicate", url=url)
            return {"status": "skipped", "reason": "duplicate", "url": url}

    try:
        # Step 1: Download + extract text
        pdf_extractor = PDFExtractor()
        extracted = _run_async(pdf_extractor.extract(url))

        if not extracted.raw_text.strip():
            logger.warning("process_document_empty_text", url=url)
            return {"status": "skipped", "reason": "empty_text", "url": url}

        # Step 2: Extract metadata
        metadata_extractor = MetadataExtractor()
        metadata = metadata_extractor.extract(extracted.raw_text, source_url=url)

        # Use extracted title if not provided by crawler
        effective_title = title or metadata.circular_number or url.split("/")[-1]

        # Step 3: Chunk text
        chunker = TextChunker()
        chunks = chunker.chunk(extracted.raw_text)

        if not chunks:
            logger.warning("process_document_no_chunks", url=url)
            return {"status": "skipped", "reason": "no_chunks", "url": url}

        # Step 4: Generate embeddings (stub — returns empty vectors)
        embedder = Embedder()
        chunk_texts = [c.text for c in chunks]
        _embeddings = embedder.embed_chunks(chunk_texts)

        # Step 5: Classify impact level
        summary_excerpt = extracted.raw_text[:500]
        classifier = ImpactClassifier()
        impact_level = classifier.classify(
            title=effective_title,
            summary=summary_excerpt,
            department=metadata.department or "",
        )

        # Step 6: Save to database (single transaction)
        doc_id = str(uuid.uuid4())
        with get_db_session() as db:
            # Insert circular_documents row
            db.execute(
                text("""
                    INSERT INTO circular_documents (
                        id, circular_number, title, doc_type, department,
                        issued_date, effective_date, rbi_url, status,
                        impact_level, action_deadline, affected_teams, tags,
                        pending_admin_review, scraper_run_id
                    ) VALUES (
                        :id, :circular_number, :title, :doc_type, :department,
                        :issued_date, :effective_date, :rbi_url, 'ACTIVE',
                        :impact_level, :action_deadline, :affected_teams, :tags,
                        TRUE, :scraper_run_id
                    )
                """),
                {
                    "id": doc_id,
                    "circular_number": metadata.circular_number,
                    "title": effective_title,
                    "doc_type": doc_type,
                    "department": metadata.department,
                    "issued_date": metadata.issued_date,
                    "effective_date": metadata.effective_date,
                    "rbi_url": url,
                    "impact_level": impact_level,
                    "action_deadline": metadata.action_deadline,
                    "affected_teams": json.dumps(metadata.affected_teams),
                    "tags": json.dumps([]),
                    "scraper_run_id": scraper_run_id,
                },
            )

            # Insert document_chunks rows
            for chunk in chunks:
                db.execute(
                    text("""
                        INSERT INTO document_chunks (
                            id, document_id, chunk_index, chunk_text, token_count
                        ) VALUES (
                            :id, :document_id, :chunk_index, :chunk_text, :token_count
                        )
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "document_id": doc_id,
                        "chunk_index": chunk.chunk_index,
                        "chunk_text": chunk.text,
                        "token_count": chunk.token_count,
                    },
                )

            db.commit()

        logger.info(
            "process_document_saved",
            url=url,
            doc_id=doc_id,
            circular_number=metadata.circular_number,
            impact_level=impact_level,
            chunks=len(chunks),
        )

        # Step 7: Supersession resolution
        if metadata.supersession_refs:
            resolver = SupersessionResolver()
            with get_db_session() as db:
                resolved = resolver.resolve(db, doc_id, metadata.supersession_refs)
                if resolved > 0:
                    db.commit()
                logger.info(
                    "supersession_resolved",
                    doc_id=doc_id,
                    refs=metadata.supersession_refs,
                    resolved_count=resolved,
                )

        # Step 8: Enqueue AI summary generation (stub task)
        generate_summary.delay(document_id=doc_id)

        return {
            "status": "success",
            "document_id": doc_id,
            "circular_number": metadata.circular_number,
            "impact_level": impact_level,
            "chunks": len(chunks),
            "url": url,
        }

    except SoftTimeLimitExceeded:
        logger.error("process_document_timeout", url=url)
        raise
    except Exception as exc:
        logger.error("process_document_failed", url=url, error=str(exc), exc_info=True)
        # Retry on transient errors
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error("process_document_max_retries", url=url)
            return {"status": "failed", "url": url, "error": str(exc)}


@shared_task(bind=True, soft_time_limit=300, name="scraper.tasks.generate_summary")
def generate_summary(self, document_id: str) -> dict:  # noqa: ANN001
    """Generate AI summary for a circular document (stub).

    Full implementation in a future prompt. Will use Claude Haiku to generate
    a summary, set pending_admin_review=TRUE, and store in ai_summary column.
    """
    logger.info("generate_summary_stub", document_id=document_id)
    return {"status": "stub", "document_id": document_id}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _mark_run_failed(run_id: str, error_msg: str) -> None:
    """Mark a scraper run as FAILED."""
    try:
        with get_db_session() as db:
            db.execute(
                text(
                    "UPDATE scraper_runs SET completed_at = now(), status = 'FAILED', "
                    "error_message = :error WHERE id = :id"
                ),
                {"error": error_msg[:1000], "id": run_id},
            )
            db.commit()
    except Exception:
        logger.error("mark_run_failed_error", run_id=run_id, exc_info=True)
