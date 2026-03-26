# RegPulse — Project Memory

> **Read this file before every Claude Code task.**

---

## Product

B2B SaaS for Indian banking professionals. RAG-powered Q&A over RBI Circulars with cited answers. Work-email-gated, subscription-based, 5 free lifetime credits.

---

## Architecture

**Scraper** (`/scraper`): Celery + Python. Crawls rbi.org.in daily → PDF extract → chunk → embed → pgvector. Supersession detection + impact classification.

**Backend** (`/backend`): FastAPI, SQLAlchemy 2.0 async, Pydantic v2. All at `/api/v1/`.

**Frontend** (`/frontend`): Next.js 14, TypeScript strict, Tailwind, TanStack Query, Zustand.

**LLM:** claude-sonnet-4-20250514 primary, gpt-4o fallback. Embeddings: text-embedding-3-large (3072-dim). Reranker: ms-marco-MiniLM-L-6-v2.

---

## Schema (13 tables)

Ground truth: `backend/migrations/001_initial_schema.sql`

| Table | Model | Key columns |
|-------|-------|-------------|
| users | `user.py` | email, credits, plan, is_admin, email_verified |
| sessions | `user.py` | token_hash, expires_at, revoked |
| circular_documents | `circular.py` | title, status, impact_level, affected_teams, tags |
| document_chunks | `circular.py` | chunk_text, embedding vector(3072) |
| questions | `question.py` | answer_text, quick_answer, risk_level, citations JSONB |
| action_items | `question.py` | title, assigned_team, priority, status, due_date |
| saved_interpretations | `question.py` | name, tags, needs_review |
| prompt_versions | `admin.py` | version_tag, prompt_text, is_active |
| subscription_events | `subscription.py` | order_id, plan, amount_paise, status |
| scraper_runs | `scraper.py` | status, documents_processed/failed |
| admin_audit_log | `admin.py` | actor_id, action, target_table, old/new_value |
| analytics_events | `admin.py` | user_hash, event_type, event_data |
| pending_domain_reviews | `user.py` | domain, mx_valid, approved |

Indexes: ivfflat on embeddings (lists=100), GIN on FTS + citations JSONB + tags JSONB, btree on FKs/status/timestamps.

---

## Business Rules

1. RAG-only answers — no training knowledge. Injection guard layered on top.
2. Citation validation — strip circular numbers not in retrieved chunks.
3. Credits deducted only on success (SELECT FOR UPDATE). Cache hits free.
4. Work email only — 250+ domain blocklist + MX check.
5. No PDF hosting — `rbi_url` links to rbi.org.in only.
6. Superseded circulars excluded from RAG (`WHERE status='ACTIVE'`).
7. AI summaries need admin approval before display.
8. PII never reaches LLM.
9. Action items auto-generated from `recommended_actions`.
10. Staleness: re-indexed circular → `saved_interpretations.needs_review=TRUE`.

---

## RAG Pipeline

```
1. Normalise + SHA256 hash → Redis cache check (24h TTL, no credit)
2. Embed question → Redis-cached
3. PARALLEL: pgvector cosine ANN + PostgreSQL FTS (WHERE status='ACTIVE')
4. RRF fusion: score = Σ 1/(60 + rank_i)
5. Dedup: max RAG_MAX_CHUNKS_PER_DOC per document
6. Cross-encoder rerank (ProcessPoolExecutor, 30s timeout) → top K
7. Empty → no-answer, no credit
8. Injection guard + XML wrapping → LLM (Anthropic, GPT-4o fallback)
9. Validate citations → INSERT + deduct credit → cache → SSE/JSON
```

LLM returns: `{quick_answer, detailed_interpretation, risk_level, affected_teams, citations[], recommended_actions[]}`

---

## Patterns (Hard Constraints)

**Backend:**
- Never import from `scraper/` — use `embedding_service.py`
- `app.state.cross_encoder` may be None — check before use
- `db.py`: conditional pool_size (skips for SQLite)
- Exception classes in `app.exceptions` only
- Auth chain: get_current_user → require_active → require_verified → require_admin/credits
- Admin mutations write to `admin_audit_log`
- Subscription plans defined in `PLANS` dict in `subscription_service.py`
- Razorpay webhook at `/subscriptions/webhook` — excluded from CORS, verified via HMAC-SHA256
- Config: `from app.config import get_settings` (@lru_cache singleton)
- All errors: `{"success": false, "error": "...", "code": "..."}`
- B008 suppressed globally in pyproject.toml
- All ORM enums use `enum.StrEnum`

**Scraper:**
- `scraper/db.py` is synchronous — no await
- `scraper/config.py` uses `ScraperSettings` — never imports `app.config`
- All modules standalone — never import from `backend/`

**Frontend:**
- Access token in Zustand memory only — NEVER localStorage
- Refresh token is httpOnly cookie
- TanStack Query for data fetching
- SSE via `fetch` + `ReadableStream` (not EventSource)
- Library browsable without auth; search/ask require verified user

---

## Environment Variables

See `.env.example`. Key required: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RAZORPAY_*`, `SMTP_*`, `FRONTEND_URL`.

---

## Technical Debt

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-02 | No graceful shutdown | SIGTERM handlers in Phase 9 |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-04 | admin_audit_log.actor_id NOT NULL — scraper can't log | Seed system user |
| TD-05 | auth.py router is stub in this session | Built in Sprint 3 on main |
