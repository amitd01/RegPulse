"""Questions router — ask, history, detail, feedback.

POST /questions — ask a question (SSE streaming or JSON)
GET  /questions — paginated history
GET  /questions/{id} — question detail
PATCH /questions/{id}/feedback — submit feedback
"""

from __future__ import annotations

import json
import time
import uuid

import structlog
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import get_redis
from app.db import get_db
from app.dependencies.auth import require_credits, require_verified_user
from app.dependencies.rag import build_llm_service, build_rag_service
from app.models.question import InterpretationFeedback, Question
from app.models.user import User
from app.schemas.questions import (
    FeedbackRequest,
    QuestionDetail,
    QuestionListResponse,
    QuestionRequest,
    QuestionResponse,
    QuestionSuggestionItem,
    QuestionSuggestionListResponse,
    QuestionSummary,
    QuestionThreadResponse,
)
from app.services.email_service import EmailService
from app.services.llm_service import LLMService
from app.services.rag_service import RAGService, RetrievedChunk
from app.utils.credit_utils import deduct_credit
from app.utils.org_utils import question_in_org, user_org_domain

router = APIRouter(tags=["questions"])
logger = structlog.get_logger("regpulse.questions")

_MAX_CONVERSATION_TURNS = 5


def _chunks_from_stored(stored: list | dict | None) -> list[RetrievedChunk]:
    """Rehydrate RetrievedChunk objects from a question's chunks_used JSONB."""
    if not stored or not isinstance(stored, list):
        return []
    chunks: list[RetrievedChunk] = []
    for item in stored:
        if not isinstance(item, dict):
            continue
        chunk_id = item.get("chunk_id")
        if not chunk_id:
            continue
        chunks.append(
            RetrievedChunk(
                chunk_id=str(chunk_id),
                document_id=str(item.get("document_id", "")),
                chunk_index=int(item.get("chunk_index", 0)),
                chunk_text=str(item.get("chunk_text", "")),
                token_count=int(item.get("token_count", 0)),
                circular_number=item.get("circular_number"),
                title=str(item.get("title", "RBI Circular")),
                rbi_url=str(item.get("rbi_url", "")),
            )
        )
    return chunks


def _merge_chunks(*chunk_lists: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Deduplicate chunks by chunk_id, preserving first-seen order."""
    seen: set[str] = set()
    merged: list[RetrievedChunk] = []
    for chunk_list in chunk_lists:
        for chunk in chunk_list:
            if chunk.chunk_id in seen:
                continue
            seen.add(chunk.chunk_id)
            merged.append(chunk)
    return merged


async def _load_parent_thread_chunks(
    db: AsyncSession,
    user_id: uuid.UUID,
    parent_question_id: uuid.UUID,
    max_turns: int = _MAX_CONVERSATION_TURNS,
) -> list[RetrievedChunk]:
    """Collect chunks_used from the parent chain for follow-up retrieval continuity."""
    collected: list[RetrievedChunk] = []
    current_id: uuid.UUID | None = parent_question_id

    for _ in range(max_turns):
        if current_id is None:
            break
        stmt = select(Question).where(
            Question.id == current_id,
            Question.user_id == user_id,
            Question.streaming_completed.is_(True),
        )
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row is None:
            break
        collected = _merge_chunks(_chunks_from_stored(row.chunks_used), collected)
        current_id = row.parent_question_id

    return collected


async def _load_conversation_history(
    db: AsyncSession,
    user_id: uuid.UUID,
    parent_question_id: uuid.UUID,
    max_turns: int = _MAX_CONVERSATION_TURNS,
) -> list[tuple[str, str]]:
    """Walk the parent chain and return (question, answer) pairs oldest-first."""
    history: list[tuple[str, str]] = []
    current_id: uuid.UUID | None = parent_question_id

    for _ in range(max_turns):
        if current_id is None:
            break
        stmt = select(Question).where(
            Question.id == current_id,
            Question.user_id == user_id,
            Question.streaming_completed.is_(True),
        )
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row is None:
            break
        if row.answer_text:
            history.append((row.question_text, row.answer_text))
        current_id = row.parent_question_id

    history.reverse()
    return history


async def _resolve_parent_question(
    db: AsyncSession,
    user_id: uuid.UUID,
    parent_question_id: uuid.UUID | None,
) -> tuple[uuid.UUID | None, list[tuple[str, str]], list[RetrievedChunk]]:
    """Validate parent ownership and return (parent_id, history, parent thread chunks)."""
    if parent_question_id is None:
        return None, [], []

    from app.exceptions import RegPulseException

    class InvalidParentQuestionError(RegPulseException):
        http_status = 400
        error_code = "INVALID_PARENT_QUESTION"

    stmt = select(Question).where(
        Question.id == parent_question_id,
        Question.user_id == user_id,
        Question.streaming_completed.is_(True),
    )
    parent = (await db.execute(stmt)).scalar_one_or_none()
    if parent is None or not parent.answer_text:
        raise InvalidParentQuestionError(
            "Parent question not found or not ready for follow-up"
        )

    history = await _load_conversation_history(db, user_id, parent_question_id)
    parent_chunks = await _load_parent_thread_chunks(db, user_id, parent_question_id)
    return parent_question_id, history, parent_chunks


async def _resolve_thread_root_id(
    db: AsyncSession,
    user_id: uuid.UUID,
    question_id: uuid.UUID,
) -> uuid.UUID | None:
    """Walk parent_question_id chain to the conversation root."""
    current_id = question_id
    while True:
        stmt = select(Question.id, Question.parent_question_id, Question.user_id).where(
            Question.id == current_id
        )
        result = await db.execute(stmt)
        row = result.one_or_none()
        if row is None or row.user_id != user_id:
            return None
        if row.parent_question_id is None:
            return row.id
        current_id = row.parent_question_id


async def _load_thread_questions(
    db: AsyncSession,
    user_id: uuid.UUID,
    root_id: uuid.UUID,
) -> list[Question]:
    """Load the root question and linear follow-ups in chronological order."""
    stmt = (
        select(Question)
        .options(selectinload(Question.interpretation_feedback))
        .where(Question.id == root_id, Question.user_id == user_id)
    )
    result = await db.execute(stmt)
    root = result.scalar_one_or_none()
    if root is None:
        return []

    thread = [root]
    parent_id = root.id
    while True:
        child_stmt = (
            select(Question)
            .options(selectinload(Question.interpretation_feedback))
            .where(
                Question.user_id == user_id,
                Question.parent_question_id == parent_id,
            )
            .order_by(Question.created_at)
            .limit(1)
        )
        child_result = await db.execute(child_stmt)
        child = child_result.scalar_one_or_none()
        if child is None:
            break
        thread.append(child)
        parent_id = child.id
    return thread


async def _maybe_embed_question(request: Request, text: str) -> list[float] | None:
    """Embed ``text`` via app.state.embedding_service; return None on failure.

    Suggestions depend on ``questions.question_embedding`` being populated,
    but an embedding failure must never block a Q&A response. EmbeddingService
    is Redis-cached by SHA256 — this usually hits the cache already warmed by
    ``RAGService.retrieve()`` earlier in the request.
    """
    svc = getattr(request.app.state, "embedding_service", None)
    if svc is None:
        return None
    try:
        return await svc.generate_single(text)
    except Exception:
        logger.warning("question_embedding_failed", exc_info=True)
        return None


# ---------------------------------------------------------------------------
# POST /questions — ask a question
# ---------------------------------------------------------------------------


@router.post("", response_model=None)
async def ask_question(
    body: QuestionRequest,
    request: Request,
    user: User = Depends(require_credits),
    db: AsyncSession = Depends(get_db),
    redis: object = Depends(get_redis),
) -> QuestionResponse | StreamingResponse:
    """Ask a regulatory question.

    If Accept: text/event-stream, returns SSE stream.
    Otherwise returns full JSON response.
    """
    start_time = time.perf_counter()

    rag = build_rag_service(request, db, redis)
    llm = build_llm_service(request)

    question_text = body.question.strip()
    parent_question_id, conversation_history, parent_thread_chunks = await _resolve_parent_question(
        db, user.id, body.parent_question_id
    )
    is_follow_up = parent_question_id is not None

    # 1. Check answer cache (skip for follow-ups — context differs from standalone cache)
    cached = None if parent_question_id else await rag.check_cache(question_text)
    if cached:
        logger.info("question_cache_hit")
        accept = request.headers.get("accept", "")
        if "text/event-stream" in accept:
            # Frontend always uses SSE — return cached data as SSE events
            # so the stream parser receives the same event sequence as a
            # live answer. No credit is deducted on a cache hit.
            return StreamingResponse(
                _stream_cached_response(cached, user.credit_balance),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        return QuestionResponse(
            data=QuestionDetail(**cached),
            credit_balance=user.credit_balance,  # No deduction for cache hit
        )

    # 2. Retrieve relevant chunks (boost query with parent context for follow-ups)
    retrieval_query = question_text
    if is_follow_up and conversation_history:
        retrieval_query = f"{conversation_history[-1][0]} {question_text}"
    fresh_chunks = await rag.retrieve(retrieval_query)
    chunks = (
        _merge_chunks(parent_thread_chunks, fresh_chunks) if is_follow_up else fresh_chunks
    )

    if not chunks and not (is_follow_up and conversation_history):
        # No relevant chunks found — return no-answer, no credit charge
        no_answer = Question(
            id=uuid.uuid4(),
            user_id=user.id,
            parent_question_id=parent_question_id,
            question_text=question_text,
            answer_text="I couldn't find relevant RBI circulars to answer this question.",
            quick_answer="No relevant circulars found.",
            risk_level=None,
            credit_deducted=False,
            streaming_completed=True,
            latency_ms=int((time.perf_counter() - start_time) * 1000),
        )
        db.add(no_answer)
        await db.commit()
        await db.refresh(no_answer)

        return QuestionResponse(
            data=QuestionDetail.model_validate(no_answer),
            credit_balance=user.credit_balance,
        )

    # 3. Check if SSE requested
    accept = request.headers.get("accept", "")
    if "text/event-stream" in accept:
        return StreamingResponse(
            _stream_response(
                request=request,
                question_text=question_text,
                chunks=chunks,
                llm=llm,
                rag=rag,
                db=db,
                user=user,
                start_time=start_time,
                parent_question_id=parent_question_id,
                conversation_history=conversation_history,
                is_follow_up=is_follow_up,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # 4. Non-streaming: call LLM directly
    llm_response, model_used = await llm.generate(
        question_text,
        chunks,
        conversation_history=conversation_history or None,
        is_follow_up=is_follow_up,
    )
    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # 4b. Embed the question so /questions/suggestions can ANN-search it.
    # EmbeddingService is Redis-cached on SHA256 — this is a cache hit after
    # RAG.retrieve() embedded the same string a moment ago.
    question_embedding = await _maybe_embed_question(request, question_text)

    # 5. Create question record + deduct credit atomically
    question = Question(
        id=uuid.uuid4(),
        user_id=user.id,
        parent_question_id=parent_question_id,
        question_text=question_text,
        question_embedding=question_embedding,
        answer_text=llm_response.get("detailed_interpretation"),
        quick_answer=llm_response.get("quick_answer"),
        risk_level=llm_response.get("risk_level"),
        confidence_score=llm_response.get("confidence_score"),
        consult_expert=bool(llm_response.get("consult_expert", False)),
        affected_teams=llm_response.get("affected_teams", []),
        citations=llm_response.get("citations", []),
        recommended_actions=llm_response.get("recommended_actions", []),
        chunks_used=[c.to_dict() for c in chunks],
        model_used=model_used,
        credit_deducted=True,
        streaming_completed=True,
        latency_ms=latency_ms,
    )
    db.add(question)
    new_balance = await deduct_credit(db, user.id)
    await db.commit()
    await db.refresh(question)

    # 5b. Low-credit notification at thresholds 5 or 2
    if new_balance in (5, 2):
        try:
            email_svc = EmailService()
            await email_svc.send_low_credits_email(user.email, new_balance)
        except Exception:
            logger.warning("low_credit_email_failed", user_id=str(user.id))

    # 6. Cache the answer
    await rag.cache_answer(
        question_text,
        {
            "id": str(question.id),
            "question_text": question.question_text,
            "answer_text": question.answer_text,
            "quick_answer": question.quick_answer,
            "risk_level": question.risk_level,
            "confidence_score": question.confidence_score,
            "consult_expert": question.consult_expert,
            "affected_teams": question.affected_teams,
            "citations": question.citations,
            "recommended_actions": question.recommended_actions,
            "model_used": question.model_used,
            "credit_deducted": question.credit_deducted,
            "streaming_completed": question.streaming_completed,
            "latency_ms": question.latency_ms,
            "feedback_record": None,
            "created_at": question.created_at.isoformat(),
        },
    )

    return QuestionResponse(
        data=QuestionDetail.model_validate(question),
        credit_balance=new_balance,
    )


async def _stream_cached_response(cached: dict, credit_balance: int):
    """Yield SSE events for a Redis cache hit.

    Emits the same event sequence the frontend expects from a live stream
    (token → citations → done) so the SSE parser works identically.
    No credit is deducted; credit_balance is passed through unchanged.
    """
    # token event — emit the stored detailed answer so the frontend renders it
    answer_text = cached.get("answer_text") or ""
    yield f"event: token\ndata: {json.dumps({'token': answer_text})}\n\n"

    # citations event — all metadata the frontend needs for the answer card
    citations_payload = {
        "citations": cached.get("citations") or [],
        "risk_level": cached.get("risk_level"),
        "confidence_score": cached.get("confidence_score"),
        "consult_expert": bool(cached.get("consult_expert", False)),
        "affected_teams": cached.get("affected_teams") or [],
        "recommended_actions": cached.get("recommended_actions") or [],
        "quick_answer": cached.get("quick_answer"),
        "model_used": cached.get("model_used"),
    }
    yield f"event: citations\ndata: {json.dumps(citations_payload)}\n\n"

    # done event — question_id so history link works; credit unchanged
    done_payload = {
        "question_id": cached.get("id"),
        "credit_balance": credit_balance,
    }
    yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"


async def _stream_response(
    *,
    request: Request,
    question_text: str,
    chunks: list,
    llm: LLMService,
    rag: RAGService,
    db: AsyncSession,
    user: User,
    start_time: float,
    parent_question_id: uuid.UUID | None = None,
    conversation_history: list[tuple[str, str]] | None = None,
    is_follow_up: bool = False,
):
    """SSE generator for streaming responses.

    Two separate try/except regions:
    1. LLM streaming — errors here emit event:error (nothing useful was sent yet).
    2. Post-stream DB/cache work — errors here are logged with full traceback but
       NEVER emit event:error; the client always receives event:done so it can
       display the answer it already rendered.
    """
    full_text = ""
    metadata: dict = {}
    model_used = None

    # -----------------------------------------------------------------------
    # Phase 1 — LLM streaming (token + citations events)
    # Failure here → emit event:error (no answer was shown yet).
    # -----------------------------------------------------------------------
    try:
        async for event_type, data in llm.generate_stream(
            question_text,
            chunks,
            conversation_history=conversation_history or None,
            is_follow_up=is_follow_up,
        ):
            if event_type == "token":
                token_data = json.loads(data)
                full_text += token_data.get("token", "")
                yield f"event: token\ndata: {data}\n\n"
            elif event_type == "citations":
                metadata = json.loads(data)
                model_used = metadata.get("model_used")
                yield f"event: citations\ndata: {data}\n\n"
    except Exception as e:
        import traceback as _tb

        _tb.print_exc()
        logger.exception("stream_llm_error", error=str(e))
        error_data = json.dumps({"error": "An error occurred during streaming"})
        yield f"event: error\ndata: {error_data}\n\n"
        return

    # -----------------------------------------------------------------------
    # Phase 2 — persist to DB + deduct credit + emit done
    # Failure here is logged with full traceback, but we STILL emit event:done
    # so the frontend displays the answer it already received without an
    # error banner.  question_id will be null when persistence failed.
    # -----------------------------------------------------------------------
    question_id: str | None = None
    new_balance: int = user.credit_balance

    try:
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        question_embedding = await _maybe_embed_question(request, question_text)

        # Extract detailed_interpretation from the raw-JSON token stream.
        # The LLM streams the entire JSON object character-by-character, so
        # full_text is a JSON string when parsing succeeds.  Fall back to
        # storing full_text as-is if it is not valid JSON (e.g. fallback path).
        try:
            parsed_full = json.loads(full_text)
            answer_text: str | None = parsed_full.get("detailed_interpretation") or full_text
        except (json.JSONDecodeError, ValueError):
            answer_text = full_text

        question = Question(
            id=uuid.uuid4(),
            user_id=user.id,
            parent_question_id=parent_question_id,
            question_text=question_text,
            question_embedding=question_embedding,
            answer_text=answer_text,
            quick_answer=metadata.get("quick_answer"),
            risk_level=metadata.get("risk_level"),
            confidence_score=metadata.get("confidence_score"),
            consult_expert=bool(metadata.get("consult_expert", False)),
            affected_teams=metadata.get("affected_teams", []),
            citations=metadata.get("citations", []),
            recommended_actions=metadata.get("recommended_actions", []),
            chunks_used=[c.to_dict() for c in chunks],
            model_used=model_used,
            credit_deducted=True,
            streaming_completed=True,
            latency_ms=latency_ms,
        )
        db.add(question)
        new_balance = await deduct_credit(db, user.id)
        await db.commit()
        # Refresh so server-default columns (created_at, etc.) are populated.
        await db.refresh(question)
        question_id = str(question.id)

        # Low-credit notification at thresholds 5 or 2
        if new_balance in (5, 2):
            try:
                email_svc = EmailService()
                await email_svc.send_low_credits_email(user.email, new_balance)
            except Exception:
                logger.warning("low_credit_email_failed", user_id=str(user.id))

        # Cache — isolated so a Redis failure never prevents event:done
        try:
            await rag.cache_answer(
                question_text,
                {
                    "id": question_id,
                    "question_text": question.question_text,
                    "answer_text": question.answer_text,
                    "quick_answer": metadata.get("quick_answer"),
                    "risk_level": metadata.get("risk_level"),
                    "confidence_score": metadata.get("confidence_score"),
                    "consult_expert": bool(metadata.get("consult_expert", False)),
                    "affected_teams": metadata.get("affected_teams", []),
                    "citations": metadata.get("citations", []),
                    "recommended_actions": metadata.get("recommended_actions", []),
                    "model_used": model_used,
                    "credit_deducted": True,
                    "streaming_completed": True,
                    "latency_ms": latency_ms,
                    "feedback_record": None,
                    "created_at": question.created_at.isoformat(),
                },
            )
        except Exception:
            logger.warning("stream_cache_failed", exc_info=True)

    except Exception as e:
        import traceback as _tb

        _tb.print_exc()
        logger.exception("post_stream_db_error", error=str(e))
        # Do NOT emit event:error — the answer was already rendered.
        # Fall through to emit event:done with null question_id so the
        # frontend can still update the credit balance display and stop the
        # spinner.  The question history row will be missing for this request.

    done_data = json.dumps(
        {
            "question_id": question_id,
            "credit_balance": new_balance,
        }
    )
    yield f"event: done\ndata: {done_data}\n\n"


# ---------------------------------------------------------------------------
# GET /questions — history
# ---------------------------------------------------------------------------


@router.get("", response_model=QuestionListResponse)
async def list_questions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    roots_only: bool = Query(
        default=False,
        description="When true, return only conversation starters (no follow-ups).",
    ),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionListResponse:
    """Get paginated question history for the current user."""
    filters = [Question.user_id == user.id]
    if roots_only:
        filters.append(Question.parent_question_id.is_(None))

    count_stmt = select(func.count(Question.id)).where(*filters)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = (
        select(Question)
        .options(selectinload(Question.interpretation_feedback))
        .where(*filters)
        .order_by(desc(Question.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    questions = list(result.scalars().all())

    return QuestionListResponse(
        data=[QuestionSummary.model_validate(q) for q in questions],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# GET /questions/suggestions — similar past questions for autocomplete
# ---------------------------------------------------------------------------


@router.get("/suggestions", response_model=QuestionSuggestionListResponse)
async def question_suggestions(
    request: Request,
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(default=5, ge=1, le=20),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionSuggestionListResponse:
    """Return up to ``limit`` of the current user's past questions most
    similar to ``q`` by cosine distance on ``question_embedding``.

    Returns an empty list when the partial query is shorter than 5 chars
    (noise floor) or when embeddings aren't available.
    """
    if len(q.strip()) < 5:
        return QuestionSuggestionListResponse(data=[])

    embedding = await _maybe_embed_question(request, q.strip())
    if embedding is None:
        return QuestionSuggestionListResponse(data=[])

    # pgvector cosine distance operator: <=>.
    # This query is Postgres/pgvector-only — callers in SQLite-based unit tests
    # should mock the endpoint rather than hit this path.
    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect != "postgresql":
        return QuestionSuggestionListResponse(data=[])

    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
    sql = text("""
        SELECT id, question_text, quick_answer
        FROM questions
        WHERE user_id = :user_id
          AND question_embedding IS NOT NULL
          AND streaming_completed = TRUE
        ORDER BY question_embedding <=> CAST(:vec AS vector)
        LIMIT :limit
        """)
    rows = (
        await db.execute(
            sql,
            {"user_id": user.id, "vec": embedding_str, "limit": limit},
        )
    ).all()

    items = [
        QuestionSuggestionItem(
            id=row[0],
            question_text=row[1],
            quick_answer_preview=(row[2] or "")[:120] if row[2] else None,
        )
        for row in rows
    ]
    return QuestionSuggestionListResponse(data=items)


# ---------------------------------------------------------------------------
# GET /questions/{id}/thread — full conversation (root + follow-ups)
# ---------------------------------------------------------------------------


@router.get("/{question_id}/thread", response_model=QuestionThreadResponse)
async def get_question_thread(
    question_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionThreadResponse:
    """Return all questions in a conversation thread, oldest first."""
    root_id = await _resolve_thread_root_id(db, user.id, question_id)
    if root_id is None:
        from app.exceptions import RegPulseException

        class QuestionNotFoundError(RegPulseException):
            http_status = 404
            error_code = "QUESTION_NOT_FOUND"

        raise QuestionNotFoundError("Question not found")

    thread = await _load_thread_questions(db, user.id, root_id)
    return QuestionThreadResponse(
        root_question_id=root_id,
        data=[QuestionDetail.model_validate(q) for q in thread],
    )


# ---------------------------------------------------------------------------
# GET /questions/{id} — detail
# ---------------------------------------------------------------------------


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    """Get question detail. Owner or same-org teammates (team collaboration)."""
    stmt = (
        select(Question)
        .options(selectinload(Question.interpretation_feedback))
        .where(Question.id == question_id)
    )
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()

    if question is None or (
        question.user_id != user.id
        and not await question_in_org(db, question_id, user_org_domain(user))
    ):
        from app.exceptions import RegPulseException

        class QuestionNotFoundError(RegPulseException):
            http_status = 404
            error_code = "QUESTION_NOT_FOUND"

        raise QuestionNotFoundError("Question not found")

    return QuestionResponse(
        data=QuestionDetail.model_validate(question),
        credit_balance=user.credit_balance,
    )


# ---------------------------------------------------------------------------
# GET /questions/{id}/export — compliance brief export
# ---------------------------------------------------------------------------


@router.get("/{question_id}/export")
async def export_question(
    question_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export a question as a downloadable PDF compliance brief.

    Citations in the PDF include a QR code pointing to the underlying
    RBI circular URL (Sprint 8, G-09).
    """
    stmt = select(Question).where(
        Question.id == question_id,
        Question.user_id == user.id,
    )
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()

    if question is None:
        from app.exceptions import RegPulseException

        class QuestionNotFoundError(RegPulseException):
            http_status = 404
            error_code = "QUESTION_NOT_FOUND"

        raise QuestionNotFoundError("Question not found")

    from app.models.circular import CircularDocument
    from app.services.pdf_export_service import PDFExportService

    # Resolve rbi_url for each cited circular_number (a single IN query).
    raw_citations = list(question.citations or [])
    nums = [c.get("circular_number") for c in raw_citations if c.get("circular_number")]
    url_map: dict[str, str] = {}
    if nums:
        url_rows = await db.execute(
            select(CircularDocument.circular_number, CircularDocument.rbi_url).where(
                CircularDocument.circular_number.in_(nums)
            )
        )
        url_map = {row[0]: row[1] for row in url_rows.all() if row[0]}

    citations_with_urls = [
        {**c, "rbi_url": url_map.get(c.get("circular_number") or "")} for c in raw_citations
    ]

    pdf_bytes = PDFExportService.generate_pdf_brief(
        question_text=question.question_text,
        answer_text=question.answer_text,
        quick_answer=question.quick_answer,
        risk_level=question.risk_level,
        affected_teams=question.affected_teams,
        citations=citations_with_urls,
        recommended_actions=question.recommended_actions,
        created_at=question.created_at.isoformat() if question.created_at else None,
    )

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (f'attachment; filename="regpulse_brief_{question_id}.pdf"'),
        },
    )


# ---------------------------------------------------------------------------
# PATCH /questions/{id}/feedback
# ---------------------------------------------------------------------------


@router.patch("/{question_id}/feedback")
async def submit_feedback(
    question_id: uuid.UUID,
    body: FeedbackRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upsert structured feedback on an answer interpretation."""
    from app.exceptions import RegPulseException

    class QuestionNotFoundError(RegPulseException):
        http_status = 404
        error_code = "QUESTION_NOT_FOUND"

    stmt = select(Question).where(
        Question.id == question_id,
        Question.user_id == user.id,
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise QuestionNotFoundError("Question not found")

    # Resolve category enum value (None stays None)
    from app.models.question import FeedbackCategory as FbCat

    category = None
    if body.category:
        try:
            category = FbCat(body.category)
        except ValueError:
            pass  # unrecognised value — store as null

    # Upsert: one feedback record per (question, user)
    existing_stmt = select(InterpretationFeedback).where(
        InterpretationFeedback.question_id == question_id,
        InterpretationFeedback.user_id == user.id,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()

    from datetime import UTC, datetime

    if existing:
        existing.is_helpful = body.is_helpful
        existing.category = category
        existing.comment = body.comment
        existing.updated_at = datetime.now(UTC)
    else:
        db.add(
            InterpretationFeedback(
                question_id=question_id,
                user_id=user.id,
                is_helpful=body.is_helpful,
                category=category,
                comment=body.comment,
            )
        )

    await db.commit()
    return {"success": True, "message": "Feedback recorded"}
