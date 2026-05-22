"""Organization helpers — work-email domain is the org boundary."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.user import User


def get_org_domain(email: str) -> str:
    """Return the lowercase email domain used as the org identifier."""
    return email.rsplit("@", 1)[-1].lower()


def user_org_domain(user: User) -> str:
    """Return the org domain for a user."""
    return get_org_domain(user.email)


async def question_in_org(db: AsyncSession, question_id: uuid.UUID, org: str) -> bool:
    """True if the question owner shares the given org domain."""
    stmt = (
        select(Question.id)
        .join(User, Question.user_id == User.id)
        .where(Question.id == question_id, User.email.ilike(f"%@{org}"))
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None
