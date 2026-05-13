"""Backfill document_chunks for circular_documents that have no chunks.

Run inside the scraper container:
    python -m scraper.scripts.backfill_chunks

What it does:
1. Finds all circular_documents with zero associated document_chunks rows.
2. For each document, downloads the PDF from rbi_url, extracts text, chunks
   it, generates embeddings, and inserts rows into document_chunks.
3. Skips upload:// URLs (manual uploads whose bytes are no longer in Redis).
4. Processes in batches of BATCH_SIZE, prints progress after each document.
5. On failure, logs the error and continues to the next document.

This is safe to re-run — it only inserts chunks for documents that still
have none (idempotent at the document level).
"""

from __future__ import annotations

import sys
import uuid
from datetime import datetime

from sqlalchemy import text

from scraper.db import get_db_session
from scraper.extractor.pdf_extractor import PDFExtractor
from scraper.processor.chunker import TextChunker
from scraper.processor.embedder import Embedder

# How many documents to process before printing a progress summary
BATCH_SIZE = 10


def _fetch_docs_without_chunks() -> list[tuple[str, str, str]]:
    """Return (id, rbi_url, title) for all documents with no chunks."""
    with get_db_session() as db:
        rows = db.execute(
            text("""
                SELECT cd.id::text, cd.rbi_url, COALESCE(cd.title, '') AS title
                FROM circular_documents cd
                WHERE cd.status = 'ACTIVE'
                  AND NOT EXISTS (
                      SELECT 1 FROM document_chunks dc
                      WHERE dc.document_id = cd.id
                  )
                ORDER BY cd.updated_at ASC
            """)
        ).fetchall()
    return [(r[0], r[1], r[2]) for r in rows]


def _insert_chunks(
    doc_id: str,
    chunks,   # list[TextChunk]
    embeddings: list[list[float]],
) -> tuple[int, int]:
    """Insert chunks into document_chunks.  Returns (inserted, failed)."""
    inserted = 0
    failed = 0
    with get_db_session() as db:
        for i, chunk in enumerate(chunks):
            emb = embeddings[i] if i < len(embeddings) else None
            emb_str = "[" + ",".join(str(x) for x in emb) + "]" if emb else None
            try:
                db.execute(
                    text("""
                        INSERT INTO document_chunks (
                            id, document_id, chunk_index, chunk_text,
                            token_count, embedding
                        ) VALUES (
                            :id, :document_id, :chunk_index, :chunk_text,
                            :token_count, CAST(:embedding AS vector)
                        )
                        ON CONFLICT DO NOTHING
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "document_id": doc_id,
                        "chunk_index": chunk.chunk_index,
                        "chunk_text": chunk.text,
                        "token_count": chunk.token_count,
                        "embedding": emb_str,
                    },
                )
                inserted += 1
            except Exception as exc:
                failed += 1
                print(
                    f"    [WARN] chunk {chunk.chunk_index} insert failed: {exc}",
                    file=sys.stderr,
                )
                try:
                    db.rollback()
                except Exception:
                    pass
        db.commit()
    return inserted, failed


def main() -> None:
    print(f"[{_ts()}] Starting chunk backfill …")

    docs = _fetch_docs_without_chunks()
    total = len(docs)

    if total == 0:
        print("No documents missing chunks — nothing to do.")
        return

    print(f"Found {total} document(s) with no chunks.\n")

    pdf_extractor = PDFExtractor()
    chunker = TextChunker()

    try:
        embedder: Embedder | None = Embedder()
    except Exception as exc:
        print(
            f"[WARN] Embedder init failed ({exc}). "
            "Chunks will be inserted with NULL embeddings and can be "
            "backfilled later with backend/scripts/backfill_embeddings.py",
            file=sys.stderr,
        )
        embedder = None

    success = 0
    skipped = 0
    failed = 0

    for idx, (doc_id, rbi_url, title) in enumerate(docs, start=1):
        short_title = (title or rbi_url)[:70]
        print(f"[{idx}/{total}] {short_title}")

        # Skip manually-uploaded PDFs — bytes are gone from Redis
        if rbi_url.startswith("upload://"):
            print("  → skip (manual upload, no downloadable URL)")
            skipped += 1
            continue

        try:
            # --- Download + extract text ---
            import asyncio
            extracted = asyncio.run(pdf_extractor.extract(rbi_url))

            if not extracted.raw_text.strip():
                print("  → skip (empty text after extraction)")
                skipped += 1
                continue

            # --- Chunk ---
            chunks = chunker.chunk(extracted.raw_text)
            if not chunks:
                print("  → skip (no chunks produced)")
                skipped += 1
                continue

            print(f"  chunks={len(chunks)}", end="")

            # --- Embed ---
            chunk_texts = [c.text for c in chunks]
            if embedder is not None:
                try:
                    embeddings = embedder.embed_chunks(chunk_texts)
                    print(f"  embeddings={len(embeddings)}", end="")
                except Exception as embed_exc:
                    print(
                        f"\n  [WARN] embedding failed ({embed_exc}), inserting with NULL",
                        file=sys.stderr,
                    )
                    embeddings = []
            else:
                embeddings = []

            # --- Insert ---
            ins, fail = _insert_chunks(doc_id, chunks, embeddings)
            print(f"  inserted={ins}  failed={fail}")

            if fail == 0:
                success += 1
            else:
                # Partial — still count as processed
                success += 1

        except Exception as exc:
            print(f"  [ERROR] {exc}", file=sys.stderr)
            failed += 1

        # Progress summary every BATCH_SIZE documents
        if idx % BATCH_SIZE == 0:
            print(
                f"\n--- Progress {idx}/{total}: "
                f"ok={success} skipped={skipped} failed={failed} ---\n"
            )

    print(
        f"\n[{_ts()}] Done. "
        f"total={total} success={success} skipped={skipped} failed={failed}"
    )

    if failed > 0:
        print(
            f"\n[WARN] {failed} document(s) failed — re-run the script to retry them. "
            "If they keep failing, check scraper logs for root causes."
        )


def _ts() -> str:
    return datetime.utcnow().strftime("%H:%M:%S UTC")


if __name__ == "__main__":
    main()
