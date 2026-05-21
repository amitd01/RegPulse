"""Organization helpers — work-email domain is the org boundary."""

from __future__ import annotations

from app.models.user import User


def get_org_domain(email: str) -> str:
    """Return the lowercase email domain used as the org identifier."""
    return email.rsplit("@", 1)[-1].lower()


def user_org_domain(user: User) -> str:
    """Return the org domain for a user."""
    return get_org_domain(user.email)
