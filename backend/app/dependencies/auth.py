"""Authentication dependencies for FastAPI route protection.

Provides Depends()-compatible callables for JWT-based auth:
- get_current_user: extracts user from Bearer token
- require_active_user: ensures user.is_active
- require_verified_user: ensures user.email_verified
- require_admin: ensures user.is_admin
- require_credits: ensures user.credit_balance > 0
"""

from __future__ import annotations

from datetime import UTC

import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User

logger = structlog.get_logger("regpulse.auth")

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> User:
    """Extract and validate JWT from Authorization header, return User."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": "Not authenticated", "code": "NOT_AUTHENTICATED"},
        )

    token = credentials.credentials

    # Decode JWT — import here to avoid circular imports
    try:
        from app.utils.jwt_utils import decode_access_token

        payload = decode_access_token(token)
    except ImportError:
        # jwt_utils not yet implemented — fall through to decode inline
        import jwt

        from app.config import get_settings

        settings = get_settings()
        try:
            payload = jwt.decode(
                token,
                settings.JWT_PUBLIC_KEY,
                algorithms=["RS256"],
                options={"require": ["sub", "exp", "iat", "jti"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "success": False,
                    "error": "Token expired",
                    "code": "TOKEN_EXPIRED",
                },
            ) from exc
        except jwt.InvalidTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "success": False,
                    "error": "Invalid token",
                    "code": "INVALID_TOKEN",
                },
            ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": "Invalid token", "code": "INVALID_TOKEN"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": "User not found", "code": "USER_NOT_FOUND"},
        )

    # Check password_changed_at vs token iat (injection guard)
    if hasattr(user, "password_changed_at") and user.password_changed_at is not None:
        from datetime import datetime

        token_iat = datetime.fromtimestamp(payload["iat"], tz=UTC)
        if token_iat < user.password_changed_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "success": False,
                    "error": "Token invalidated by password change",
                    "code": "TOKEN_INVALIDATED",
                },
            )

    return user


async def require_active_user(
    user: User = Depends(get_current_user),  # noqa: B008
) -> User:
    """Ensure user account is active."""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": "Account is deactivated",
                "code": "ACCOUNT_DEACTIVATED",
            },
        )
    return user


async def require_verified_user(
    user: User = Depends(require_active_user),  # noqa: B008
) -> User:
    """Ensure user email is verified."""
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": "Email not verified",
                "code": "EMAIL_NOT_VERIFIED",
            },
        )
    return user


async def require_admin(
    user: User = Depends(require_verified_user),  # noqa: B008
) -> User:
    """Ensure user is an admin."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": "Admin access required",
                "code": "ADMIN_REQUIRED",
            },
        )
    return user


async def require_credits(
    user: User = Depends(require_verified_user),  # noqa: B008
) -> User:
    """Ensure user has at least 1 credit."""
    if user.credit_balance <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "success": False,
                "error": "Insufficient credits",
                "code": "INSUFFICIENT_CREDITS",
            },
        )
    return user


def get_optional_user(
    request: Request,
) -> None:
    """Placeholder for optional authentication — returns None (unauthenticated)."""
    return None
