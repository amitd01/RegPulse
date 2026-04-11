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

from scraper.config import get_scraper_settings
from scraper.crawler.rbi_crawler import RBI_SECTIONS, RBICrawler
from scraper.crawler.rss_fetcher import fetch_all_sources
from scraper.db import get_db_session
from scraper.extractor.metadata_extractor import MetadataExtractor
from scraper.extractor.pdf_extractor import PDFExtractor
from scraper.processor.chunker import TextChunker
from scraper.processor.embedder import Embedder
from scraper.processor.entity_extractor import Entity, EntityExtractor, Triple
from scraper.processor.impact_classifier import ImpactClassifier
from scraper.processor.news_relevance import score_and_link
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

        # Step 6.5: Knowledge graph extraction (Sprint 3 Pillar A)
        try:
            extractor = EntityExtractor()
            entities, triples = extractor.extract(
                extracted.raw_text,
                circular_number=metadata.circular_number,
                title=effective_title,
            )
            if entities or triples:
                with get_db_session() as db:
                    persist_kg(
                        db,
                        entities=entities,
                        triples=triples,
                        source_document_id=doc_id,
                    )
                    db.commit()
        except Exception:
            logger.exception("kg_extraction_failed_for_document", doc_id=doc_id)

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
    """Generate AI summary for a circular document using Claude Haiku.

    Minimal inline implementation — fetches chunks, concatenates up to 4,000 chars,
    calls Haiku for a 3-sentence summary, saves ai_summary, sets pending_admin_review=TRUE.
    Full SummaryService class replaces this in REG-169 (Prompt 42).
    """
    import anthropic

    from scraper.config import get_scraper_settings

    logger.info("generate_summary_started", document_id=document_id)

    try:
        # Fetch chunk texts ordered by chunk_index
        with get_db_session() as db:
            rows = db.execute(
                text(
                    "SELECT chunk_text FROM document_chunks "
                    "WHERE document_id = :doc_id ORDER BY chunk_index"
                ),
                {"doc_id": document_id},
            ).fetchall()

        if not rows:
            logger.warning("generate_summary_no_chunks", document_id=document_id)
            return {"status": "skipped", "reason": "no_chunks", "document_id": document_id}

        # Concatenate chunks up to 4,000 chars
        combined = ""
        for row in rows:
            if len(combined) + len(row[0]) > 4000:
                remaining = 4000 - len(combined)
                if remaining > 0:
                    combined += " " + row[0][:remaining]
                break
            combined += " " + row[0] if combined else row[0]

        # Call Claude Haiku
        settings = get_scraper_settings()
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=settings.LLM_SUMMARY_MODEL,
            max_tokens=300,
            system=(
                "You are an RBI regulatory document summariser. "
                "Produce exactly 3 concise sentences summarising the key points, "
                "requirements, and impact of the circular. No preamble."
            ),
            messages=[{"role": "user", "content": combined}],
        )
        summary_text = response.content[0].text.strip()

        # Save summary and mark for admin review
        with get_db_session() as db:
            db.execute(
                text(
                    "UPDATE circular_documents SET ai_summary = :summary, "
                    "pending_admin_review = TRUE, updated_at = now() "
                    "WHERE id = :doc_id"
                ),
                {"summary": summary_text, "doc_id": document_id},
            )
            db.commit()

        logger.info(
            "generate_summary_completed",
            document_id=document_id,
            summary_length=len(summary_text),
        )
        return {"status": "success", "document_id": document_id, "summary": summary_text}

    except SoftTimeLimitExceeded:
        logger.error("generate_summary_timeout", document_id=document_id)
        raise
    except Exception as exc:
        logger.error(
            "generate_summary_failed", document_id=document_id, error=str(exc), exc_info=True
        )
        return {"status": "failed", "document_id": document_id, "error": str(exc)}


@shared_task(bind=True, soft_time_limit=300, name="scraper.tasks.send_staleness_alerts")
def send_staleness_alerts(self, circular_id: str) -> dict:  # noqa: ANN001
    """Send staleness alert emails to users with saved interpretations citing a superseded circular.

    Fetches affected users via saved_interpretations → questions → citations JSONB,
    then sends staleness_alert.html email to each user.
    """
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    from scraper.config import get_scraper_settings

    logger.info("send_staleness_alerts_started", circular_id=circular_id)

    try:
        # Get the superseded circular's number
        with get_db_session() as db:
            circ_row = db.execute(
                text(
                    "SELECT circular_number FROM circular_documents WHERE id = :cid"
                ),
                {"cid": circular_id},
            ).fetchone()

        if not circ_row or not circ_row[0]:
            return {"status": "skipped", "reason": "no_circular_number"}

        circular_number = circ_row[0]

        # Find saved_interpretations citing this circular (via questions.citations JSONB)
        pattern = json.dumps([{"circular_number": circular_number}])
        with get_db_session() as db:
            rows = db.execute(
                text("""
                    SELECT DISTINCT u.email, si.name
                    FROM saved_interpretations si
                    JOIN questions q ON si.question_id = q.id
                    JOIN users u ON si.user_id = u.id
                    WHERE q.citations @> :pattern::jsonb
                      AND si.needs_review = TRUE
                      AND u.is_active = TRUE
                """),
                {"pattern": pattern},
            ).fetchall()

        if not rows:
            logger.info("send_staleness_alerts_no_affected_users", circular_id=circular_id)
            return {"status": "skipped", "reason": "no_affected_users"}

        settings = get_scraper_settings()
        sent = 0

        for row in rows:
            email_addr = row[0]
            interpretation_name = row[1]
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "RegPulse: A regulation you saved has been updated"
                msg["From"] = settings.SMTP_FROM
                msg["To"] = email_addr

                html_body = (
                    "<html><body>"
                    "<p>A regulation you saved has been updated.</p>"
                    f"<p>Your interpretation <strong>{interpretation_name}</strong> "
                    f"references circular <strong>{circular_number}</strong>, "
                    "which has been superseded by a newer circular.</p>"
                    "<p>Your interpretation may need review. Please log in to RegPulse "
                    "to check for updates.</p>"
                    "</body></html>"
                )
                msg.attach(MIMEText(html_body, "html"))

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASS)
                    server.sendmail(settings.SMTP_FROM, email_addr, msg.as_string())
                sent += 1
            except Exception:
                logger.warning(
                    "staleness_alert_send_failed",
                    email=email_addr,
                    exc_info=True,
                )

        logger.info(
            "send_staleness_alerts_completed",
            circular_id=circular_id,
            circular_number=circular_number,
            affected_users=len(rows),
            emails_sent=sent,
        )
        return {"status": "success", "emails_sent": sent, "circular_number": circular_number}

    except SoftTimeLimitExceeded:
        logger.error("send_staleness_alerts_timeout", circular_id=circular_id)
        raise
    except Exception as exc:
        logger.error(
            "send_staleness_alerts_failed",
            circular_id=circular_id,
            error=str(exc),
            exc_info=True,
        )
        return {"status": "failed", "circular_id": circular_id, "error": str(exc)}


# ---------------------------------------------------------------------------
# Sprint 3 Pillar A: Knowledge graph persistence helper
# ---------------------------------------------------------------------------


def persist_kg(
    db,  # noqa: ANN001
    *,
    entities: list[Entity],
    triples: list[Triple],
    source_document_id: str | None = None,
) -> tuple[int, int]:
    """Upsert entities and insert relationships into kg_entities/kg_relationships.

    Idempotent: entity unique key is (entity_type, canonical_name); relationship
    unique key is (source_entity_id, target_entity_id, relation_type, source_document_id).

    Returns (inserted_entities, inserted_edges).
    """
    inserted_entities = 0
    inserted_edges = 0

    name_to_id: dict[tuple[str, str], str] = {}

    for ent in entities:
        # Upsert: insert if missing, otherwise refresh last_seen_at and merge aliases
        row = db.execute(
            text(
                """
                INSERT INTO kg_entities (entity_type, canonical_name, aliases, metadata)
                VALUES (CAST(:etype AS kg_entity_type_enum), :name, CAST(:aliases AS jsonb), '{}'::jsonb)
                ON CONFLICT (entity_type, canonical_name) DO UPDATE
                    SET last_seen_at = now()
                RETURNING id
                """
            ),
            {
                "etype": ent.entity_type,
                "name": ent.canonical_name,
                "aliases": json.dumps(list(ent.aliases)),
            },
        ).first()
        if row is not None:
            entity_id = str(row[0])
            name_to_id[(ent.entity_type, ent.canonical_name)] = entity_id
            inserted_entities += 1

    for tr in triples:
        subj_id = name_to_id.get((tr.subject.entity_type, tr.subject.canonical_name))
        obj_id = name_to_id.get((tr.obj.entity_type, tr.obj.canonical_name))
        if subj_id is None or obj_id is None:
            continue
        try:
            db.execute(
                text(
                    """
                    INSERT INTO kg_relationships
                        (source_entity_id, target_entity_id, relation_type,
                         source_document_id, confidence)
                    VALUES
                        (CAST(:s AS uuid), CAST(:t AS uuid),
                         CAST(:r AS kg_relation_type_enum),
                         CAST(:doc AS uuid), 1.0)
                    ON CONFLICT (source_entity_id, target_entity_id, relation_type, source_document_id)
                        DO NOTHING
                    """
                ),
                {
                    "s": subj_id,
                    "t": obj_id,
                    "r": tr.predicate,
                    "doc": source_document_id,
                },
            )
            inserted_edges += 1
        except Exception:
            logger.exception("kg_edge_insert_failed", subject=tr.subject.canonical_name)

    logger.info(
        "kg_persisted",
        entities=inserted_entities,
        edges=inserted_edges,
        document_id=source_document_id,
    )
    return inserted_entities, inserted_edges


# ---------------------------------------------------------------------------
# Sprint 3: News ingest task
# ---------------------------------------------------------------------------


@shared_task(
    bind=True,
    name="scraper.tasks.ingest_news",
    queue="scraper",
    max_retries=2,
    default_retry_delay=120,
)
def ingest_news(self, sources: list[str] | None = None) -> dict:  # noqa: ANN001, ARG001
    """Fetch RSS feeds, dedupe, score relevance, persist news_items.

    Sprint 3 Pillar B. Idempotent: skips items already present by
    (source, external_id). Each new item is embedded and matched
    against active circulars; high-confidence matches set
    linked_circular_id.
    """
    settings = get_scraper_settings()
    if not settings.RSS_INGEST_ENABLED:
        logger.info("rss_ingest_disabled")
        return {"status": "skipped", "reason": "RSS_INGEST_ENABLED=false"}

    requested = sources or [s.strip() for s in settings.RSS_SOURCES.split(",") if s.strip()]
    logger.info("ingest_news_start", sources=requested)

    items = fetch_all_sources(requested)
    inserted = 0
    skipped = 0
    linked = 0

    if not items:
        logger.info("ingest_news_no_items")
        return {"status": "success", "inserted": 0, "skipped": 0, "linked": 0}

    embedder: Embedder | None = None
    try:
        embedder = Embedder()
    except Exception:
        logger.exception("embedder_init_failed_news")

    with get_db_session() as db:
        existing_rows = db.execute(
            text("SELECT source::text, external_id FROM news_items")
        ).fetchall()
        existing = {(r[0], r[1]) for r in existing_rows}

        for item in items:
            key = (item.source, item.external_id)
            if key in existing:
                skipped += 1
                continue

            # Each item runs in its own savepoint so a single failure
            # (relevance query, insert, etc.) does not poison the rest.
            try:
                with db.begin_nested():
                    score: float | None = None
                    linked_id: str | None = None
                    if embedder is not None:
                        try:
                            score, linked_id = score_and_link(
                                db,
                                title=item.title,
                                summary=item.summary,
                                embedder=embedder,
                            )
                        except Exception:
                            logger.exception("news_scoring_failed")
                            # Reset the savepoint state for the insert below
                            score, linked_id = None, None

                    db.execute(
                        text(
                            """
                            INSERT INTO news_items
                                (id, source, external_id, title, url, published_at,
                                 summary, raw_html_hash, linked_circular_id,
                                 linked_entity_ids, relevance_score, status, created_at)
                            VALUES
                                (gen_random_uuid(), CAST(:source AS news_source_enum),
                                 :external_id, :title, :url, :published_at, :summary,
                                 :raw_html_hash, CAST(:linked_circular_id AS uuid),
                                 '[]'::jsonb, :relevance_score,
                                 'NEW'::news_status_enum, now())
                            ON CONFLICT (source, external_id) DO NOTHING
                            """
                        ),
                        {
                            "source": item.source,
                            "external_id": item.external_id,
                            "title": item.title,
                            "url": item.url,
                            "published_at": item.published_at,
                            "summary": item.summary,
                            "raw_html_hash": item.raw_html_hash,
                            "linked_circular_id": linked_id,
                            "relevance_score": score,
                        },
                    )
                inserted += 1
                if linked_id:
                    linked += 1
            except Exception:
                logger.exception(
                    "news_insert_failed",
                    source=item.source,
                    external_id=item.external_id,
                )

        db.commit()

    logger.info(
        "ingest_news_complete",
        inserted=inserted,
        skipped=skipped,
        linked=linked,
        total_seen=len(items),
    )
    return {
        "status": "success",
        "inserted": inserted,
        "skipped": skipped,
        "linked": linked,
        "total_seen": len(items),
    }


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
