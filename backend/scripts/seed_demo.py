#!/usr/bin/env python3
"""Seed demo circulars from the golden dataset into the database.

Loads the 5 synthetic circulars from tests/evals/golden_dataset.json,
generates real embeddings via OpenAI, and inserts them into the DB.

Usage (from inside the backend container):
    python scripts/seed_demo.py

Requires: DATABASE_URL, OPENAI_API_KEY set in environment.
Idempotent — skips circulars that already exist.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

# Ensure backend root is importable
_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

# Minimal env defaults for Settings
_DEFAULTS = {
    "REDIS_URL": "redis://redis:6379/0",
    "JWT_PRIVATE_KEY": "not-used",
    "JWT_PUBLIC_KEY": "not-used",
    "ANTHROPIC_API_KEY": "not-used",
    "RAZORPAY_KEY_ID": "rzp_test",
    "RAZORPAY_KEY_SECRET": "rzp_secret",
    "RAZORPAY_WEBHOOK_SECRET": "whsec",
    "SMTP_HOST": "localhost",
    "SMTP_PORT": "587",
    "SMTP_USER": "x",
    "SMTP_PASS": "x",
    "SMTP_FROM": "x@x.com",
    "FRONTEND_URL": "http://localhost:3000",
}
for k, v in _DEFAULTS.items():
    os.environ.setdefault(k, v)


async def main() -> None:
    import openai
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    settings_db_url = os.environ["DATABASE_URL"]
    oai_key = os.environ.get("OPENAI_API_KEY", "")
    if not oai_key or oai_key.startswith("sk-test"):
        print("ERROR: Real OPENAI_API_KEY required for embedding generation")
        sys.exit(1)

    engine = create_async_engine(settings_db_url, echo=False)
    client = openai.AsyncOpenAI(api_key=oai_key)

    # Load golden dataset
    golden_path = _root / "tests" / "evals" / "golden_dataset.json"
    with open(golden_path) as f:
        dataset = json.load(f)

    circulars = dataset["synthetic_circulars"]
    print(f"Seeding {len(circulars)} demo circulars...")

    async with engine.begin() as conn:
        for circ in circulars:
            cn = circ["circular_number"]

            # Check if already exists
            existing = await conn.execute(
                text("SELECT id FROM circular_documents WHERE circular_number = :cn"),
                {"cn": cn},
            )
            if existing.scalar():
                print(f"  SKIP {cn} (already exists)")
                continue

            doc_id = str(uuid.uuid4())

            # Insert circular
            await conn.execute(
                text("""
                    INSERT INTO circular_documents (
                        id, circular_number, title, rbi_url, status, doc_type,
                        impact_level, pending_admin_review
                    ) VALUES (
                        :id, :cn, :title, :url, 'ACTIVE', 'MASTER_DIRECTION',
                        'MEDIUM', FALSE
                    )
                """),
                {
                    "id": doc_id,
                    "cn": cn,
                    "title": circ["title"],
                    "url": circ["rbi_url"],
                },
            )

            # Generate embeddings
            chunk_texts = circ["chunks"]
            response = await client.embeddings.create(
                input=chunk_texts,
                model="text-embedding-3-large",
                dimensions=3072,
            )
            embeddings = [d.embedding for d in response.data]

            # Insert chunks with embeddings
            for idx, (chunk_text, embedding) in enumerate(
                zip(chunk_texts, embeddings, strict=True)
            ):
                emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
                await conn.execute(
                    text("""
                        INSERT INTO document_chunks (
                            id, document_id, chunk_index, chunk_text,
                            token_count, embedding
                        ) VALUES (
                            :id, :doc_id, :idx, :text, :tokens,
                            CAST(:emb AS vector)
                        )
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "doc_id": doc_id,
                        "idx": idx,
                        "text": chunk_text,
                        "tokens": len(chunk_text.split()),
                        "emb": emb_str,
                    },
                )

            print(f"  DONE {cn} — {circ['title']} ({len(chunk_texts)} chunks)")

    await engine.dispose()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
