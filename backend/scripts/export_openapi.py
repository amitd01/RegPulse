#!/usr/bin/env python3
"""Dump the FastAPI OpenAPI spec to stdout (or to a file with --out).

Used by `make api-codegen` to drive openapi-typescript without needing a running
backend container. Loads `app.main:app` in-process, calls `app.openapi()`,
prints the JSON.

Conftest's test-env stubs are NOT loaded — production-shape app boot. We set
minimal placeholders so the Settings instantiation succeeds without real keys.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

# Minimum env to let `app.config.Settings` instantiate. Real values are NOT
# needed for OpenAPI generation — the spec is built from route signatures.
_PLACEHOLDERS = {
    "DATABASE_URL": "postgresql+asyncpg://stub:stub@localhost:5432/stub",
    "REDIS_URL": "redis://localhost:6379/0",
    "JWT_PRIVATE_KEY": "stub",
    "JWT_PUBLIC_KEY": "stub",
    "OPENAI_API_KEY": "sk-stub",
    "ANTHROPIC_API_KEY": "sk-stub",
    "RAZORPAY_KEY_ID": "rzp_stub",
    "RAZORPAY_KEY_SECRET": "stub",
    "RAZORPAY_WEBHOOK_SECRET": "stub",
    "SMTP_HOST": "localhost",
    "SMTP_PORT": "587",
    "SMTP_USER": "stub",
    "SMTP_PASS": "stub",
    "SMTP_FROM": "stub@example.com",
    "FRONTEND_URL": "http://localhost:3000",
    "ENVIRONMENT": "dev",
    "DEMO_MODE": "true",
}
for k, v in _PLACEHOLDERS.items():
    os.environ.setdefault(k, v)

from app.main import app  # noqa: E402

spec = app.openapi()

if len(sys.argv) >= 3 and sys.argv[1] == "--out":
    out_path = Path(sys.argv[2])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(spec, indent=2))
    print(f"Wrote OpenAPI spec ({len(spec['paths'])} paths) to {out_path}", file=sys.stderr)
else:
    json.dump(spec, sys.stdout, indent=2)
