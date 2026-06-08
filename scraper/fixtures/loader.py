"""Fixture loader — loads ai_enrichment.jsonl into an in-memory lookup dict.

Used by:
- apply_enrichment_fixture Celery task (import to DB)
- generate_summary task (fixture-first lookup to avoid redundant Anthropic calls)
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_FIXTURE_PATH = Path(__file__).resolve().parents[1] / "data" / "fixtures" / "ai_enrichment.jsonl"


@lru_cache(maxsize=1)
def load_fixture() -> dict[str, dict]:
    """Load fixture keyed by rbi_url. Cached after first load (process lifetime)."""
    if not _FIXTURE_PATH.exists():
        return {}
    result: dict[str, dict] = {}
    with _FIXTURE_PATH.open() as f:
        for line in f:
            line = line.strip()
            if line:
                entry = json.loads(line)
                result[entry["rbi_url"]] = entry
    return result


def get_enrichment(rbi_url: str) -> dict | None:
    """Return fixture entry for a given rbi_url, or None if not present."""
    return load_fixture().get(rbi_url)
