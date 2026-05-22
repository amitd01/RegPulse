"""Annotations router — highlighted text notes on AI answers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.dependencies.auth import require_verified_user
from app.models.collaboration import Annotation, AnnotationReply
from app.models.user import User
from app.schemas.collaboration import (
    AnnotationCreateRequest,
    AnnotationListResponse,
    AnnotationReplyCreateRequest,
    AnnotationReplyResponse,
    AnnotationResponse,
    AnnotationUpdateRequest,
    AuthorSummary,
)
from app.utils.org_utils import question_in_org, user_org_domain

router = APIRouter(tags=["annotations"])


def _serialize(annotation: Annotation) -> AnnotationResponse:
    data = AnnotationResponse.model_validate(annotation)
    if annotation.author:
        data.author = AuthorSummary.model_validate(annotation.author)
    raw_path = annotation.anchor_path
    if isinstance(raw_path, list):
        data.anchor_path = [str(p) for p in raw_path]
    elif raw_path is None:
        data.anchor_path = []
    data.replies = [
        AnnotationReplyResponse(
            id=r.id,
            user_id=r.user_id,
            content=r.content,
            created_at=r.created_at,
            author=AuthorSummary.model_validate(r.author) if r.author else None,
        )
        for r in annotation.replies
    ]
    return data

def _can_modify(annotation: Annotation, user: User) -> bool:
    return annotation.user_id == user.id or user.is_admin


@router.get("", response_model=AnnotationListResponse)
async def list_annotations(
    question_id: uuid.UUID = Query(...),
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationListResponse | dict:
    """Fetch all annotations for an AI answer (org-scoped)."""
    org = user_org_domain(user)
    if not await question_in_org(db, question_id, org):
        return {"success": False, "error": "Question not found in your organization", "code": "NOT_FOUND"}

    stmt = (
        select(Annotation)
        .options(
            selectinload(Annotation.author),
            selectinload(Annotation.replies).selectinload(AnnotationReply.author),
        )
        .where(Annotation.question_id == question_id, Annotation.org_domain == org)
        .order_by(Annotation.start_offset)
    )
    items = list((await db.execute(stmt)).scalars().unique().all())
    return AnnotationListResponse(data=[_serialize(a) for a in items])


@router.post("", response_model=AnnotationResponse, status_code=201)
async def create_annotation(
    body: AnnotationCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationResponse | dict:
    """Create an annotation on a specific text selection."""
    org = user_org_domain(user)
    if not await question_in_org(db, body.question_id, org):
        return {"success": False, "error": "Question not found in your organization", "code": "NOT_FOUND"}
    if body.end_offset <= body.start_offset:
        return {"success": False, "error": "Invalid text range", "code": "VALIDATION_ERROR"}

    annotation = Annotation(
        id=uuid.uuid4(),
        question_id=body.question_id,
        user_id=user.id,
        org_domain=org,
        selected_text=body.selected_text,
        note=body.note,
        start_offset=body.start_offset,
        end_offset=body.end_offset,
        anchor_path=body.anchor_path,
    )
    db.add(annotation)
    await db.commit()

    stmt = (
        select(Annotation)
        .options(
            selectinload(Annotation.author),
            selectinload(Annotation.replies).selectinload(AnnotationReply.author),
        )
        .where(Annotation.id == annotation.id)
    )
    annotation = (await db.execute(stmt)).scalar_one()
    return _serialize(annotation)


@router.patch("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: uuid.UUID,
    body: AnnotationUpdateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationResponse | dict:
    """Update or reposition an annotation (creator or admin only)."""
    org = user_org_domain(user)
    stmt = (
        select(Annotation)
        .options(
            selectinload(Annotation.author),
            selectinload(Annotation.replies).selectinload(AnnotationReply.author),
        )
        .where(Annotation.id == annotation_id, Annotation.org_domain == org)
    )
    annotation = (await db.execute(stmt)).scalar_one_or_none()
    if annotation is None:
        return {"success": False, "error": "Annotation not found", "code": "NOT_FOUND"}
    if not _can_modify(annotation, user):
        return {"success": False, "error": "Not authorized", "code": "FORBIDDEN"}

    updates = body.model_dump(exclude_unset=True)
    start = updates.get("start_offset", annotation.start_offset)
    end = updates.get("end_offset", annotation.end_offset)
    if end <= start:
        return {"success": False, "error": "Invalid text range", "code": "VALIDATION_ERROR"}

    for field, value in updates.items():
        setattr(annotation, field, value)
    annotation.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(annotation)
    return _serialize(annotation)


@router.delete("/{annotation_id}")
async def delete_annotation(
    annotation_id: uuid.UUID,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete an annotation (creator or admin only)."""
    org = user_org_domain(user)
    stmt = select(Annotation).where(Annotation.id == annotation_id, Annotation.org_domain == org)
    annotation = (await db.execute(stmt)).scalar_one_or_none()
    if annotation is None:
        return {"success": False, "error": "Annotation not found", "code": "NOT_FOUND"}
    if not _can_modify(annotation, user):
        return {"success": False, "error": "Not authorized", "code": "FORBIDDEN"}

    await db.delete(annotation)
    await db.commit()
    return {"success": True, "message": "Annotation deleted"}


@router.post("/{annotation_id}/replies", response_model=AnnotationReplyResponse, status_code=201)
async def post_annotation_reply(
    annotation_id: uuid.UUID,
    body: AnnotationReplyCreateRequest,
    user: User = Depends(require_verified_user),
    db: AsyncSession = Depends(get_db),
) -> AnnotationReplyResponse | dict:
    """Add a team discussion reply on an annotation."""
    org = user_org_domain(user)
    stmt = select(Annotation).where(Annotation.id == annotation_id, Annotation.org_domain == org)
    annotation = (await db.execute(stmt)).scalar_one_or_none()
    if annotation is None:
        return {"success": False, "error": "Annotation not found", "code": "NOT_FOUND"}

    reply = AnnotationReply(
        id=uuid.uuid4(),
        annotation_id=annotation_id,
        user_id=user.id,
        content=body.content,
    )
    db.add(reply)
    await db.commit()

    stmt = (
        select(AnnotationReply)
        .options(selectinload(AnnotationReply.author))
        .where(AnnotationReply.id == reply.id)
    )
    reply = (await db.execute(stmt)).scalar_one()
    data = AnnotationReplyResponse.model_validate(reply)
    if reply.author:
        data.author = AuthorSummary.model_validate(reply.author)
    return data
