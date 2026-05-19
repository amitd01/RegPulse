"""Team Learnings router — full implementation (v4 G-13, slice 9b).

Replaces the S2 stub. Backs the `/learnings` Frontend v2 page + the
save-as-team-learning action on the Ask page. Persistence model is
`learnings`; rows are user-scoped (no org_id yet — that lands with the
workspaces work in a later sprint).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models.learning import Learning
from app.models.user import User
from app.schemas.learnings import (
    LearningCreateRequest,
    LearningDetailResponse,
    LearningItem,
    LearningListResponse,
    LearningStats,
    LearningStatsResponse,
    LearningUpdateRequest,
)

router = APIRouter(tags=["learnings"])
logger = structlog.get_logger("regpulse.learnings")


def _initials(user: User) -> str:
    name = (user.full_name or user.email or "").strip()
    if not name:
        return "??"
    parts = [p for p in name.split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper()


def _parse_tags(raw: object) -> list[str]:
    """Tags may come back as a list (PG JSONB) or a JSON string (SQLite test
    bed where JSONB → String swap means SQLAlchemy doesn't deserialize)."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str):
        import json as _json

        try:
            decoded = _json.loads(raw)
            return [str(t) for t in decoded] if isinstance(decoded, list) else []
        except (ValueError, TypeError):
            return []
    return []


def _to_item(row: Learning, user: User | None) -> LearningItem:
    return LearningItem(
        id=row.id,
        user_id=row.user_id or uuid.UUID(int=0),
        user_initials=_initials(user) if user else "??",
        question_id=row.question_id,
        source_circular_id=row.source_circular_id,
        title=row.title,
        note=row.note,
        tags=_parse_tags(row.tags),
        pinned=row.pinned,
        created_at=row.created_at,
    )


# ---------------------------------------------------------------------------
# /stats — declared BEFORE /{id} so route ordering routes correctly
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=LearningStatsResponse)
async def learnings_stats(
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> LearningStatsResponse:
    """Header MiniStats — TOTAL / THIS WEEK / CONTRIBUTORS."""
    week_ago = datetime.now(UTC) - timedelta(days=7)

    stmt = select(
        func.count(Learning.id).label("total"),
        func.sum(
            case((Learning.created_at >= week_ago, 1), else_=0)
        ).label("this_week"),
        func.count(func.distinct(Learning.user_id)).label("contributors"),
    )
    result = await db.execute(stmt)
    row = result.one()

    return LearningStatsResponse(
        data=LearningStats(
            total=int(row.total or 0),
            this_week=int(row.this_week or 0),
            contributors=int(row.contributors or 0),
        )
    )


# ---------------------------------------------------------------------------
# List + detail + CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=LearningListResponse)
async def list_learnings(
    pinned: bool | None = Query(default=None, description="Filter pinned learnings only"),
    tag: str | None = Query(default=None, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> LearningListResponse:
    stmt = select(Learning).order_by(
        Learning.pinned.desc(), Learning.created_at.desc()
    )
    if pinned is True:
        stmt = stmt.where(Learning.pinned.is_(True))
    if tag:
        # JSONB contains check works in PG; SQLite falls through to a
        # python-side LIKE on the tag list serialisation for unit tests.
        if db.bind and db.bind.dialect.name == "postgresql":
            stmt = stmt.where(Learning.tags.op("@>")([tag]))
        else:
            stmt = stmt.where(Learning.tags.cast(str).contains(tag))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()

    # Resolve user_initials in one batch
    user_ids = {r.user_id for r in rows if r.user_id is not None}
    users: dict[uuid.UUID, User] = {}
    if user_ids:
        u_stmt = select(User).where(User.id.in_(user_ids))
        for u in (await db.execute(u_stmt)).scalars().all():
            users[u.id] = u

    return LearningListResponse(
        data=[_to_item(r, users.get(r.user_id) if r.user_id else None) for r in rows],
        total=total,
    )


@router.get("/{learning_id}", response_model=LearningDetailResponse)
async def get_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> LearningDetailResponse:
    row = await db.get(Learning, learning_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Learning not found",
                "code": "LEARNING_NOT_FOUND",
            },
        )
    owner = await db.get(User, row.user_id) if row.user_id else None
    return LearningDetailResponse(data=_to_item(row, owner))


@router.post(
    "", response_model=LearningDetailResponse, status_code=status.HTTP_201_CREATED
)
async def create_learning(
    body: LearningCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> LearningDetailResponse:
    now = datetime.now(UTC)
    row = Learning(
        id=uuid.uuid4(),
        user_id=user.id,
        question_id=body.question_id,
        source_circular_id=body.source_circular_id,
        title=body.title,
        note=body.note,
        tags=body.tags or [],
        pinned=False,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    logger.info(
        "learning_created",
        learning_id=str(row.id),
        user_id=str(user.id),
        question_id=str(body.question_id) if body.question_id else None,
        notify_team=body.notify_team,
    )
    return LearningDetailResponse(data=_to_item(row, user))


@router.patch("/{learning_id}", response_model=LearningDetailResponse)
async def update_learning(
    learning_id: uuid.UUID,
    body: LearningUpdateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> LearningDetailResponse:
    row = await db.get(Learning, learning_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Learning not found",
                "code": "LEARNING_NOT_FOUND",
            },
        )
    if body.title is not None:
        row.title = body.title
    if body.note is not None:
        row.note = body.note
    if body.tags is not None:
        row.tags = body.tags
    if body.pinned is not None:
        row.pinned = body.pinned
    row.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(row)
    return LearningDetailResponse(data=_to_item(row, user))


@router.post("/{learning_id}/pin", response_model=LearningDetailResponse)
async def pin_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> LearningDetailResponse:
    row = await db.get(Learning, learning_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Learning not found",
                "code": "LEARNING_NOT_FOUND",
            },
        )
    row.pinned = not row.pinned
    row.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(row)
    return LearningDetailResponse(data=_to_item(row, user))


@router.delete("/{learning_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Learning, learning_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Learning not found",
                "code": "LEARNING_NOT_FOUND",
            },
        )
    await db.delete(row)
    await db.commit()
