"""Debate + DebateReply models — threaded disagreements (v4 G-14, slice 9a)."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class DebateStatus(enum.StrEnum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class DebateStance(enum.StrEnum):
    AGREE = "AGREE"
    DISAGREE = "DISAGREE"
    NEUTRAL = "NEUTRAL"


class Debate(Base):
    __tablename__ = "debates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    question_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="SET NULL"), nullable=True
    )
    source_circular_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("circular_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    opening_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DebateStatus] = mapped_column(
        Enum(DebateStatus, name="debate_status_enum"),
        nullable=False,
        default=DebateStatus.OPEN,
    )
    resolution_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    replies: Mapped[list["DebateReply"]] = relationship(
        back_populates="debate", cascade="all, delete-orphan", lazy="selectin"
    )


class DebateReply(Base):
    __tablename__ = "debate_replies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("debates.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    stance: Mapped[DebateStance] = mapped_column(
        Enum(DebateStance, name="debate_stance_enum"),
        nullable=False,
        default=DebateStance.NEUTRAL,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    debate: Mapped[Debate] = relationship(back_populates="replies")
