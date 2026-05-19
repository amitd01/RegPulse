"""Pydantic schemas for Team Learnings (v4 module — stub).

The frontend `/learnings` page renders against this contract. Backend
implementation lands in slice 9; current router returns shape-correct empties
on reads and 501 NOT_IMPLEMENTED on writes.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LearningCreateRequest(BaseModel):
    """Save-as-learning payload from the Ask page or Learnings UI."""

    question_id: uuid.UUID | None = Field(
        default=None, description="Source question (optional for free-form learnings)"
    )
    source_circular_id: uuid.UUID | None = None
    title: str = Field(..., min_length=4, max_length=240, description="One-line takeaway")
    note: str | None = Field(default=None, max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=10)
    notify_team: bool = False


class LearningUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=4, max_length=240)
    note: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=10)
    pinned: bool | None = None


class LearningItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_initials: str
    question_id: uuid.UUID | None = None
    source_circular_id: uuid.UUID | None = None
    title: str
    note: str | None = None
    tags: list[str] = Field(default_factory=list)
    pinned: bool = False
    created_at: datetime


class LearningListResponse(BaseModel):
    success: bool = True
    data: list[LearningItem] = Field(default_factory=list)
    total: int = 0


class LearningDetailResponse(BaseModel):
    success: bool = True
    data: LearningItem


class LearningStats(BaseModel):
    total: int = 0
    this_week: int = 0
    contributors: int = 0


class LearningStatsResponse(BaseModel):
    success: bool = True
    data: LearningStats
