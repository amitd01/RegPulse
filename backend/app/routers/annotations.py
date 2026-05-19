"""Annotations router (v4 module — stub).

Inline margin notes on AI brief passages. Contract published in S2; full
implementation lands in slice 10 (G-15).

Routes are nested under /questions/{id}/annotations for create+list, and
flat /annotations/{id} for update+delete (matches v4 FSD).
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import require_verified_user
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


def _not_implemented(feature: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "success": False,
            "error": f"{feature} lands in slice 10 (G-15 — Annotations backend)",
            "code": "NOT_IMPLEMENTED_ANNOTATIONS",
        },
    )


@question_scoped.get(
    "/{question_id}/annotations",
    response_model=AnnotationListResponse,
)
async def list_annotations(
    question_id: uuid.UUID,
    user: User = Depends(require_verified_user),
) -> AnnotationListResponse:
    """List team-scoped annotations on this question (empty until slice 10)."""
    return AnnotationListResponse()


@question_scoped.post(
    "/{question_id}/annotations",
    response_model=AnnotationDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation(
    question_id: uuid.UUID,
    body: AnnotationCreateRequest,
    user: User = Depends(require_verified_user),
) -> AnnotationDetailResponse:
    raise _not_implemented("Create annotation")


@flat.patch("/{annotation_id}", response_model=AnnotationDetailResponse)
async def update_annotation(
    annotation_id: uuid.UUID,
    body: AnnotationUpdateRequest,
    user: User = Depends(require_verified_user),
) -> AnnotationDetailResponse:
    raise _not_implemented("Update annotation")


@flat.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: uuid.UUID,
    user: User = Depends(require_verified_user),
):
    raise _not_implemented("Delete annotation")
