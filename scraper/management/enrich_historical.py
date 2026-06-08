"""One-time historical AI enrichment generator.

Usage:
    python -m scraper.management.enrich_historical
    python -m scraper.management.enrich_historical --batch-size 50 --dry-run
    python -m scraper.management.enrich_historical --limit 100  # test run

Reads document_chunks from DB, calls Anthropic Haiku, writes to
data/fixtures/ai_enrichment.jsonl. Skips documents already in the fixture.
Safe to re-run — appends only new entries.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import anthropic
import structlog
from sqlalchemy import text

from scraper.config import get_scraper_settings
from scraper.db import get_db_session

logger = structlog.get_logger("regpulse.management.enrich_historical")

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "data" / "fixtures" / "ai_enrichment.jsonl"

SUMMARY_SYSTEM_PROMPT = (
    "You are an RBI regulatory document summariser. "
    "Produce exactly 3 concise sentences summarising the key points, "
    "requirements, and impact of the circular. No preamble."
)

TAGS_SYSTEM_PROMPT = """
You are an RBI regulatory taxonomy specialist.

Analyze the RBI circular and generate 3-6 tags that will help users discover this document through semantic search.

Prioritize:
1. Regulatory subject area
2. Regulated entity type
3. Scheme, framework, or regulation name
4. Financial product or activity
5. Compliance or supervisory topic

Use specific RBI terminology whenever possible.

Return only a valid JSON array.

Output example:
["Priority Sector Lending", "Urban Cooperative Banks", "Master Direction", "Reporting Requirements"]

Do not use markdown.
Do not use code fences.
Do not explain your answer.
The entire response must be valid JSON.
"""


def _extract_and_parse_json_array(raw: str) -> list[str]:
    """Extract JSON array from raw text, handling markdown code fences.

    Defensively parses:
    - Plain JSON array: ["tag1", "tag2"]
    - Markdown-wrapped: ```json\n[...]\n```
    - With extra whitespace
    Returns empty list if parsing fails.
    """
    import re

    raw = raw.strip()

    # Remove markdown code fences if present
    # Matches ```json\n...\n``` or ```\n...\n```
    markdown_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if markdown_match:
        raw = markdown_match.group(1).strip()

    # Try to parse
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            # Ensure all elements are strings
            return [str(item) for item in parsed if item]
        else:
            logger.warning("json_parse_not_array", type=type(parsed).__name__)
            return []
    except json.JSONDecodeError as e:
        logger.warning("json_parse_failed", raw=raw, error=str(e))
        return []


def _load_existing_fixture(path: Path) -> dict[str, dict]:
    """Load existing JSONL fixture keyed by rbi_url. Returns {} if file absent."""
    if not path.exists():
        return {}
    existing: dict[str, dict] = {}
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                entry = json.loads(line)
                existing[entry["rbi_url"]] = entry
    return existing


def _fetch_documents_needing_enrichment(existing_urls: set[str]) -> list[dict]:
    """Fetch docs from DB that are not already in the fixture."""
    with get_db_session() as db:
        rows = db.execute(
            text("""
                SELECT
                    cd.id,
                    cd.rbi_url,
                    cd.title,
                    cd.ai_summary,
                    cd.tags,
                    STRING_AGG(dc.chunk_text, ' ' ORDER BY dc.chunk_index) AS full_text
                FROM circular_documents cd
                LEFT JOIN document_chunks dc ON dc.document_id = cd.id
                WHERE
                    cd.rbi_url IS NOT NULL
                    AND cd.circular_number IS NOT NULL
                GROUP BY
                    cd.id,
                    cd.rbi_url,
                    cd.title,
                    cd.ai_summary,
                    cd.tags
            """)
        ).fetchall()

    docs = []
    for row in rows:
        rbi_url = row[1]
        if rbi_url in existing_urls:
            continue  # already in fixture

        # Also skip if DB already has both summary and non-empty tags
        existing_summary = row[3]
        existing_tags = row[4]
        if (
            existing_summary
            and existing_tags
            and existing_tags not in ("[]", None, "")
        ):
            logger.info(
                "skipping_already_enriched_in_db",
                rbi_url=rbi_url,
            )
            continue

        full_text = row[5] or ""
        if not full_text.strip():
            logger.warning("skipping_no_text", rbi_url=rbi_url)
            continue

        docs.append({
            "id": str(row[0]),
            "rbi_url": rbi_url,
            "title": row[2] or "",
            "full_text": full_text[:6000],  # cap at 6k chars for Haiku context
        })

    return docs


def _generate_summary(client: anthropic.Anthropic, model: str, text: str) -> str:
    response = client.messages.create(
        model=model,
        max_tokens=300,
        system=SUMMARY_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    return response.content[0].text.strip()


def _generate_tags(client: anthropic.Anthropic, model: str, text: str) -> list[str]:
    response = client.messages.create(
        model=model,
        max_tokens=100,
        system=TAGS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text[:3000]}],
    )
    raw = response.content[0].text.strip()
    return _extract_and_parse_json_array(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate AI enrichment fixture.")
    parser.add_argument("--batch-size", type=int, default=50, help="Docs per batch (for rate limiting).")
    parser.add_argument("--limit", type=int, default=None, help="Max docs to process (for testing).")
    parser.add_argument("--dry-run", action="store_true", help="Don't write fixture or call Anthropic.")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds between API calls.")
    args = parser.parse_args()

    settings = get_scraper_settings()
    model = settings.LLM_SUMMARY_MODEL  # e.g. "claude-haiku-4-5"

    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing = _load_existing_fixture(FIXTURE_PATH)
    logger.info("fixture_loaded", existing_count=len(existing))

    docs = _fetch_documents_needing_enrichment(set(existing.keys()))
    if args.limit:
        docs = docs[: args.limit]

    logger.info("documents_to_enrich", count=len(docs))

    if args.dry_run:
        logger.info("dry_run_mode_no_changes_made")
        sys.exit(0)

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    processed = 0
    failed = 0

    with FIXTURE_PATH.open("a") as fixture_file:  # append mode — safe to re-run
        for i, doc in enumerate(docs):
            try:
                logger.info(
                    "enriching_document",
                    index=i + 1,
                    total=len(docs),
                    rbi_url=doc["rbi_url"],
                )

                summary = _generate_summary(client, model, doc["full_text"])
                time.sleep(args.delay)  # avoid rate limits

                tags = _generate_tags(client, model, doc["full_text"])
                time.sleep(args.delay)

                entry = {
                    "rbi_url": doc["rbi_url"],
                    "ai_summary": summary,
                    "tags": tags,
                    "enriched_at": datetime.now(UTC).isoformat(),
                    "model": model,
                }

                fixture_file.write(json.dumps(entry) + "\n")
                fixture_file.flush()  # flush after every write — crash-safe

                processed += 1
                logger.info(
                    "enriched_ok",
                    rbi_url=doc["rbi_url"],
                    summary_length=len(summary),
                    tags=tags,
                )

            except Exception as exc:
                failed += 1
                logger.error(
                    "enrichment_failed",
                    rbi_url=doc["rbi_url"],
                    error=str(exc),
                    exc_info=True,
                )
                # Continue — don't abort the entire run for one doc

    logger.info(
        "enrichment_run_complete",
        processed=processed,
        failed=failed,
        fixture_path=str(FIXTURE_PATH),
    )
    print(f"\nDone. {processed} enriched, {failed} failed. Fixture: {FIXTURE_PATH}")
    print("Next step: git add data/fixtures/ai_enrichment.jsonl && git commit")


if __name__ == "__main__":
    main()

