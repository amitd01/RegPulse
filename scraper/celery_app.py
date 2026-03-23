"""Celery application configuration for the RegPulse scraper.

Standalone scraper module. NEVER imports from backend/app/.
Uses Redis as both broker and result backend.
"""

from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

# Read REDIS_URL from environment directly to avoid loading full ScraperSettings
# at import time (which can fail if .env has format issues during development).
_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery(
    "regpulse_scraper",
    broker=_REDIS_URL,
    backend=_REDIS_URL,
)

# ---------------------------------------------------------------------------
# Celery configuration
# ---------------------------------------------------------------------------

app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Reliability
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Limits
    task_soft_time_limit=300,  # 5 minutes soft limit
    task_time_limit=360,  # 6 minutes hard limit
    # Result expiry
    result_expires=3600,  # 1 hour
    # Task routes
    task_routes={
        "scraper.tasks.daily_scrape": {"queue": "scraper"},
        "scraper.tasks.priority_scrape": {"queue": "scraper"},
        "scraper.tasks.process_document": {"queue": "scraper"},
        "scraper.tasks.generate_summary": {"queue": "scraper"},
        "scraper.tasks.send_staleness_alerts": {"queue": "scraper"},
    },
)

# ---------------------------------------------------------------------------
# Celery Beat schedule
# ---------------------------------------------------------------------------

app.conf.beat_schedule = {
    # Daily full crawl at 02:00 IST (20:30 UTC previous day)
    "daily-scrape-0200-ist": {
        "task": "scraper.tasks.daily_scrape",
        "schedule": crontab(hour=20, minute=30),
        "args": (),
    },
    # Priority crawl every 4h from 06:00–22:00 UTC (Circulars + Master Directions)
    "priority-scrape-every-4h": {
        "task": "scraper.tasks.priority_scrape",
        "schedule": crontab(hour="6,10,14,18,22", minute=0),
        "args": (),
    },
}

# Auto-discover tasks from scraper.tasks module
app.autodiscover_tasks(["scraper"])
