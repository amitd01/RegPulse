# RegPulse — Project Memory

> **Read this file before every Claude Code task.** It is the source of truth for architecture, business rules, and patterns. The status section below reflects the **current rebuild state**, not the pre-rebuild "v1.0.0-rc" framing.

---

## Status (rebuild S1→S10 complete; S4b + GCP infra outstanding)

ReBuild slice plan executed S1 through S10 — 10 commits totaling ~6,000 LoC
of edits. Foundation kept (~165 files); rewrite surface (~45 files) ported
in vertical slices, each gated by `pytest` + `tsc --noEmit` + a `grep` for
navy/slate/gray Tailwind classes returning zero hits.

| Phase | Status |
|---|---|
| F1 (visual split-brain) | **Closed** — all 27 routes on v2 tokens; repo-wide grep returns 0 |
| F2 (RAG orchestration untested) | **Scaffolded** — integration suite in `tests/integration/` skips without `REGPULSE_INTEGRATION_DB_URL`; tests execute against real PG when set |
| F3 (DEMO_MODE skips reranker) | **Closed** — ADR A29 reversed; cross-encoder always on; Dockerfile pre-bakes model |
| F4 (chunk-dump renderer) | **Closed** — `circular_documents.structured_content` JSONB column + StructuredRenderer in `/library/[id]` + `/history/[id]` |
| F5 (PDF extractor flattens structure) | **Schema-ready** — column + renderer landed; structural extractor itself is S4b (needs Docker) |
| F6 (no real RBI corpus) | **Pending S4b** |
| F7 (no E2E tests) | **Closed** — Playwright config + 10 E2E tests across auth/ask/save-history specs |
| F8 (integration suite not in CI) | **Closed** — `make test-integration` wired; CI invocation per slice 9 |

Backend gaps closed: G-13 (Learnings), G-14 (Debates), G-15 (Annotations),
G-16 (structured Feedback), G-10 (pybreaker LLM circuit breaker), G-12
(overdue compute), TD-09 (BACKEND_PUBLIC_URL warning wired).

Outstanding work (not blocking code-complete state):
- **S4b** — structural PDF extractor + dual-output chunker + real RBI scrape
  of ≥20 circulars + Playwright `library.spec.ts` against real data. Needs
  Docker daemon + real OPENAI_API_KEY + internet.
- **GCP Phases A/B/C** — Cloud SQL + Memorystore + Artifact Registry +
  Cloud Run deploys + WIF + `v1.0.0` tag. Tracked in `PRODUCTION_PLAN.md`.

---

## Status (rebuild in progress)

The pre-rebuild codebase shipped 50 build prompts + 8 sprints + a Frontend v2 redesign on `main` with CI green and 106 unit tests passing — but did **not** demonstrate an end-to-end MVP journey on real RBI data. ReBuild audit identified:

- F1 Half the app on the old navy Tailwind palette (auth, admin, landing, detail pages, snippet share); half on v2 terminal-modern (app shell + list pages)
- F2 RAG/LLM orchestration never integration-tested (unit tests cover utility functions only)
- F3 Cross-encoder reranker disabled in DEMO_MODE — the only runnable mode hides the quality differentiator
- F4 Circular detail page renders 512-token retrieval chunks as bordered cards (category error — retrieval shape used as reading shape)
- F5 PDF extractor flattens structure to linear text upstream, so headings/tables/lists are unrecoverable
- F6 No real RBI corpus indexed (10 hand-seeded circulars total)
- F7 No frontend tests, no Playwright, no E2E
- F8 Integration tests = 1 file (auth flow), not in CI

The rebuild keeps ~165 files, rewrites/modifies ~45, discards 21. Foundation (schema, models, routers, services, auth chain, v2 design tokens, AppShell) is reused; PDF extractor, detail page renderers, auth/admin/landing/snippet ports, and the test infrastructure are the rewrite surface.

---

## Product

B2B SaaS for Indian banking compliance professionals. RAG-powered Q&A over RBI Circulars with cited answers. Work-email-gated, subscription-based, 5 free lifetime credits.

- Strict zero-hallucination constraint with multi-signal confidence scoring (0.0–1.0)
- "Consult an Expert" fallback when confidence < 0.5 or zero valid citations
- HTTPOnly cookie-based refresh tokens, RS256 JWT, jti blacklist in Redis
- PostHog event/journey analytics
- Public safe snippet sharing (`/s/[slug]`); RSS news adjacent to RAG corpus but **never** mixed in
- Knowledge graph extraction + RAG expansion (ON by default)
- DPDP-compliant account deletion + data export

---

## Architecture

**Scraper** (`/scraper`): Celery + Python. Crawls rbi.org.in daily → structural PDF extract → chunk → embed → pgvector. Supersession detection + impact classification. Synchronous SQLAlchemy. Never imports from `backend/`.

**Backend** (`/backend`): FastAPI, SQLAlchemy 2.0 async, Pydantic v2. All routes under `/api/v1/`. ~65 endpoints, 14 services.

**Frontend** (`/frontend`): Next.js 14 (app router), TypeScript strict, terminal-modern v2 design system (CSS custom-property tokens, Inter Tight + Source Serif 4 + JetBrains Mono), TanStack Query, Zustand. 27 routes — **all must use v2 tokens** post-rebuild (no `bg-navy-*` / `text-navy-*` Tailwind classes anywhere in `app/`).

**LLM:** `claude-sonnet-4-20250514` with extended thinking (10k budget) primary; `gpt-4o` fallback via OpenAI SDK. Embeddings: `text-embedding-3-large` (3072-dim). Reranker: `ms-marco-MiniLM-L-6-v2` — **always on, including DEMO_MODE** (pre-baked into dev Dockerfile cache).

---

## Schema (19 tables)

Ground truth: `backend/migrations/001..005.sql`. Rebuild slice 4 adds `circular_documents.structured_content JSONB` for the document renderer (not yet applied).

| Group | Tables |
|---|---|
| Users + Auth | `users`, `sessions`, `pending_domain_reviews` |
| Circulars | `circular_documents`, `document_chunks` |
| Q&A | `questions`, `action_items`, `saved_interpretations` |
| Admin | `prompt_versions`, `admin_audit_log`, `analytics_events`, `manual_uploads`, `question_clusters` |
| Payments | `subscription_events` |
| Scraper | `scraper_runs` |
| Sprint 3 | `kg_entities`, `kg_relationships`, `news_items`, `public_snippets` |

`circular_documents` columns: id, circular_number, title, doc_type, department, issued_date, effective_date, rbi_url, status, superseded_by, ai_summary, pending_admin_review, impact_level, action_deadline, affected_teams (JSONB), tags (JSONB), regulator, scraper_run_id, indexed_at, updated_at. Sprint 4 added `confidence_score` + `consult_expert` to `questions`. Sprint 8 added `question_embedding`, `last_seen_updates`.

Indexes: ivfflat on embeddings (lists=100), GIN on FTS + citations JSONB + tags JSONB, btree on FKs/status/timestamps.

---

## Business Rules

1. RAG-only answers — no model knowledge. Injection guard before LLM call.
2. Citation validation — strip circular numbers not in retrieved chunks.
3. Credits deducted only on success (`SELECT FOR UPDATE`). Cache hits free.
4. Work email only — 250+ domain blocklist + MX check.
5. No PDF hosting — `rbi_url` links to rbi.org.in only.
6. Superseded circulars excluded from RAG (`WHERE status='ACTIVE'`).
7. AI summaries need admin approval before display.
8. PII never reaches LLM.
9. Action items auto-generated from `recommended_actions`.
10. Staleness: re-indexed circular → `saved_interpretations.needs_review=TRUE`.
11. Public snippets never expose `detailed_interpretation`.
12. RSS news never mixed into the RAG retrieval corpus.

---

## RAG Pipeline

```
1. Normalise + SHA256 hash → Redis cache check (24h TTL, no credit)
2. Embed question → Redis-cached
3. PARALLEL: pgvector cosine ANN + PostgreSQL FTS (WHERE status='ACTIVE')
4. RRF fusion: score = Σ 1/(60 + rank_i)
5. Dedup: max RAG_MAX_CHUNKS_PER_DOC per document
6. Cross-encoder rerank (ProcessPoolExecutor, 30s timeout) → top K
   ↑ ALWAYS on, including DEMO_MODE (reverses pre-rebuild skip)
7. Insufficient context guard: < 2 chunks → "Consult Expert" fallback (no LLM call)
8. Injection guard + XML wrapping → LLM (Anthropic, GPT-4o fallback)
9. Validate citations → compute confidence score (3 signals)
10. Confidence < 0.5 or zero citations → "Consult Expert" fallback
11. INSERT + deduct credit → cache → SSE/JSON
```

LLM returns: `{quick_answer, detailed_interpretation, risk_level, confidence_score, consult_expert, affected_teams, citations[], recommended_actions[]}`.

---

## Document Storage & Rendering (post-rebuild)

PDFs are extracted **structurally** in slice 4. For each circular the extractor emits two outputs from the same source:

| Output | Used by | Shape |
|---|---|---|
| `document_chunks.chunk_text` (existing) | Retrieval (vector + FTS) | 512-token sliding windows, 64-token overlap |
| `circular_documents.structured_content` (new) | Rendering (`/library/[id]`, `/history/[id]`, `/s/[slug]`) | JSONB tree of `{type: "heading"\|"paragraph"\|"table"\|"list", level, text, children}` |

Retrieval and reading never share the same data shape. The pre-rebuild pattern of rendering retrieval chunks directly as bordered cards is reversed.

---

## Patterns (hard constraints)

### Backend
- Never import from `scraper/` — use `embedding_service.py`
- Scraper → backend ingestion goes through a thin internal HTTP API (TD-01 resolution path); current code still writes direct, transition deferred to post-MVP
- `app.state.cross_encoder` is non-None in all modes
- `db.py`: conditional pool_size (skips for SQLite)
- Exception classes in `app.exceptions` only (7 subclasses)
- Auth chain: `get_current_user → require_active → require_verified → require_admin/credits`
- Auth uses `python-jose` RS256 JWT + jti blacklist in Redis
- Admin mutations write to `admin_audit_log`; admin non-mutating actions (sandbox, test queries) log to `analytics_events`
- Subscription plans defined in `PLANS` dict in `subscription_service.py`
- Razorpay webhook at `/subscriptions/webhook` — excluded from CORS, verified via HMAC-SHA256
- `POST /questions` uses `response_model=None` (Union return: JSON or StreamingResponse)
- `questions.question_embedding` persisted on every new row — `_maybe_embed_question()` in `routers/questions.py`
- Shared RAG/LLM wiring in `app/dependencies/rag.py` — used by `questions.py` and `admin/prompts.py`
- Route ordering: `/foo/stats`, `/foo/suggestions`, `/foo/updates` MUST be declared before any `/foo/{id}` path parameter
- pgvector-only SQL must check `db.bind.dialect.name == 'postgresql'` and short-circuit for SQLite unit tests
- User mutations from routes must use `UPDATE users SET ... WHERE id = :id` rather than attribute-set on the dependency-injected user
- Config: `from app.config import get_settings` (@lru_cache singleton)
- Errors: `{"success": false, "error": "...", "code": "..."}`
- All ORM enums use `enum.StrEnum`
- `reportlab Paragraph` treats `&`, `<`, `>` as markup — pass user strings through `pdf_export_service._escape()`

### Scraper
- `scraper/db.py` is synchronous — no await
- `scraper/config.py` uses `ScraperSettings` — never imports `app.config`
- All modules standalone — never import from `backend/`
- PDF extractor outputs both retrieval chunks AND structured-document JSON (rebuild slice 4)

### Frontend
- Access token in Zustand memory only — NEVER `localStorage`
- Refresh token via backend `Set-Cookie: HttpOnly; Secure; SameSite=lax`
- Frontend never touches `document.cookie` — relies on `withCredentials: true` in axios
- `authStore.setAuth(user, accessToken)`; `clearAuth()` calls `/api/v1/auth/logout`
- Credit balance updates without re-auth: `useAuthStore.setState({user: {...user, credit_balance: n}})`
- TanStack Query for data fetching; `QueryProvider` wraps app in root layout
- SSE via `fetch` + `ReadableStream` — never `EventSource`
- API client is **generated from OpenAPI** (`make api-codegen` → `frontend/src/lib/api/generated/schema.d.ts` via `openapi-typescript`); never hand-edit generated files. `backend/scripts/export_openapi.py` boots `app.main:app` in-process and dumps `openapi.json` — no running backend needed for codegen.
- Library browsable without auth; search/ask require verified user
- Middleware checks protected routes (cookie auto-sent by browser)
- **All v2 tokens.** No `bg-navy-*` / `text-navy-*` Tailwind utility classes in `app/`. Design tokens are CSS custom properties in `globals.css`. Dark mode via `html.dark` class (never `[data-theme]`).
- Primitives in `components/design/Primitives.tsx`; AppShell in `components/shell/`; toasts via `useToast().push({tag, text})`
- `<Link>` + `<button>` child is invalid HTML — use `router.push` in `onClick` or styled `<a>`

---

## DEMO_MODE

`DEMO_MODE=true` (blocked in prod) changes:
- OTP fixed to `123456` — no email sent
- Work-email validation skipped
- Razorpay / SMTP use dummy keys (payments and email non-functional)
- `OTP_MAX_SENDS_PER_HOUR` raised
- **Reranker still runs.** Pre-baked into dev Dockerfile image cache; quality differentiator stays visible in every demo

---

## Environment

See `.env.example`. Required keys: `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RAZORPAY_*`, `SMTP_*`, `FRONTEND_URL`. The example file ships fake-but-shape-correct defaults so `pytest` runs cleanly from a fresh clone without manual editing.

---

## Localhost

```bash
cp .env.example .env       # already has dev defaults
docker compose up --build -d
# Schema auto-applied via initdb.d mount
# Trigger scraper:
# docker exec regpulse-scraper celery -A celery_app -b redis://redis:6379/1 call scraper.tasks.daily_scrape
# Frontend: http://localhost:3000  |  API docs: http://localhost:8000/api/v1/docs
make e2e                   # runs Playwright against the running stack
```

---

## Architectural Decision Records

| # | ADR | Status |
|---|---|---|
| A1 | All endpoints at `/api/v1/` | CONFIRMED |
| A2 | Uniform error envelope `{success, error, code}` | CONFIRMED |
| A3 | SQLAlchemy 2.0 `Mapped[]`; `DateTime(timezone=True)` for TIMESTAMPTZ | CONFIRMED |
| A4 | Pydantic schemas in `schemas/`, never inline | CONFIRMED |
| A5 | Admin routers under `routers/admin/` | CONFIRMED |
| A6 | Services via `Depends()` — never instantiated in route bodies | CONFIRMED |
| A7 | Auth chain `get_current_user → require_active → require_verified → require_admin/credits` | CONFIRMED |
| A8 | RS256 JWT + jti blacklist; HttpOnly refresh cookie; access token in Zustand memory | CONFIRMED |
| A9 | Razorpay HMAC-SHA256 webhook, excluded from CORS | CONFIRMED |
| A10 | RAG-only; injection guard; citation validation; consult-expert fallback < 0.5 | CONFIRMED |
| A11 | Credits via `SELECT FOR UPDATE`; cache hits free | CONFIRMED |
| A12 | PII never to LLM | CONFIRMED |
| A13 | Public snippets exclude `detailed_interpretation` | CONFIRMED |
| A14 | RSS news never mixed into RAG corpus | CONFIRMED |
| A15 | Hybrid retrieval (vector + FTS + RRF + dedup + rerank) | CONFIRMED |
| A16 | `text-embedding-3-large` + Claude Sonnet primary + GPT-4o fallback | CONFIRMED |
| A17 | `get_settings()` lru_cache singleton | CONFIRMED |
| A18 | v2 design tokens as CSS custom properties; dark mode via `html.dark` | CONFIRMED |
| A19 | SSE via `fetch` + `ReadableStream`, not `EventSource` | CONFIRMED |
| A20 | Scraper writes backend DB directly | MODIFIED → thin internal HTTP API (TD-01) |
| A21 | "Update 4 docs after every prompt" | MODIFIED → per slice: MEMORY + spec + commit; coarser cadence |
| A22 | Frontend v2 scope | MODIFIED → all 27 routes, not just `(app)` group |
| A23 | PDF extractor produces linear text | MODIFIED → produce structured document tree |
| A24 | Chunker emits 512-token windows | MODIFIED → emit retrieval chunks AND structured doc |
| A25 | Mock-only routes ship without backend | MODIFIED → no UI without OpenAPI contract |
| A26 | Manual UAT as quality gate | MODIFIED → Playwright E2E + integration suite in CI |
| A27 | "Sprint complete = unit-green + manual UAT" | MODIFIED → slice complete = integration-green + Playwright-green on MVP journey |
| A28 | Hand-rolled `lib/api.ts` | MODIFIED → openapi-typescript codegen |
| A29 | DEMO_MODE skips reranker | REVERSED — reranker always on |
| A30 | Render retrieval chunks as user-facing layer | REVERSED — structured document renderer |
| A31 | Frontend redesign scope `(app)` group only | REVERSED — every route uses v2 |
| A32 | v4 modules ship UI before backend | REVERSED — backend contract first |
| A33 | Production scraper validation deferred | REVERSED — MVP gate requires ≥20 real RBI circulars |

---

## Technical Debt (post-rebuild)

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes backend DB directly | Internal HTTP API in slice 11+ (post-MVP) |
| TD-03 | Manual `api.ts` client | Resolved in slice 2 (codegen) |
| TD-09 | `BACKEND_PUBLIC_URL` unset | Resolved in slice 10 |
| G-10 | LLM circuit breaker | Resolved in slice 10 (pybreaker) |
| OP-1 | `questions.question_embedding` NULL for pre-Sprint 8 rows | One-time backfill in production |
| OP-2 | Admin sandbox doesn't swap PromptVersion at LLM call time | Wire in slice 9 |

---

*See `CLAUDE.md` for build progress + rules; `spec.md` for full technical spec; `LEARNINGS.md` for accumulated gotchas; `RegPulse_PRD_v4.md` + `RegPulse_FSD_v4.md` for product/functional spec.*
