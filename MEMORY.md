# RegPulse — Project Memory

> **Read this file before every Claude Code task.**

---

## Product

B2B SaaS for Indian banking professionals. RAG-powered Q&A over RBI Circulars with cited answers. Work-email-gated, subscription-based, 5 free lifetime credits.

> **Read `LEARNINGS.md` at the repo root before starting any sprint.** Phase 2 mistakes are catalogued there with root causes and prevention rules.

**(Phase 2 — Sprints 1–6 shipped, CI green)**:
- Strict zero-hallucination constraint with multi-signal confidence scoring (0.0-1.0).
- "Consult an Expert" fallback when confidence < 0.5 or zero valid citations.
- PostHog adopted for event/journey analytics to prevent lock-in.
- HTTPOnly cookie-based refresh tokens (XSS-resistant).
- Sprint 3: public safe snippet sharing (`/s/[slug]`), RSS/news ingest with embedding-based circular linking, knowledge graph extraction with RAG expansion.
- News items live alongside circulars in `/updates` but are **never** mixed into the RAG retrieval corpus.
- Sprint 4: Confidence Meter UI, class-based dark mode (WCAG-AA), skeleton loaders, rAF-buffered SSE rendering, PostHog feature flags.
- Sprint 5: Admin manual PDF upload (`/admin/uploads`), semantic clustering heatmap (`/admin/heatmap`).
- Sprint 6: Pre-launch hardening — SIGTERM graceful shutdown (backend + Celery), system user for audit log, scraper embeddings wired into `process_document` INSERT (TD-08 fully resolved), LLM exception handling tightened to typed API errors, retrieval-level integration eval, dev Dockerfile target, **KG-driven RAG expansion now ON by default** (`RAG_KG_EXPANSION_ENABLED=true`). Migration `005_sprint6_system_user.sql`.

---

## Architecture

**Scraper** (`/scraper`): Celery + Python. Crawls rbi.org.in daily → PDF extract → chunk → embed → pgvector. Supersession detection + impact classification.

**Backend** (`/backend`): FastAPI, SQLAlchemy 2.0 async, Pydantic v2. All at `/api/v1/`. ~58 endpoints, 11 services.

**Frontend** (`/frontend`): Next.js 14, TypeScript strict, Tailwind, TanStack Query, Zustand. 25 routes.

**LLM:** claude-sonnet-4-20250514 with extended thinking (10k budget) primary, gpt-4o fallback. Embeddings: text-embedding-3-large (3072-dim). Reranker: ms-marco-MiniLM-L-6-v2 (skipped in DEMO_MODE).

---

## Schema (19 tables)

Ground truth: `backend/migrations/001_initial_schema.sql` + `002_sprint3_knowledge_graph.sql` + `003_sprint4_confidence.sql` + `004_sprint5.sql` + `005_sprint6_system_user.sql`

| Table | Model | Key columns |
|-------|-------|-------------|
| users | `user.py` | email, credits, plan, is_admin, email_verified, password_changed_at |
| sessions | `user.py` | token_hash, expires_at, revoked |
| circular_documents | `circular.py` | title, status, impact_level, affected_teams, tags |
| document_chunks | `circular.py` | chunk_text, embedding vector(3072) |
| questions | `question.py` | answer_text, quick_answer, risk_level, **confidence_score**, **consult_expert**, citations JSONB |
| action_items | `question.py` | title, assigned_team, priority, status, due_date |
| saved_interpretations | `question.py` | name, tags, needs_review |
| prompt_versions | `admin.py` | version_tag, prompt_text, is_active |
| subscription_events | `subscription.py` | order_id, plan, amount_paise, status |
| scraper_runs | `scraper.py` | status, documents_processed/failed |
| admin_audit_log | `admin.py` | actor_id, action, target_table, old/new_value |
| analytics_events | `admin.py` | user_hash, event_type, event_data |
| pending_domain_reviews | `user.py` | domain, mx_valid, approved |
| kg_entities (Sprint 3) | `kg.py` | entity_type, canonical_name, aliases (JSONB) |
| kg_relationships (Sprint 3) | `kg.py` | source/target_entity_id, relation_type, source_document_id |
| news_items (Sprint 3) | `news.py` | source, external_id, title, url, linked_circular_id, relevance_score |
| public_snippets (Sprint 3) | `snippet.py` | slug, question_id, snippet_text, top_citation, consult_expert |
| manual_uploads (Sprint 5) | `admin.py` | admin_id, filename, status, document_id, error_message |
| question_clusters (Sprint 5) | `admin.py` | cluster_label, representative_questions, centroid, period_start/end |

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
7. Insufficient context guard: < 2 chunks → "Consult Expert" fallback (no LLM call)
8. Injection guard + XML wrapping → LLM (Anthropic, GPT-4o fallback)
9. Validate citations → compute confidence score (3 signals)
10. Confidence < 0.5 or zero citations → "Consult Expert" fallback
11. INSERT + deduct credit → cache → SSE/JSON
```

LLM returns: `{quick_answer, detailed_interpretation, risk_level, confidence_score, consult_expert, affected_teams, citations[], recommended_actions[]}`

---

## Patterns (Hard Constraints)

**Backend:**
- Never import from `scraper/` — use `embedding_service.py`
- `app.state.cross_encoder` may be None — check before use
- `db.py`: conditional pool_size (skips for SQLite)
- Exception classes in `app.exceptions` only (7 subclasses)
- Auth chain: get_current_user → require_active → require_verified → require_admin/credits
- Auth uses `python-jose` RS256 JWT + jti blacklist in Redis
- Admin mutations write to `admin_audit_log`
- Subscription plans defined in `PLANS` dict in `subscription_service.py`
- Razorpay webhook at `/subscriptions/webhook` — excluded from CORS, verified via HMAC-SHA256
- `POST /questions` uses `response_model=None` (Union return type: JSON or StreamingResponse)
- Config: `from app.config import get_settings` (@lru_cache singleton)
- All errors: `{"success": false, "error": "...", "code": "..."}`
- B008 suppressed globally, E402 suppressed for conftest.py in pyproject.toml
- All ORM enums use `enum.StrEnum`

**Scraper:**
- `scraper/db.py` is synchronous — no await
- `scraper/config.py` uses `ScraperSettings` — never imports `app.config`
- All modules standalone — never import from `backend/`

**Frontend:**
- Access token in Zustand memory only — NEVER localStorage
- Refresh token managed via backend `Set-Cookie` with `HttpOnly; Secure; SameSite=lax`
- Frontend NEVER touches `document.cookie` — relies on `withCredentials: true` in axios
- `authStore.setAuth` takes 2 args: `(user, accessToken)` — no refresh token arg
- `authStore.clearAuth` calls `/api/v1/auth/logout` which clears the HTTPOnly cookie
- For credit balance updates without re-auth: use `useAuthStore.setState({user: {...user, credit_balance: n}})`
- TanStack Query for data fetching; `QueryProvider` wraps app in root layout
- SSE via `fetch` + `ReadableStream` (not EventSource)
- Library browsable without auth; search/ask require verified user
- Middleware checks protected routes (cookie sent automatically by browser)

---

## DEMO_MODE

When `DEMO_MODE=true` (blocked in prod):
- OTP is fixed to `123456` — no email sent
- Work email validation skipped (any email accepted)
- Cross-encoder reranker skipped (fast startup, no HuggingFace download)
- Razorpay/SMTP use dummy keys — payments and email non-functional
- `OTP_MAX_SENDS_PER_HOUR` should be raised (default 3 is too low for testing)

## Environment Variables

See `.env.example`. Key required: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RAZORPAY_*`, `SMTP_*`, `FRONTEND_URL`.

## Localhost Deployment

```bash
cp .env.example .env   # fill in API keys, set DEMO_MODE=true
docker compose up --build -d
# Schema auto-applied via initdb.d mount
# Trigger scraper (embeddings generated on insert — no backfill needed):
# docker exec regpulse-scraper celery -A celery_app -b redis://redis:6379/1 call scraper.tasks.daily_scrape
# Frontend: http://localhost:3000  |  API docs: http://localhost:8000/api/v1/docs
```

**Known issues (demo):**
- Scraper tasks route to `scraper` queue — worker must consume with `-Q celery,scraper`
- `password_changed_at` column was missing from SQL schema (patched)
- `OTP_MAX_SENDS_PER_HOUR` should be raised (default 3 is too low for testing)

---

## Technical Debt

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-09 | OG image URL uses `BACKEND_PUBLIC_URL` config which is unset in demo | Set when AWS deploy lands, falls back to localhost:8000 |
| ~~TD-02~~ | ~~No graceful shutdown handlers~~ | ✅ Fixed (Sprint 6) — SIGTERM handler in `main.py` + Celery `worker_shutting_down` signal |
| ~~TD-04~~ | ~~admin_audit_log.actor_id NOT NULL — scraper can't log~~ | ✅ Fixed (Sprint 6) — System user seeded via `005_sprint6_system_user.sql`, scraper `_audit_log()` helper |
| ~~TD-05~~ | ~~Scraper embedder is a stub~~ | ✅ Fixed (Sprint 1) — Uses OpenAI `text-embedding-3-large` |
| ~~TD-06~~ | ~~Landing page is bare placeholder~~ | ✅ Fixed (Sprint 1) — Full marketing landing page |
| ~~TD-07~~ | ~~refresh_token cookie is not httpOnly~~ | ✅ Fixed (Sprint 1) — Backend `Set-Cookie: HttpOnly; Secure; SameSite=lax` |
| ~~TD-08~~ | ~~`document_chunks.embedding` not populated by `process_document`~~ | ✅ Fixed (Sprint 6) — Embeddings wired into process_document INSERT |
| ~~TD-10~~ | ~~Broad `except Exception` in LLM service~~ | ✅ Fixed (Sprint 6) — Typed Anthropic/OpenAI exception tuples |
| ~~TD-11~~ | ~~Golden eval doesn't exercise retrieval~~ | ✅ Fixed (Sprint 6) — `test_retrieval.py` with real embeddings + Postgres |
| ~~TD-12~~ | ~~pytest not in runtime image~~ | ✅ Fixed (Sprint 6) — `requirements-dev.txt` + Dockerfile `dev` target |
