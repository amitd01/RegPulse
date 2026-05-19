"""Debates router (v4 module — stub).

Contract published in S2; full implementation lands in slice 9 (G-14).
GETs return shape-correct empties; writes return 501 NOT_IMPLEMENTED.
"""

from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies.auth import require_verified_user
from app.models.user import User
from app.schemas.debates import (
    DebateCreateRequest,
    DebateDetailResponse,
    DebateListResponse,
    DebateReplyRequest,
    DebateResolveRequest,
    DebateStatus,
)

router = APIRouter(tags=["debates"])
logger = structlog.get_logger("regpulse.debates")


def _not_implemented(feature: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "success": False,
            "error": f"{feature} lands in slice 9 (G-14 — Debates backend)",
            "code": "NOT_IMPLEMENTED_DEBATES",
        },
    )


@router.get("", response_model=DebateListResponse)
async def list_debates(
    status_filter: DebateStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_verified_user),
) -> DebateListResponse:
    """List debates (currently always empty until slice 9)."""
    return DebateListResponse()


@router.get("/{debate_id}", response_model=DebateDetailResponse)
async def get_debate(
    debate_id: uuid.UUID,
    user: User = Depends(require_verified_user),
) -> DebateDetailResponse:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "success": False,
            "error": "Debate not found",
            "code": "DEBATE_NOT_FOUND",
        },
    )


@router.post("", response_model=DebateDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_debate(
    body: DebateCreateRequest,
    user: User = Depends(require_verified_user),
) -> DebateDetailResponse:
    raise _not_implemented("Open debate")


@router.post("/{debate_id}/reply", response_model=DebateDetailResponse)
async def reply_to_debate(
    debate_id: uuid.UUID,
    body: DebateReplyRequest,
    user: User = Depends(require_verified_user),
) -> DebateDetailResponse:
    raise _not_implemented("Reply to debate")


@router.patch("/{debate_id}/resolve", response_model=DebateDetailResponse)
async def resolve_debate(
    debate_id: uuid.UUID,
    body: DebateResolveRequest,
    user: User = Depends(require_verified_user),
) -> DebateDetailResponse:
    raise _not_implemented("Resolve debate")
