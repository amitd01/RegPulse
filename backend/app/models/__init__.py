"""SQLAlchemy ORM models for RegPulse."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic can discover them
from app.models.user import User, Session, PendingDomainReview  # noqa: E402, F401
from app.models.circular import CircularDocument, DocumentChunk  # noqa: E402, F401
from app.models.question import Question, ActionItem, SavedInterpretation  # noqa: E402, F401
from app.models.subscription import SubscriptionEvent  # noqa: E402, F401
from app.models.scraper import ScraperRun  # noqa: E402, F401
from app.models.admin import PromptVersion, AdminAuditLog, AnalyticsEvent  # noqa: E402, F401
