"""Admin dashboard — aggregate stats."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models.circular import CircularDocument
from app.models.question import Question
from app.models.user import User
from app.schemas.admin import DashboardResponse, DashboardStats

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    """Return aggregate stats for the admin dashboard."""
    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_30d = (
        await db.execute(select(func.count(User.id)).where(User.last_login_at >= thirty_days_ago))
    ).scalar() or 0
    total_questions = (await db.execute(select(func.count(Question.id)))).scalar() or 0
    questions_today = (
        await db.execute(
            select(func.count(Question.id)).where(
                Question.created_at >= now.replace(hour=0, minute=0, second=0)
            )
        )
    ).scalar() or 0
    total_circulars = (await db.execute(select(func.count(CircularDocument.id)))).scalar() or 0
    pending_reviews = (
        await db.execute(
            select(func.count(Question.id)).where(
                Question.feedback == -1, Question.reviewed.is_(False)
            )
        )
    ).scalar() or 0
    avg_feedback = (
        await db.execute(select(func.avg(Question.feedback)).where(Question.feedback.is_not(None)))
    ).scalar()
    credits_30d = (
        await db.execute(
            select(func.count(Question.id)).where(
                Question.credit_deducted.is_(True),
                Question.created_at >= thirty_days_ago,
            )
        )
    ).scalar() or 0

    return DashboardResponse(
        data=DashboardStats(
            total_users=total_users,
            active_users_30d=active_30d,
            total_questions=total_questions,
            questions_today=questions_today,
            total_circulars=total_circulars,
            pending_reviews=pending_reviews,
            avg_feedback_score=round(float(avg_feedback), 2) if avg_feedback else None,
            credits_consumed_30d=credits_30d,
        )
    )
