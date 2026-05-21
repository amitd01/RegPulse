"""Team collaboration schemas — learnings, debates, annotations."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Shared ---


class AuthorSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str


# --- Team Learnings ---


class TeamLearningCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    note: str = Field(min_length=1, max_length=10000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class TeamLearningUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    note: str | None = Field(default=None, min_length=1, max_length=10000)
    tags: list[str] | None = Field(default=None, max_length=20)


class TeamLearningPinRequest(BaseModel):
    pinned: bool


class TeamLearningResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    note: str
    tags: list[str]
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    author: AuthorSummary | None = None


class TeamLearningListResponse(BaseModel):
    success: bool = True
    data: list[TeamLearningResponse]
    total: int
    page: int
    page_size: int


class TeamLearningStatsResponse(BaseModel):
    success: bool = True
    total: int
    pinned_count: int
    this_week: int
    this_month: int
    unique_contributors: int
    top_tags: list[dict[str, int | str]]
    activity_by_day: list[dict[str, int | str]]


# --- Debates ---


class DebateCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1, max_length=10000)


class DebateReplyCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    stance: str = Field(pattern=r"^(AGREE|DISAGREE)$")


class DebateResolveRequest(BaseModel):
    final_decision: str = Field(min_length=1, max_length=10000)


class DebateReplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    content: str
    stance: str
    created_at: datetime
    author: AuthorSummary | None = None


class DebateSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str
    status: str
    final_decision: str | None = None
    resolved_by: uuid.UUID | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    reply_count: int = 0
    agree_count: int = 0
    disagree_count: int = 0
    creator: AuthorSummary | None = None


class DebateDetailResponse(DebateSummaryResponse):
    replies: list[DebateReplyResponse] = Field(default_factory=list)


class DebateListResponse(BaseModel):
    success: bool = True
    data: list[DebateSummaryResponse]
    total: int
    page: int
    page_size: int


class DebateDetailWrapper(BaseModel):
    success: bool = True
    data: DebateDetailResponse


# --- Annotations ---


class AnnotationCreateRequest(BaseModel):
    question_id: uuid.UUID
    selected_text: str = Field(min_length=1, max_length=5000)
    note: str | None = Field(default=None, max_length=5000)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    anchor_path: list[str] = Field(default_factory=list)


class AnnotationUpdateRequest(BaseModel):
    note: str | None = Field(default=None, max_length=5000)
    selected_text: str | None = Field(default=None, min_length=1, max_length=5000)
    start_offset: int | None = Field(default=None, ge=0)
    end_offset: int | None = Field(default=None, gt=0)
    anchor_path: list[str] | None = None


class AnnotationReplyCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class AnnotationReplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime
    author: AuthorSummary | None = None


class AnnotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    user_id: uuid.UUID
    selected_text: str
    note: str | None = None
    start_offset: int
    end_offset: int
    anchor_path: list[str]
    created_at: datetime
    updated_at: datetime
    author: AuthorSummary | None = None
    replies: list[AnnotationReplyResponse] = Field(default_factory=list)


class AnnotationListResponse(BaseModel):
    success: bool = True
    data: list[AnnotationResponse]
