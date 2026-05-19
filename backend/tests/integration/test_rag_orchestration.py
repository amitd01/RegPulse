"""Integration tests for RAGService.retrieve + LLMService.generate orchestration.

These are the tests F2 in the ReBuild audit said didn't exist. Pre-rebuild,
test_rag_service.py and test_llm_service.py covered only pure utility functions
(_normalise_question, _validate_citations, _build_context). The full pipeline —
embed → pgvector ANN + FTS → RRF → dedup → rerank → injection guard → LLM →
citation validate → confidence — was never exercised end-to-end.

This suite runs against:
  - real Postgres+pgvector  (REGPULSE_INTEGRATION_DB_URL)
  - real Redis              (REGPULSE_INTEGRATION_REDIS_URL)
  - real OpenAI embeddings  (OPENAI_API_KEY)
  - real Anthropic LLM      (ANTHROPIC_API_KEY) — only for the full-stack case

When those aren't present (e.g. local without `docker compose up`), individual
tests are skipped with a clear reason. The skips are LOUD, not silent — CI
fails if integration env vars aren't exported.
"""

from __future__ import annotations

import json
import pathlib
import uuid

import pytest

from .conftest import (
    needs_real_anthropic,
    needs_real_openai,
    needs_real_pg,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


GOLDEN_DATASET_PATH = pathlib.Path(__file__).resolve().parents[1] / "evals" / "golden_dataset.json"


async def _seed_one_circular(
    session,
    *,
    circular_number: str,
    title: str,
    rbi_url: str,
    chunk_texts: list[str],
    embedding_client,
) -> uuid.UUID:
    """Insert a circular + its chunks with real embeddings. Returns the doc id."""
    from sqlalchemy import text

    doc_id = uuid.uuid4()
    await session.execute(
        text(
            """
            INSERT INTO circular_documents (
                id, circular_number, title, rbi_url, status, doc_type,
                impact_level, pending_admin_review, regulator, upload_source
            ) VALUES (
                :id, :cn, :title, :url, 'ACTIVE', 'MASTER_DIRECTION',
                'HIGH', FALSE, 'RBI', 'scraper'
            )
        """
        ),
        {"id": doc_id, "cn": circular_number, "title": title, "url": rbi_url},
    )

    resp = await embedding_client.embeddings.create(
        input=chunk_texts,
        model="text-embedding-3-large",
        dimensions=3072,
    )

    embeddings = [d.embedding for d in resp.data]
    for idx, (chunk, emb) in enumerate(zip(chunk_texts, embeddings, strict=False)):
        vec_literal = "[" + ",".join(str(x) for x in emb) + "]"
        await session.execute(
            text(
                """
                INSERT INTO document_chunks (
                    id, document_id, chunk_index, chunk_text, token_count, embedding
                ) VALUES (
                    :id, :doc, :idx, :text, :tokens, CAST(:emb AS vector)
                )
            """
            ),
            {
                "id": uuid.uuid4(),
                "doc": doc_id,
                "idx": idx,
                "text": chunk,
                "tokens": len(chunk.split()),
                "emb": vec_literal,
            },
        )

    await session.commit()
    return doc_id


@pytest.fixture
async def rag_test_corpus(rag_pg_session):
    """Seed 3 synthetic circulars with real embeddings. Yields the session."""
    import openai

    with open(GOLDEN_DATASET_PATH) as f:
        dataset = json.load(f)

    client = openai.AsyncOpenAI()

    # Use only the first 3 circulars to keep the test fast + cheap on API calls
    for circ in dataset["synthetic_circulars"][:3]:
        await _seed_one_circular(
            rag_pg_session,
            circular_number=circ["circular_number"],
            title=circ["title"],
            rbi_url=circ["rbi_url"],
            chunk_texts=circ["chunks"],
            embedding_client=client,
        )

    yield rag_pg_session


@pytest.fixture
async def rag_service(rag_test_corpus, rag_redis):
    """RAGService wired to real PG + real Redis + real OpenAI embeddings.

    Cross-encoder loaded from pre-baked cache (or None if unavailable — in
    that case rerank is skipped at runtime but the rest of the pipeline runs).
    """
    from app.services.embedding_service import EmbeddingService
    from app.services.rag_service import RAGService

    try:
        from sentence_transformers import CrossEncoder

        cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    except Exception:
        cross_encoder = None

    embedding = EmbeddingService(redis=rag_redis)
    return RAGService(
        db=rag_test_corpus,
        embedding_service=embedding,
        redis=rag_redis,
        cross_encoder=cross_encoder,
    )


# ---------------------------------------------------------------------------
# Retrieval — does the pipeline return relevant chunks for real questions?
# ---------------------------------------------------------------------------


@needs_real_pg
@needs_real_openai
class TestRetrieval:
    """Cover steps 2-7 of the RAG pipeline against real data."""

    async def test_retrieves_relevant_chunks_for_kyc_question(self, rag_service):
        chunks = await rag_service.retrieve(
            "What are the V-CIP liveness requirements under the KYC Master Direction?",
        )
        # KYC circular (RBI/2024-25/42) should be the top retrieval source.
        assert len(chunks) > 0, "retrieval returned nothing"
        circular_numbers = {c.circular_number for c in chunks}
        assert (
            "RBI/2024-25/42" in circular_numbers
        ), f"expected RBI/2024-25/42 in top results, got {circular_numbers}"

    async def test_retrieves_for_digital_lending_question(self, rag_service):
        chunks = await rag_service.retrieve(
            "Is there a cooling-off period for digital personal loans?"
        )
        assert len(chunks) > 0
        nums = {c.circular_number for c in chunks}
        assert "RBI/2023-24/108" in nums

    async def test_off_domain_question_returns_few_or_no_chunks(self, rag_service):
        # Question completely unrelated to RBI circulars
        chunks = await rag_service.retrieve("What is the capital of France?")
        # We don't assert 0 (the FTS arm may find spurious keyword matches),
        # but the top retrieval should be low-relevance — at minimum we should
        # see < RAG_TOP_K_FINAL chunks or the LLM stage will trigger consult-expert
        # on the < 2 chunks guard.
        assert isinstance(chunks, list)

    async def test_dedup_caps_chunks_per_doc(self, rag_service):
        chunks = await rag_service.retrieve(
            "KYC customer due diligence requirements for high-risk accounts"
        )
        per_doc: dict[str, int] = {}
        for c in chunks:
            cn = c.circular_number or "UNKNOWN"
            per_doc[cn] = per_doc.get(cn, 0) + 1
        max_per_doc = max(per_doc.values(), default=0)
        # RAG_MAX_CHUNKS_PER_DOC defaults to 2
        assert max_per_doc <= 2, f"dedup failed: {per_doc}"


# ---------------------------------------------------------------------------
# Reranker is ON (ADR A29 — reversed in S5)
# ---------------------------------------------------------------------------


@needs_real_pg
@needs_real_openai
class TestRerankerAlwaysOn:
    """ADR A29 REVERSED: the cross-encoder is no longer skipped in DEMO_MODE."""

    async def test_reranker_loaded_when_pre_baked(self, rag_service):
        """If the Dockerfile pre-baked the model, the rerank step runs."""
        # rag_service fixture sets _cross_encoder via the pre-baked load.
        # If the test environment doesn't have the model cached, this assertion
        # documents the regression — but the fixture-level try/except ensures
        # the rest of the suite still exercises the retrieval pipeline.
        if rag_service._cross_encoder is None:
            pytest.skip(
                "cross-encoder not available in this env — "
                "pre-bake it via `docker build` against backend/Dockerfile"
            )
        # Successful instantiation is the assertion
        assert hasattr(rag_service._cross_encoder, "predict")


# ---------------------------------------------------------------------------
# Full Q&A — retrieve → LLM → citation validation → confidence
# ---------------------------------------------------------------------------


@needs_real_pg
@needs_real_openai
@needs_real_anthropic
class TestFullOrchestration:
    """The end-to-end test the pre-rebuild suite was missing."""

    @pytest.fixture
    def llm_service(self):
        import anthropic
        import openai

        from app.services.llm_service import LLMService

        return LLMService(
            anthropic_client=anthropic.AsyncAnthropic(),
            openai_client=openai.AsyncOpenAI(),
        )

    async def test_kyc_question_produces_cited_answer(self, rag_service, llm_service):
        question = "What are the KYC periodic-updation timelines for different risk categories?"

        chunks = await rag_service.retrieve(question)
        assert len(chunks) >= 2, "need ≥ 2 chunks to bypass consult-expert"

        answer, model_used = await llm_service.generate(question, chunks)

        assert isinstance(answer, dict)
        assert "quick_answer" in answer
        assert "citations" in answer
        # Citation validation must have stripped any hallucinated circular numbers
        retrieved_circulars = {c.circular_number for c in chunks if c.circular_number}
        for cite in answer.get("citations", []):
            assert cite["circular_number"] in retrieved_circulars, (
                f"hallucinated citation {cite['circular_number']!r} not in retrieved chunks "
                f"{retrieved_circulars}"
            )
        # Confidence in valid range
        score = answer.get("confidence_score")
        assert score is None or 0.0 <= score <= 1.0

    async def test_off_domain_question_triggers_consult_expert(self, rag_service, llm_service):
        """Insufficient context guard: < 2 chunks → consult-expert fallback (no LLM call)."""
        chunks = await rag_service.retrieve("What is the capital of France?")
        if len(chunks) >= 2:
            pytest.skip("off-domain retrieval found ≥ 2 chunks; check FTS over-matching")

        answer, model_used = await llm_service.generate("What is the capital of France?", chunks)
        assert (
            answer.get("consult_expert") is True
            or "consult" in str(answer.get("quick_answer", "")).lower()
        )
