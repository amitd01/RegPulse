"""Debates router — org-wide regulatory interpretation discussions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models.collaboration import Debate, DebateReply, DebateStatus, DebateStance
from app.models.user import User
from app.schemas.collaboration import (
    AuthorSummary,
    DebateCreateRequest,
    DebateDetailResponse,
    DebateDetailWrapper,
    DebateListResponse,
    DebateReplyCreateRequest,
    DebateReplyResponse,
    DebateResolveRequest,
    DebateSummaryResponse,
)
from app.utils.org_utils import user_org_domain

router = APIRouter(tags=["debates"])


def _reply_response(reply: DebateReply) -> DebateReplyResponse:
    data = DebateReplyResponse.model_validate(reply)
    if reply.author:
        data.author = AuthorSummary.model_validate(reply.author)
    data.stance = str(reply.stance)
    return data


def _summary(debate: Debate, replies: list[DebateReply] | None = None) -> DebateSummaryResponse:
    reply_list = replies if replies is not None else debate.replies
    agree = sum(1 for r in reply_list if str(r.stance) == DebateStance.AGREE)
    disagree = sum(1 for r in reply_list if str(r.stance) == DebateStance.DISAGREE)
    data = DebateSummaryResponse.model_validate(debate)
    data.status = str(debate.status)
    data.reply_count = len(reply_list)
    data.agree_count = agree
    data.disagree_count = disagree
    if debate.creator:
        data.creator = AuthorSummary.model_validate(debate.creator)
    return data


@router.get("", response_model=DebateListResponse)
async def list_debates(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateListResponse:
    """List all debates in the user's organization."""
    org = user_org_domain(user)
    base = select(Debate).where(Debate.org_domain == org)
    count_base = select(func.count(Debate.id)).where(Debate.org_domain == org)

    if status:
        base = base.where(Debate.status == status)
        count_base = count_base.where(Debate.status == status)

    total = (await db.execute(count_base)).scalar() or 0
    stmt = (
        base.options(selectinload(Debate.creator), selectinload(Debate.replies))
        .order_by(desc(Debate.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    debates = list((await db.execute(stmt)).scalars().unique().all())

    return DebateListResponse(
        data=[_summary(d) for d in debates],
        total=int(total),
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=DebateDetailWrapper, status_code=201)
async def create_debate(
    body: DebateCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailWrapper:
    """Create a new debate thread."""
    debate = Debate(
        id=uuid.uuid4(),
        user_id=user.id,
        org_domain=user_org_domain(user),
        title=body.title,
        description=body.description,
    )
    db.add(debate)
    await db.commit()

    stmt = (
        select(Debate)
        .options(selectinload(Debate.creator), selectinload(Debate.replies).selectinload(DebateReply.author))
        .where(Debate.id == debate.id)
    )
    debate = (await db.execute(stmt)).scalar_one()
    detail = DebateDetailResponse(**_summary(debate).model_dump(), replies=[])
    return DebateDetailWrapper(data=detail)


@router.get("/{debate_id}", response_model=DebateDetailWrapper)
async def get_debate(
    debate_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailWrapper | dict:
    """View a single debate with all replies."""
    stmt = (
        select(Debate)
        .options(
            selectinload(Debate.creator),
            selectinload(Debate.replies).selectinload(DebateReply.author),
        )
        .where(Debate.id == debate_id, Debate.org_domain == user_org_domain(user))
    )
    debate = (await db.execute(stmt)).scalar_one_or_none()
    if debate is None:
        return {"success": False, "error": "Debate not found", "code": "NOT_FOUND"}

    detail = DebateDetailResponse(
        **_summary(debate).model_dump(),
        replies=[_reply_response(r) for r in debate.replies],
    )
    return DebateDetailWrapper(data=detail)


@router.post("/{debate_id}/replies", response_model=DebateReplyResponse, status_code=201)
async def post_reply(
    debate_id: uuid.UUID,
    body: DebateReplyCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateReplyResponse | dict:
    """Post a reply with agree/disagree stance. Blocked once debate is resolved."""
    stmt = select(Debate).where(Debate.id == debate_id, Debate.org_domain == user_org_domain(user))
    debate = (await db.execute(stmt)).scalar_one_or_none()
    if debate is None:
        return {"success": False, "error": "Debate not found", "code": "NOT_FOUND"}
    if str(debate.status) == DebateStatus.RESOLVED:
        return {"success": False, "error": "Debate is resolved and locked", "code": "DEBATE_LOCKED"}

    reply = DebateReply(
        id=uuid.uuid4(),
        debate_id=debate_id,
        user_id=user.id,
        content=body.content,
        stance=DebateStance(body.stance),
    )
    db.add(reply)
    await db.commit()

    stmt = select(DebateReply).options(selectinload(DebateReply.author)).where(DebateReply.id == reply.id)
    reply = (await db.execute(stmt)).scalar_one()
    return _reply_response(reply)


@router.post("/{debate_id}/resolve", response_model=DebateDetailWrapper)
async def resolve_debate(
    debate_id: uuid.UUID,
    body: DebateResolveRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> DebateDetailWrapper | dict:
    """Officially resolve a debate. Only creator or admin can resolve."""
    stmt = (
        select(Debate)
        .options(
            selectinload(Debate.creator),
            selectinload(Debate.replies).selectinload(DebateReply.author),
        )
        .where(Debate.id == debate_id, Debate.org_domain == user_org_domain(user))
    )
    debate = (await db.execute(stmt)).scalar_one_or_none()
    if debate is None:
        return {"success": False, "error": "Debate not found", "code": "NOT_FOUND"}
    if str(debate.status) == DebateStatus.RESOLVED:
        return {"success": False, "error": "Debate already resolved", "code": "ALREADY_RESOLVED"}
    if debate.user_id != user.id and not user.is_admin:
        return {"success": False, "error": "Only the creator or admin can resolve", "code": "FORBIDDEN"}

    debate.status = DebateStatus.RESOLVED
    debate.final_decision = body.final_decision
    debate.resolved_by = user.id
    debate.resolved_at = datetime.now(UTC)
    debate.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(debate)

    detail = DebateDetailResponse(
        **_summary(debate).model_dump(),
        replies=[_reply_response(r) for r in debate.replies],
    )
    return DebateDetailWrapper(data=detail)
