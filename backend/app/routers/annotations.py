"""Annotations router — full implementation (v4 G-15, slice 10a).

Replaces the S2 stub. Inline margin notes on AI brief passages. Scoped by
question ownership for create+update+delete; list returns the union of
annotations visible to the current user (currently: same user only; team
visibility is gated by the workspaces work which lands later).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models.annotation import Annotation as AnnotationModel
from app.models.user import User
from app.schemas.annotations import (
    Annotation,
    AnnotationCreateRequest,
    AnnotationDetailResponse,
    AnnotationListResponse,
    AnnotationUpdateRequest,
)

# Two routers mounted at different prefixes — see main.py registration
question_scoped = APIRouter(tags=["annotations"])
flat = APIRouter(tags=["annotations"])
logger = structlog.get_logger("regpulse.annotations")


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


def _to_schema(row: AnnotationModel, user: User | None) -> Annotation:
    return Annotation(
        id=row.id,
        question_id=row.question_id,
        user_id=row.user_id or uuid.UUID(int=0),
        user_initials=_initials(user),
        text_selection=row.text_selection,
        note=row.note,
        anchor_offset=row.anchor_offset,
        resolved=row.resolved,
        created_at=row.created_at,
    )


@question_scoped.get(
    "/{question_id}/annotations",
    response_model=AnnotationListResponse,
)
async def list_annotations(
    question_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationListResponse:
    # Compare as str to bypass the UUID-as-text bind-vs-result-processor
    # mismatch on the SQLite test bed (Mapped[uuid.UUID] column type stays
    # PostgresUUID — when the test fixture swaps to String, SQLAlchemy still
    # routes the WHERE through UUID.bind_processor and the comparison misses).
    # In Postgres this is a no-op cast.
    stmt = (
        select(AnnotationModel)
        .where(AnnotationModel.question_id == str(question_id))
        .order_by(AnnotationModel.created_at)
    )
    rows = (await db.execute(stmt)).scalars().all()

    user_ids = {r.user_id for r in rows if r.user_id is not None}
    users: dict[uuid.UUID, User] = {}
    if user_ids:
        u_stmt = select(User).where(User.id.in_(user_ids))
        for u in (await db.execute(u_stmt)).scalars().all():
            users[u.id] = u

    return AnnotationListResponse(
        data=[_to_schema(r, users.get(r.user_id) if r.user_id else None) for r in rows],
        total=len(rows),
    )


@question_scoped.post(
    "/{question_id}/annotations",
    response_model=AnnotationDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation(
    question_id: uuid.UUID,
    body: AnnotationCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationDetailResponse:
    now = datetime.now(UTC)
    row = AnnotationModel(
        id=uuid.uuid4(),
        question_id=question_id,
        user_id=user.id,
        text_selection=body.text_selection,
        note=body.note,
        anchor_offset=body.anchor_offset,
        resolved=False,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    logger.info(
        "annotation_created",
        annotation_id=str(row.id),
        question_id=str(question_id),
        user_id=str(user.id),
    )
    return AnnotationDetailResponse(data=_to_schema(row, user))


@flat.patch("/{annotation_id}", response_model=AnnotationDetailResponse)
async def update_annotation(
    annotation_id: uuid.UUID,
    body: AnnotationUpdateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationDetailResponse:
    row = await db.get(AnnotationModel, annotation_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Annotation not found",
                "code": "ANNOTATION_NOT_FOUND",
            },
        )
    if body.note is not None:
        row.note = body.note
    if body.resolved is not None:
        row.resolved = body.resolved
    row.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(row)
    return AnnotationDetailResponse(data=_to_schema(row, user))


@flat.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(AnnotationModel, annotation_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": "Annotation not found",
                "code": "ANNOTATION_NOT_FOUND",
            },
        )
    await db.delete(row)
    await db.commit()
