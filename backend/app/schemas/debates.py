"""Pydantic schemas for Debates module (v4 — stub).

Threaded team disagreements with agree/disagree voting and resolution.
Contract drives `/debate` page + Ask-page right-rail debate panel.
Backend implementation lands in slice 9.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DebateStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class DebateStance(str, enum.Enum):
    AGREE = "AGREE"
    DISAGREE = "DISAGREE"
    NEUTRAL = "NEUTRAL"


class DebateCreateRequest(BaseModel):
    question_id: uuid.UUID | None = None
    source_circular_id: uuid.UUID | None = None
    title: str = Field(..., min_length=8, max_length=240)
    opening_text: str = Field(..., min_length=4, max_length=4000)
    initial_stance: DebateStance = DebateStance.NEUTRAL


class DebateReplyRequest(BaseModel):
    text: str = Field(..., min_length=2, max_length=4000)
    stance: DebateStance = DebateStance.NEUTRAL


class DebateResolveRequest(BaseModel):
    resolution_text: str = Field(..., min_length=4, max_length=4000)


class DebateReply(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debate_id: uuid.UUID
    user_id: uuid.UUID
    user_initials: str
    text: str
    stance: DebateStance
    created_at: datetime


class DebateItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_initials: str
    question_id: uuid.UUID | None = None
    source_circular_id: uuid.UUID | None = None
    title: str
    status: DebateStatus
    agree_count: int = 0
    disagree_count: int = 0
    reply_count: int = 0
    resolution_text: str | None = None
    resolved_by: uuid.UUID | None = None
    resolved_at: datetime | None = None
    created_at: datetime


class DebateDetail(DebateItem):
    replies: list[DebateReply] = Field(default_factory=list)


class DebateListResponse(BaseModel):
    success: bool = True
    data: list[DebateItem] = Field(default_factory=list)
    total: int = 0
    open_count: int = 0


class DebateDetailResponse(BaseModel):
    success: bool = True
    data: DebateDetail
