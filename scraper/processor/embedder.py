"""Embedding generation for document chunks (stub).

Standalone scraper module. NEVER imports from backend/app/.
Full implementation in a future prompt. This stub provides the interface
so that tasks.py can call it without breaking.
"""

from __future__ import annotations

import structlog

from scraper.config import get_scraper_settings

logger: structlog.stdlib.BoundLogger = structlog.get_logger("regpulse.embedder")


class Embedder:
    """Generate embeddings for text chunks using OpenAI API.

    Stub implementation — returns empty embeddings. Full implementation
    will batch chunks, call text-embedding-3-large, and return vectors.
    """

    def __init__(self) -> None:
        settings = get_scraper_settings()
        self._model = settings.EMBEDDING_MODEL
        self._dims = settings.EMBEDDING_DIMS

    def embed_chunks(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of text chunks.

        Args:
            texts: List of chunk texts to embed.

        Returns:
            List of embedding vectors (currently empty lists as stub).
        """
        logger.info(
            "embed_chunks_stub",
            count=len(texts),
            model=self._model,
            dims=self._dims,
        )
        # Stub: return empty embeddings — full implementation in future prompt
        return [[] for _ in texts]
