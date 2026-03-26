# RegPulse — Project Memory

> **Read this file before every Claude Code task.**

---

## What RegPulse Is

A **B2B SaaS platform** for Indian Banking and Credit industry professionals to get instant, factual, cited answers to RBI regulatory questions. Every answer is grounded exclusively in the RBI's indexed circular corpus — no LLM hallucination of circular references is acceptable.

**Core value prop:** Work-email-gated, subscription-based, RAG-powered Q&A over RBI Circulars, Master Directions, and Notifications — with structured action items generated from every answer.

---

## Architecture

### Module 1 — Scraper (`/scraper`)
Standalone Python/Celery service. Crawls `rbi.org.in` daily (02:00 IST), priority crawl every 4h. Pipeline: Crawl → PDF Download → Text Extraction → Metadata → Impact Classification → Chunking → Embedding → pgvector → Supersession Resolution → AI Summary → Admin Alert. **Never hosts PDFs** — stores extracted text only.

### Module 2 — Web App (`/backend` + `/frontend`)
FastAPI (Python 3.11), Pydantic v2, SQLAlchemy 2.0 async, Alembic. Next.js 14, TypeScript strict, Tailwind CSS, TanStack Query, Zustand, pnpm. LLM: **claude-sonnet-4-20250514** (primary), **GPT-4o** (fallback). Embeddings: **text-embedding-3-large** (3072-dim).

---

## Database Schema (13 tables)

| Table | Model File | Purpose |
|---|---|---|
| `users` | `models/user.py` | Users: email, credits, plan, is_admin |
| `sessions` | `models/user.py` | Refresh tokens (hashed) + jti blacklist |
| `circular_documents` | `models/circular.py` | Circular metadata, impact_level, affected_teams, tags |
| `document_chunks` | `models/circular.py` | Text chunks + `vector(3072)` embeddings |
| `questions` | `models/question.py` | Q&A records: quick_answer, risk_level, citations, recommended_actions |
| `action_items` | `models/question.py` | Tasks auto-generated from answers |
| `saved_interpretations` | `models/question.py` | Named saved Q&A results |
| `prompt_versions` | `models/admin.py` | Version-controlled system prompts |
| `subscription_events` | `models/subscription.py` | Razorpay payment records |
| `scraper_runs` | `models/scraper.py` | Scraper run logs |
| `admin_audit_log` | `models/admin.py` | Admin actions |
| `analytics_events` | `models/admin.py` | Usage events |
| `pending_domain_reviews` | `models/user.py` | Low-traffic domains flagged for review |

**Ground truth for schema:** `backend/migrations/001_initial_schema.sql`

**Indexes:** ivfflat on chunk embeddings (lists=100), GIN on `to_tsvector(title || circular_number)`, GIN on citations JSONB, btree on all FKs/status/timestamps.

---

## Critical Business Rules

1. **RAG-only answers** — system prompt prohibits training knowledge. Injection guard layered on top.
2. **Citation validation** — only circular numbers present in retrieved chunks are accepted. Hallucinated citations stripped.
3. **No credit on failure** — credits deducted only after successful answer delivery (SELECT FOR UPDATE).
4. **Cache hits are free** — Redis answer cache (24h TTL, SHA256 key on normalised question).
5. **Work email only** — 250+ domain blocklist + async MX record check.
6. **No PDF hosting** — `rbi_url` links to `rbi.org.in` only.
7. **Superseded circulars excluded** from RAG retrieval (`WHERE status='ACTIVE'`).
8. **AI summaries need admin approval** — `pending_admin_review=TRUE` until approved.
9. **PII never reaches LLM** — user name, email, org_name never sent.
10. **Action items auto-generated** from every answer via `recommended_actions`.

---

## RAG Pipeline

```
1. Normalise + SHA256 hash question
2. Redis answer cache → HIT: return immediately, no credit
3. Embed question (text-embedding-3-large, Redis-cached)
4. PARALLEL: pgvector cosine ANN + PostgreSQL FTS (both WHERE status='ACTIVE')
5. Reciprocal Rank Fusion: score = Σ 1/(60 + rank_i)
6. Deduplicate: max RAG_MAX_CHUNKS_PER_DOC per document_id
7. Cross-encoder rerank (ProcessPoolExecutor, 30s timeout) → top RAG_TOP_K_FINAL
8. Empty result → no-answer response, no credit
9. Injection guard + XML tag wrapping
10. LLM call → structured JSON (Anthropic primary, GPT-4o fallback)
11. Validate citations, parse structured fields
12. INSERT question + deduct credit (SELECT FOR UPDATE)
13. Cache answer, emit via SSE or return JSON
```

---

## LLM Response Schema

```json
{
  "quick_answer": "max 80 words",
  "detailed_interpretation": "full markdown",
  "risk_level": "HIGH | MEDIUM | LOW",
  "affected_teams": ["Compliance", "Risk"],
  "citations": [{"circular_number": "RBI/2022-23/98", "verbatim_quote": "...", "section_reference": "..."}],
  "recommended_actions": [{"team": "Compliance", "action_text": "...", "priority": "HIGH"}]
}
```

---

## Established Patterns (Hard Constraints)

**General:**
- All endpoints at `/api/v1/` prefix — never deviate
- All errors return `{"success": false, "error": "...", "code": "..."}`
- B008 globally suppressed in pyproject.toml for FastAPI Depends()
- All ORM enums use `enum.StrEnum`
- Config: `from app.config import get_settings` (`@lru_cache` singleton)
- `get_db()` from `app.db`, `get_redis()` from `app.cache` — always via Depends()

**Backend:**
- Never import from `scraper/` in `backend/` — use `embedding_service.py`
- `app.state.cross_encoder` may be None — always check before use
- `db.py` has conditional pool_size (skips for SQLite)
- Exception classes in `app.exceptions` — never redefine
- Admin router: `routers/admin/` sub-package (6 sub-routers)
- Auth chain: get_current_user → require_active → require_verified → require_admin/credits
- password_changed_at must be tz-aware before comparing with token iat

**Scraper:**
- `scraper/db.py` is fully SYNCHRONOUS — no await in Celery tasks
- `scraper/config.py` uses `ScraperSettings` — never imports `app.config`
- All modules standalone — never import from `backend/`
- `_run_async()` bridges async code into sync Celery context

**Frontend:**
- Access token in Zustand memory only — NEVER localStorage
- Refresh token is httpOnly cookie
- TanStack Query for data fetching, staleTime per query type
- Library browsable without auth; search/ask require verified user
- SSE via native `fetch` + `ReadableStream` (not EventSource, for POST support)

---

## Environment Variables

Defined in `backend/app/config.py` (`Settings`) and `scraper/config.py` (`ScraperSettings`). See `.env.example` for complete reference. Key required: `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RAZORPAY_*`, `SMTP_*`, `FRONTEND_URL`.

---

## Known Technical Debt

| ID | Description | Mitigation |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | Acceptable v1; isolate with API in v2 |
| TD-02 | No graceful shutdown handlers | Add SIGTERM in Phase 9 |
| TD-03 | Manual `api.ts` client | Generate from OpenAPI spec in v1.1 |
| TD-04 | `admin_audit_log.actor_id` NOT NULL — scraper can't log | Seed system user row |
