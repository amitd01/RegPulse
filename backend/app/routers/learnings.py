"""Team Learnings router (v4 module — stub).

Contract published in S2; full implementation lands in slice 9 (G-13).
GETs return shape-correct empties so the frontend can render without 4xx.
Writes return 501 NOT_IMPLEMENTED with the standard error envelope.
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies.auth import require_verified_user
from app.models.user import User
from app.schemas.learnings import (
    LearningCreateRequest,
    LearningDetailResponse,
    LearningListResponse,
    LearningStats,
    LearningStatsResponse,
    LearningUpdateRequest,
)

router = APIRouter(tags=["learnings"])
logger = structlog.get_logger("regpulse.learnings")


def _not_implemented(feature: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "success": False,
            "error": f"{feature} lands in slice 9 (G-13 — Team Learnings backend)",
            "code": "NOT_IMPLEMENTED_LEARNINGS",
        },
    )


@router.get("/stats", response_model=LearningStatsResponse)
async def learnings_stats(
    user: User = Depends(require_verified_user),
) -> LearningStatsResponse:
    """Header MiniStats — TOTAL / THIS WEEK / CONTRIBUTORS."""
    return LearningStatsResponse(data=LearningStats())


@router.get("", response_model=LearningListResponse)
async def list_learnings(
    pinned: bool | None = Query(default=None, description="Filter pinned learnings only"),
    tag: str | None = Query(default=None, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_verified_user),
) -> LearningListResponse:
    """List team learnings (currently always empty until slice 9)."""
    return LearningListResponse()


@router.get("/{learning_id}", response_model=LearningDetailResponse)
async def get_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
) -> LearningDetailResponse:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "success": False,
            "error": "Learning not found",
            "code": "LEARNING_NOT_FOUND",
        },
    )


@router.post("", response_model=LearningDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_learning(
    body: LearningCreateRequest,
    user: User = Depends(require_verified_user),
) -> LearningDetailResponse:
    raise _not_implemented("Save-as-learning")


@router.patch("/{learning_id}", response_model=LearningDetailResponse)
async def update_learning(
    learning_id: uuid.UUID,
    body: LearningUpdateRequest,
    user: User = Depends(require_verified_user),
) -> LearningDetailResponse:
    raise _not_implemented("Update learning")


@router.post("/{learning_id}/pin", response_model=LearningDetailResponse)
async def pin_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
) -> LearningDetailResponse:
    raise _not_implemented("Pin/unpin learning")


@router.delete("/{learning_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_learning(
    learning_id: uuid.UUID,
    user: User = Depends(require_verified_user),
):
    raise _not_implemented("Delete learning")
