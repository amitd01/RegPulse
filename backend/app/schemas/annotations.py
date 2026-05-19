"""Pydantic schemas for Annotations module (v4 — stub).

Inline margin notes on specific passages within AI briefs, team-scoped.
Contract drives `<mark class="annot">` spans + AnnotPopover in the Ask page.
Backend implementation lands in slice 10.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnnotationCreateRequest(BaseModel):
    text_selection: str = Field(..., min_length=2, max_length=2000)
    note: str = Field(..., min_length=1, max_length=4000)
    anchor_offset: int | None = Field(
        default=None, ge=0, description="Character offset in answer_text for stable anchoring"
    )


class AnnotationUpdateRequest(BaseModel):
    note: str | None = Field(default=None, min_length=1, max_length=4000)
    resolved: bool | None = None


class Annotation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    user_id: uuid.UUID
    user_initials: str
    text_selection: str
    note: str
    anchor_offset: int | None = None
    resolved: bool = False
    created_at: datetime


class AnnotationListResponse(BaseModel):
    success: bool = True
    data: list[Annotation] = Field(default_factory=list)
    total: int = 0


class AnnotationDetailResponse(BaseModel):
    success: bool = True
    data: Annotation
