# RegPulse — Session Context (Live Document)

> **Updated after every successful prompt execution.** This file tracks the current sprint, what was just completed, what's next, and any blockers or runtime observations.

---

## Current State

- **Branch:** `claude/regpulse-sprint-4-setup-qdC85`
- **Last commit:** `39657c0` — feat(circulars): Circular Library API (REG-86)
- **Last prompt completed:** **Prompt [15]** — Circular Library API
- **Next prompt:** **Prompt [16]** — Circular Library Frontend
- **Sprint:** Sprint 4 — Circular Library (REG-86, REG-87, REG-88)
- **Date:** 2026-03-26

---

## Prompt Execution Log

| Prompt | Description | Status | Tests | Notes |
|--------|-------------|--------|-------|-------|
| 15 | Circular Library API — Hybrid Search + Autocomplete | Done | 30/30 pass | CircularLibraryService, hybrid RRF, auth deps |

---

## What Exists (Backend)

### Services (backend/app/services/)
- `embedding_service.py` — OpenAI embeddings with Redis cache, FastAPI dependency
- `circular_library_service.py` — Hybrid search (vector + BM25 RRF), autocomplete, list, detail, facets

### Routers (backend/app/routers/)
- `circulars.py` — **FULL**: 7 endpoints (list, search, autocomplete, detail, departments, tags, doc-types)
- `auth.py` — **STUB**: empty router
- `questions.py` — **STUB**: empty router (placeholder)
- `subscriptions.py` — **STUB**: empty router
- `action_items.py` — **STUB**: empty router
- `saved.py` — **STUB**: empty router
- `admin/` — **STUBS**: dashboard, review, prompts, users, circulars, scraper

### Dependencies (backend/app/dependencies/)
- `auth.py` — get_current_user, require_active_user, require_verified_user, require_admin, require_credits

### Schemas (backend/app/schemas/)
- `circulars.py` — Full: list, search, autocomplete, detail, facet schemas
- `auth.py` — Exists (RegisterRequest, LoginRequest, etc.)
- `questions.py`, `subscriptions.py`, `admin.py` — Exist but may be stubs

### Models (backend/app/models/)
- All 13 tables have ORM models: User, Session, CircularDocument, DocumentChunk, Question, ActionItem, SavedInterpretation, PromptVersion, AdminAuditLog, AnalyticsEvent, ScraperRun, SubscriptionEvent, PendingDomainReview

### Tests
- `tests/unit/test_circular_library_service.py` — 14 tests (RRF, filters, sort)
- `tests/unit/test_circulars_router.py` — 16 tests (all endpoints mocked)
- `tests/conftest.py` — Fixtures (async_session, sample_user, sample_circulars)

---

## What Exists (Frontend)

### Structure
- Next.js 14.2.21, TypeScript strict, Tailwind, pnpm
- `src/app/layout.tsx` — Root layout
- `src/app/page.tsx` — Minimal landing page
- `src/lib/api.ts` — Axios client (baseURL: localhost:8000/api/v1)
- `src/stores/authStore.ts` — Zustand auth store (user, accessToken)
- **No components/ directory yet**
- **No middleware.ts yet**
- **No (app)/ route group yet** (no library, ask, dashboard pages)
- **node_modules missing** — need `pnpm install`

### Dependencies installed
- next, react, zustand, axios, react-markdown, react-hot-toast, clsx, tailwind-merge

---

## What Exists (Scraper)

- Full pipeline: RBICrawler → PDFExtractor → MetadataExtractor → TextChunker → Embedder → ImpactClassifier → SupersessionResolver
- Celery tasks with daily_scrape (02:00 IST) and priority_scrape (every 4h)
- Synchronous DB (scraper/db.py) — never uses async

---

## Runtime Environment

- Python 3.11, no virtual env (system packages)
- No PostgreSQL available (tests use SQLite via aiosqlite)
- No Redis available (mocked in tests)
- pip packages installed: fastapi, sqlalchemy, pydantic, ruff, black, pytest, etc.
- Frontend: pnpm required, node_modules not installed

---

## Key Patterns & Constraints

1. **B008 globally suppressed** in pyproject.toml for FastAPI Depends()
2. **db.py has conditional pool_size** — skips pool_size/max_overflow for SQLite
3. **Auth dependency chain**: get_current_user → require_active → require_verified → require_admin/credits
4. **CircularLibraryService** injected via `_get_service` in router, uses `app.state.embedding_service`
5. **Hybrid search fallback**: if no embedding service, falls back to FTS-only
6. **RRF constant**: K=60 (standard)
7. **All API errors**: `{"success": false, "error": "...", "code": "..."}`

---

## Upcoming Prompts

| Prompt | Description | Sprint |
|--------|-------------|--------|
| 16 | Circular Library Frontend — list page with filters, search bar, pagination | Sprint 4 |
| 17 | Circular Detail Page — full circular view with chunks, metadata, AI summary | Sprint 4 |
| 18+ | RAG Q&A pipeline, subscriptions, admin, remaining frontend | Sprint 5+ |
