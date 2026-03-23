"""Supersession resolution for RBI circulars (stub).

Standalone scraper module. NEVER imports from backend/app/.
Full implementation in a future prompt. This stub provides the interface
so that tasks.py can call it without breaking.
"""

from __future__ import annotations

import structlog
from sqlalchemy.orm import Session

logger: structlog.stdlib.BoundLogger = structlog.get_logger("regpulse.supersession")


class SupersessionResolver:
    """Resolve supersession relationships between circulars.

    Given a list of circular numbers referenced as superseded,
    update the status of those circulars in the database.

    Stub implementation — logs and returns. Full implementation in a future prompt.
    """

    def resolve(
        self,
        db: Session,
        new_document_id: str,
        supersession_refs: list[str],
    ) -> int:
        """Mark referenced circulars as superseded.

        Args:
            db: SQLAlchemy session.
            new_document_id: UUID of the new circular that supersedes others.
            supersession_refs: List of circular numbers (e.g. ["RBI/2024-25/158"]).

        Returns:
            Number of circulars marked as superseded (0 in stub).
        """
        if not supersession_refs:
            return 0

        logger.info(
            "supersession_resolve_stub",
            new_document_id=new_document_id,
            refs=supersession_refs,
        )
        # Stub: full implementation will UPDATE circular_documents SET status='SUPERSEDED'
        return 0
