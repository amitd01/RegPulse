"""Pydantic BaseSettings configuration — singleton via @lru_cache."""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # --- Database ---
    DATABASE_URL: str
    REDIS_URL: str

    # --- JWT (RS256) ---
    JWT_PRIVATE_KEY: str
    JWT_PUBLIC_KEY: str
    JWT_BLACKLIST_TTL: int = 3600

    # --- LLM ---
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str
    LLM_MODEL: str = "claude-sonnet-4-20250514"
    LLM_FALLBACK_MODEL: str = "gpt-4o"
    LLM_SUMMARY_MODEL: str = "claude-haiku-4-5-20251001"

    # --- Embeddings ---
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIMS: int = 3072

    # --- RAG tuning ---
    RAG_COSINE_THRESHOLD: float = 0.4
    RAG_TOP_K_INITIAL: int = 12
    RAG_TOP_K_FINAL: int = 6
    RAG_MAX_CHUNKS_PER_DOC: int = 2

    # --- Payments ---
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    RAZORPAY_WEBHOOK_SECRET: str

    # --- SMTP ---
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASS: str
    SMTP_FROM: str

    # --- Admin ---
    ADMIN_EMAIL_ALLOWLIST: list[str] = []

    # --- OTP ---
    OTP_EXPIRY_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_MAX_SENDS_PER_HOUR: int = 3

    # --- Application ---
    FREE_CREDIT_GRANT: int = 5
    MAX_QUESTION_CHARS: int = 500
    FRONTEND_URL: str
    ENVIRONMENT: Literal["dev", "staging", "prod"] = "dev"
    DEMO_MODE: bool = False
    SENTRY_DSN: str | None = None

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("ADMIN_EMAIL_ALLOWLIST", mode="before")
    @classmethod
    def _parse_admin_allowlist(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [e.strip() for e in v.split(",") if e.strip()]
        if isinstance(v, list):
            return v
        return []

    def model_post_init(self, __context: object) -> None:
        """Validate invariants after all fields are loaded."""
        # (1) Collect missing required secrets
        _required = [
            "DATABASE_URL",
            "REDIS_URL",
            "JWT_PRIVATE_KEY",
            "JWT_PUBLIC_KEY",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "RAZORPAY_KEY_ID",
            "RAZORPAY_KEY_SECRET",
            "RAZORPAY_WEBHOOK_SECRET",
            "SMTP_HOST",
            "SMTP_USER",
            "SMTP_PASS",
            "SMTP_FROM",
            "FRONTEND_URL",
        ]
        missing = [k for k in _required if not getattr(self, k, None)]
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

        # (2) DEMO_MODE blocked in production
        if self.DEMO_MODE and self.ENVIRONMENT == "prod":
            raise RuntimeError("DEMO_MODE=true is not allowed when ENVIRONMENT=prod")


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()  # type: ignore[call-arg]
