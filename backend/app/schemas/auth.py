"""Auth request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# --- Requests ---


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    designation: str | None = Field(default=None, max_length=255)
    org_name: str | None = Field(default=None, max_length=255)
    org_type: str | None = Field(default=None, max_length=50)
    honeypot: str | None = Field(default=None, exclude=True, description="Bot trap field")


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# --- Responses ---


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    email_verified: bool
    full_name: str
    designation: str | None = None
    org_name: str | None = None
    org_type: str | None = None
    credit_balance: int
    plan: str
    plan_expires_at: datetime | None = None
    plan_auto_renew: bool
    is_admin: bool
    last_login_at: datetime | None = None
    last_seen_updates: datetime | None = None
    created_at: datetime


class AuthResponse(BaseModel):
    success: bool = True
    user: UserResponse
    tokens: TokenResponse


class MessageResponse(BaseModel):
    success: bool = True
    message: str
