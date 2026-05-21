"""Team learnings router — org-shared knowledge notes."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models.collaboration import TeamLearning
from app.models.question import Question
from app.models.user import User
from app.schemas.collaboration import (
    AuthorSummary,
    TeamLearningCreateRequest,
    TeamLearningListResponse,
    TeamLearningPinRequest,
    TeamLearningResponse,
    TeamLearningStatsResponse,
    TeamLearningUpdateRequest,
)
from app.utils.org_utils import user_org_domain

router = APIRouter(tags=["learnings"])


def _serialize(learning: TeamLearning) -> TeamLearningResponse:
    data = TeamLearningResponse.model_validate(learning)
    if learning.author:
        data.author = AuthorSummary.model_validate(learning.author)
    raw_tags = learning.tags
    if isinstance(raw_tags, list):
        data.tags = [str(t) for t in raw_tags]
    elif raw_tags is None:
        data.tags = []
    return data


def _can_modify(learning: TeamLearning, user: User) -> bool:
    return learning.user_id == user.id or user.is_admin


async def _question_in_org(db: AsyncSession, question_id: uuid.UUID, org: str) -> bool:
    stmt = (
        select(Question.id)
        .join(User, Question.user_id == User.id)
        .where(Question.id == question_id, User.email.ilike(f"%@{org}"))
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None


@router.get("/stats", response_model=TeamLearningStatsResponse)
async def learning_stats(
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> TeamLearningStatsResponse:
    """Aggregate learning activity for the user's organization."""
    org = user_org_domain(user)
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    total = int(
        (
            await db.execute(
                select(func.count(TeamLearning.id)).where(TeamLearning.org_domain == org)
            )
        ).scalar()
        or 0
    )

    pinned_count = int(
        (
            await db.execute(
                select(func.count(TeamLearning.id)).where(
                    TeamLearning.org_domain == org, TeamLearning.is_pinned.is_(True)
                )
            )
        ).scalar()
        or 0
    )
    this_week = int(
        (
            await db.execute(
                select(func.count(TeamLearning.id)).where(
                    TeamLearning.org_domain == org, TeamLearning.created_at >= week_start
                )
            )
        ).scalar()
        or 0
    )
    this_month = int(
        (
            await db.execute(
                select(func.count(TeamLearning.id)).where(
                    TeamLearning.org_domain == org, TeamLearning.created_at >= month_start
                )
            )
        ).scalar()
        or 0
    )
    unique_contributors = int(
        (
            await db.execute(
                select(func.count(func.distinct(TeamLearning.user_id))).where(
                    TeamLearning.org_domain == org
                )
            )
        ).scalar()
        or 0
    )

    # Top tags — fetch all tag arrays and count in Python (portable across SQLite/PG).
    tag_rows = (
        await db.execute(select(TeamLearning.tags).where(TeamLearning.org_domain == org))
    ).all()
    tag_counts: dict[str, int] = {}
    for (tags,) in tag_rows:
        if isinstance(tags, list):
            for tag in tags:
                key = str(tag)
                tag_counts[key] = tag_counts.get(key, 0) + 1
    top_tags = [
        {"tag": tag, "count": count}
        for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # Activity by day (last 14 days)
    activity_start = date.today() - timedelta(days=13)
    day_rows = (
        await db.execute(
            select(TeamLearning.created_at).where(
                TeamLearning.org_domain == org,
                TeamLearning.created_at >= datetime.combine(activity_start, datetime.min.time(), tzinfo=UTC),
            )
        )
    ).all()
    day_counts: dict[str, int] = {}
    for offset in range(14):
        d = activity_start + timedelta(days=offset)
        day_counts[d.isoformat()] = 0
    for (created_at,) in day_rows:
        if created_at:
            key = created_at.date().isoformat()
            if key in day_counts:
                day_counts[key] += 1
    activity_by_day = [{"date": k, "count": v} for k, v in sorted(day_counts.items())]

    return TeamLearningStatsResponse(
        total=total,
        pinned_count=pinned_count,
        this_week=this_week,
        this_month=this_month,
        unique_contributors=unique_contributors,
        top_tags=top_tags,
        activity_by_day=activity_by_day,
    )


@router.get("", response_model=TeamLearningListResponse)
async def list_learnings(
    tag: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> TeamLearningListResponse:
    """List org learnings with optional tag and date filters. Pinned items first."""
    org = user_org_domain(user)
    base = select(TeamLearning).where(TeamLearning.org_domain == org)
    count_base = select(func.count(TeamLearning.id)).where(TeamLearning.org_domain == org)

    if date_from:
        base = base.where(TeamLearning.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC))
        count_base = count_base.where(
            TeamLearning.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC)
        )
    if date_to:
        end = datetime.combine(date_to, datetime.max.time(), tzinfo=UTC)
        base = base.where(TeamLearning.created_at <= end)
        count_base = count_base.where(TeamLearning.created_at <= end)

    total = (await db.execute(count_base)).scalar() or 0

    if tag:
        # Tag filter applied in Python for SQLite/PostgreSQL portability.
        all_stmt = (
            base.options(selectinload(TeamLearning.author))
            .order_by(desc(TeamLearning.is_pinned), desc(TeamLearning.created_at))
        )
        all_items = list((await db.execute(all_stmt)).scalars().all())
        tag_lower = tag.lower()
        filtered = [
            i
            for i in all_items
            if isinstance(i.tags, list) and any(str(t).lower() == tag_lower for t in i.tags)
        ]
        total = len(filtered)
        start = (page - 1) * page_size
        items = filtered[start : start + page_size]
    else:
        stmt = (
            base.options(selectinload(TeamLearning.author))
            .order_by(desc(TeamLearning.is_pinned), desc(TeamLearning.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list((await db.execute(stmt)).scalars().all())

    return TeamLearningListResponse(
        data=[_serialize(i) for i in items],
        total=int(total),
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=TeamLearningResponse, status_code=201)
async def create_learning(
    body: TeamLearningCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> TeamLearningResponse | dict:
    """Create a new team learning visible to the user's organization."""
    org = user_org_domain(user)
    if body.source_question_id is not None:
        if not await _question_in_org(db, body.source_question_id, org):
            return {"success": False, "error": "Question not found in your organization", "code": "NOT_FOUND"}  # type: ignore[return-value]

    learning = TeamLearning(
        id=uuid.uuid4(),
        user_id=user.id,
        org_domain=org,
        source_question_id=body.source_question_id,
        title=body.title,
        note=body.note,
        tags=body.tags,
    )
    db.add(learning)
    await db.commit()
    await db.refresh(learning, attribute_names=["author"])
    stmt = (
        select(TeamLearning)
        .options(selectinload(TeamLearning.author))
        .where(TeamLearning.id == learning.id)
    )
    learning = (await db.execute(stmt)).scalar_one()
    return _serialize(learning)


@router.patch("/{learning_id}", response_model=TeamLearningResponse)
async def update_learning(
    learning_id: uuid.UUID,
    body: TeamLearningUpdateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> TeamLearningResponse | dict:
    """Update a learning (creator or admin only)."""
    stmt = (
        select(TeamLearning)
        .options(selectinload(TeamLearning.author))
        .where(TeamLearning.id == learning_id, TeamLearning.org_domain == user_org_domain(user))
    )
    learning = (await db.execute(stmt)).scalar_one_or_none()
    if learning is None:
        return {"success": False, "error": "Learning not found", "code": "NOT_FOUND"}
    if not _can_modify(learning, user):
        return {"success": False, "error": "Not authorized", "code": "FORBIDDEN"}

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(learning, field, value)
    learning.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(learning)
    return _serialize(learning)


@router.delete("/{learning_id}")
async def delete_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a learning (creator or admin only)."""
    stmt = select(TeamLearning).where(
        TeamLearning.id == learning_id, TeamLearning.org_domain == user_org_domain(user)
    )
    learning = (await db.execute(stmt)).scalar_one_or_none()
    if learning is None:
        return {"success": False, "error": "Learning not found", "code": "NOT_FOUND"}
    if not _can_modify(learning, user):
        return {"success": False, "error": "Not authorized", "code": "FORBIDDEN"}

    await db.delete(learning)
    await db.commit()
    return {"success": True, "message": "Learning deleted"}


@router.post("/{learning_id}/pin", response_model=TeamLearningResponse)
async def pin_learning(
    learning_id: uuid.UUID,
    body: TeamLearningPinRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> TeamLearningResponse | dict:
    """Pin or unpin a learning to the top (creator or admin only)."""
    stmt = (
        select(TeamLearning)
        .options(selectinload(TeamLearning.author))
        .where(TeamLearning.id == learning_id, TeamLearning.org_domain == user_org_domain(user))
    )
    learning = (await db.execute(stmt)).scalar_one_or_none()
    if learning is None:
        return {"success": False, "error": "Learning not found", "code": "NOT_FOUND"}
    if not _can_modify(learning, user):
        return {"success": False, "error": "Not authorized", "code": "FORBIDDEN"}

    learning.is_pinned = body.pinned
    learning.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(learning)
    return _serialize(learning)
