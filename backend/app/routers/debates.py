"""Debates router — full implementation (v4 G-14, slice 9c).

Replaces the S2 stub. Backs the `/debate` Frontend v2 page + the right-rail
debate panel on the Ask page. Persistence via `debates` + `debate_replies`.
Agree/disagree counts are computed on read (sum of reply stances).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models.debate import Debate, DebateReply, DebateStance, DebateStatus
from app.models.user import User
from app.schemas.debates import (
    DebateCreateRequest,
    DebateDetail,
    DebateDetailResponse,
    DebateItem,
    DebateListResponse,
    DebateReplyRequest,
    DebateResolveRequest,
)
from app.schemas.debates import (
    DebateReply as DebateReplySchema,
)
from app.schemas.debates import (
    DebateStance as DebateStanceSchema,
)
from app.schemas.debates import (
    DebateStatus as DebateStatusSchema,
)

router = APIRouter(tags=["debates"])
logger = structlog.get_logger("regpulse.debates")


def _initials(user: User | None) -> str:
    if not user:
        return "??"
    name = (user.full_name or user.email or "").strip()
    if not name:
        return "??"
    parts = [p for p in name.split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper()


async def _user_lookup(db: AsyncSession, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    if not user_ids:
        return {}
    stmt = select(User).where(User.id.in_(user_ids))
    return {u.id: u for u in (await db.execute(stmt)).scalars().all()}


def _reply_to_schema(r: DebateReply, owner: User | None) -> DebateReplySchema:
    return DebateReplySchema(
        id=r.id,
        debate_id=r.debate_id,
        user_id=r.user_id or uuid.UUID(int=0),
        user_initials=_initials(owner),
        text=r.text,
        stance=DebateStanceSchema(r.stance.value if hasattr(r.stance, "value") else str(r.stance)),
        created_at=r.created_at,
    )


def _to_item(
    d: Debate,
    owner: User | None,
    *,
    agree: int = 0,
    disagree: int = 0,
    reply_count: int = 0,
) -> DebateItem:
    status_str = d.status.value if hasattr(d.status, "value") else str(d.status)
    return DebateItem(
        id=d.id,
        user_id=d.user_id or uuid.UUID(int=0),
        user_initials=_initials(owner),
        question_id=d.question_id,
        source_circular_id=d.source_circular_id,
        title=d.title,
        status=DebateStatusSchema(status_str),
        agree_count=agree,
        disagree_count=disagree,
        reply_count=reply_count,
        resolution_text=d.resolution_text,
        resolved_by=d.resolved_by,
        resolved_at=d.resolved_at,
        created_at=d.created_at,
    )


def _to_detail(
    d: Debate,
    owner: User | None,
    replies: list[DebateReplySchema],
) -> DebateDetail:
    agree = sum(1 for r in replies if r.stance == DebateStanceSchema.AGREE)
    disagree = sum(1 for r in replies if r.stance == DebateStanceSchema.DISAGREE)
    item = _to_item(d, owner, agree=agree, disagree=disagree, reply_count=len(replies))
    return DebateDetail(**item.model_dump(), replies=replies)


# ---------------------------------------------------------------------------


@router.get("", response_model=DebateListResponse)
async def list_debates(
    status_filter: DebateStatusSchema | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateListResponse:
    stmt = select(Debate).order_by(Debate.created_at.desc())
    if status_filter is not None:
        stmt = stmt.where(Debate.status == DebateStatus(status_filter.value))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int((await db.execute(count_stmt)).scalar_one() or 0)
    open_count = int(
        (
            await db.execute(
                select(func.count(Debate.id)).where(Debate.status == DebateStatus.OPEN)
            )
        ).scalar_one()
        or 0
    )

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()
    owners = await _user_lookup(db, {r.user_id for r in rows if r.user_id})

    # Pull reply stance + count aggregates for the page in one query
    if rows:
        reply_stmt = (
            select(
                DebateReply.debate_id,
                func.sum(case((DebateReply.stance == DebateStance.AGREE, 1), else_=0)).label(
                    "agree"
                ),
                func.sum(case((DebateReply.stance == DebateStance.DISAGREE, 1), else_=0)).label(
                    "disagree"
                ),
                func.count(DebateReply.id).label("count"),
            )
            .where(DebateReply.debate_id.in_([r.id for r in rows]))
            .group_by(DebateReply.debate_id)
        )
        aggs = {
            row.debate_id: (int(row.agree or 0), int(row.disagree or 0), int(row.count or 0))
            for row in (await db.execute(reply_stmt)).all()
        }
    else:
        aggs = {}

    items = []
    for d in rows:
        a, dis, cnt = aggs.get(d.id, (0, 0, 0))
        owner = owners.get(d.user_id) if d.user_id else None
        items.append(_to_item(d, owner, agree=a, disagree=dis, reply_count=cnt))

    return DebateListResponse(data=items, total=total, open_count=open_count)


@router.get("/{debate_id}", response_model=DebateDetailResponse)
async def get_debate(
    debate_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailResponse:
    d = await db.get(Debate, debate_id)
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Debate not found",
                "code": "DEBATE_NOT_FOUND",
            },
        )
    # Use the selectin-loaded `replies` relationship rather than a manual
    # SELECT — keeps PG and SQLite test bed in sync (the manual where-clause
    # binding has UUID-vs-text comparison issues on SQLite when the column
    # type was swapped).
    replies = sorted(d.replies, key=lambda r: r.created_at)
    user_ids = {d.user_id} | {r.user_id for r in replies if r.user_id}
    user_ids.discard(None)
    owners = await _user_lookup(db, user_ids)
    reply_schemas = [
        _reply_to_schema(r, owners.get(r.user_id) if r.user_id else None) for r in replies
    ]
    return DebateDetailResponse(
        data=_to_detail(d, owners.get(d.user_id) if d.user_id else None, reply_schemas)
    )


@router.post("", response_model=DebateDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_debate(
    body: DebateCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailResponse:
    now = datetime.now(UTC)
    d = Debate(
        id=uuid.uuid4(),
        user_id=user.id,
        question_id=body.question_id,
        source_circular_id=body.source_circular_id,
        title=body.title,
        opening_text=body.opening_text,
        status=DebateStatus.OPEN,
        created_at=now,
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    logger.info("debate_created", debate_id=str(d.id), user_id=str(user.id))
    return DebateDetailResponse(data=_to_detail(d, user, []))


@router.post("/{debate_id}/reply", response_model=DebateDetailResponse)
async def reply_to_debate(
    debate_id: uuid.UUID,
    body: DebateReplyRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailResponse:
    d = await db.get(Debate, debate_id)
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Debate not found",
                "code": "DEBATE_NOT_FOUND",
            },
        )
    if d.status == DebateStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "error": "Debate has been resolved",
                "code": "DEBATE_RESOLVED",
            },
        )

    reply = DebateReply(
        id=uuid.uuid4(),
        debate_id=debate_id,
        user_id=user.id,
        text=body.text,
        stance=DebateStance(body.stance.value),
        created_at=datetime.now(UTC),
    )
    db.add(reply)
    await db.commit()
    logger.info(
        "debate_reply_created",
        reply_id=str(reply.id),
        debate_id=str(debate_id),
        stance=body.stance.value,
    )

    # Re-read replies + owners for response. Refresh the in-session debate so
    # its lazy `replies` relationship reflects the new row.
    await db.refresh(d, attribute_names=["replies"])
    replies = list(d.replies)
    replies.sort(key=lambda r: r.created_at)
    user_ids = {d.user_id} | {r.user_id for r in replies if r.user_id}
    user_ids.discard(None)
    owners = await _user_lookup(db, user_ids)
    reply_schemas = [
        _reply_to_schema(r, owners.get(r.user_id) if r.user_id else None) for r in replies
    ]
    return DebateDetailResponse(
        data=_to_detail(d, owners.get(d.user_id) if d.user_id else None, reply_schemas)
    )


@router.patch("/{debate_id}/resolve", response_model=DebateDetailResponse)
async def resolve_debate(
    debate_id: uuid.UUID,
    body: DebateResolveRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailResponse:
    d = await db.get(Debate, debate_id)
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Debate not found",
                "code": "DEBATE_NOT_FOUND",
            },
        )
    if d.status == DebateStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "error": "Debate already resolved",
                "code": "DEBATE_RESOLVED",
            },
        )

    d.status = DebateStatus.RESOLVED
    d.resolution_text = body.resolution_text
    d.resolved_by = user.id
    d.resolved_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(d)

    rep_stmt = (
        select(DebateReply)
        .where(DebateReply.debate_id == debate_id)
        .order_by(DebateReply.created_at)
    )
    replies = (await db.execute(rep_stmt)).scalars().all()
    user_ids = {d.user_id, d.resolved_by} | {r.user_id for r in replies if r.user_id}
    user_ids.discard(None)
    owners = await _user_lookup(db, user_ids)
    reply_schemas = [
        _reply_to_schema(r, owners.get(r.user_id) if r.user_id else None) for r in replies
    ]
    return DebateDetailResponse(
        data=_to_detail(d, owners.get(d.user_id) if d.user_id else None, reply_schemas)
    )
