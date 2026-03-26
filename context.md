# RegPulse — Session Context (Live Document)

> **Updated after every successful prompt execution.** This file tracks the current sprint, what was just completed, what's next, and any blockers or runtime observations.

---

## Current State

- **Branch:** `claude/regpulse-sprint-4-setup-qdC85`
- **Last prompt completed:** **Prompt [17]** — Circular Detail Page
- **Next prompt:** **Prompt [18]** — RAG Q&A Pipeline
- **Sprint:** Sprint 4 complete. Sprint 5 (RAG Q&A) begins at Prompt [18].
- **Date:** 2026-03-26

---

## Prompt Execution Log

| Prompt | Description | Status | Tests | Notes |
|--------|-------------|--------|-------|-------|
| 15 | Circular Library API — Hybrid Search + Autocomplete | Done | 30/30 pass | CircularLibraryService, hybrid RRF, auth deps |
| 16 | Circular Library Frontend — list page with filters | Done | Build pass, lint clean | TanStack Query hooks, FilterPanel, CircularCard |
| 17 | Circular Detail Page — metadata, summary, chunks | Done | Build pass, lint clean | Detail page with chunks, AppSidebar, middleware |

---

## What Exists (Backend)

### Services (backend/app/services/)
- `embedding_service.py` — OpenAI embeddings with Redis cache, FastAPI dependency
- `circular_library_service.py` — Hybrid search (vector + BM25 RRF), autocomplete, list, detail, facets

### Routers (backend/app/routers/)
- `circulars.py` — **FULL**: 7 endpoints (list, search, autocomplete, detail, departments, tags, doc-types)
- `auth.py` — **STUB**: empty router
- `questions.py`, `subscriptions.py`, `action_items.py`, `saved.py` — **STUBS**
- `admin/` — **STUBS**: dashboard, review, prompts, users, circulars, scraper

### Dependencies (backend/app/dependencies/)
- `auth.py` — get_current_user, require_active_user, require_verified_user, require_admin, require_credits

### Tests
- 30 backend unit tests (all passing)
- `tests/unit/test_circular_library_service.py` — 14 tests
- `tests/unit/test_circulars_router.py` — 16 tests

---

## What Exists (Frontend)

### Pages
- `/` — Landing page
- `/library` — Circular list with filters, search, pagination (static pre-render)
- `/library/[id]` — Circular detail with metadata, summary, chunks (dynamic)

### Components
- `Providers.tsx` — QueryClientProvider + Toaster
- `AppSidebar.tsx` — Sidebar with Library, Ask, History, Updates links
- `ui/Badge.tsx`, `ui/Pagination.tsx`, `ui/SearchInput.tsx`, `ui/Select.tsx`, `ui/Spinner.tsx`
- `library/CircularCard.tsx`, `library/FilterPanel.tsx`

### Hooks
- `useCirculars.ts` — useCircularList, useCircularSearch, useCircularAutocomplete, useCircularDetail, useDepartments, useTags, useDocTypes

### Infrastructure
- `middleware.ts` — Route protection (library browsable, ask/history/etc require auth)
- `api.ts` — Axios with auth interceptor (Bearer token from Zustand)
- `cn.ts` — Tailwind class merge utility
- TanStack Query + React Hot Toast integrated
- ESLint + TypeScript ESLint + Prettier configured
- Build passes clean

---

## Runtime Environment

- Python 3.11, pip packages installed
- Node.js with pnpm, node_modules installed
- No PostgreSQL/Redis (tests use SQLite/mocks)
- Frontend builds successfully to standalone

---

## Key Patterns & Decisions

1. **Library is browsable without auth** — search requires verified user (at API level)
2. **TanStack Query** for all data fetching, staleTime configured per query type
3. **Zustand** for auth state (token in memory only, never localStorage)
4. **AppSidebar** in `(app)` route group layout — shared across all app pages
5. **CircularCard** supports both list items and search results (with relevance score)
6. **Debounced search** (300ms) with clear button
7. **Middleware** checks refresh_token cookie for protected routes

---

## Upcoming Prompts

| Prompt | Description | Sprint |
|--------|-------------|--------|
| 18 | RAG Service — hybrid retrieval pipeline | Sprint 5 |
| 19 | LLM Service — structured JSON, injection guard, fallback | Sprint 5 |
| 20 | SSE streaming Q&A endpoint | Sprint 5 |
| 21 | Answer caching + credit deduction | Sprint 5 |
| 22 | Q&A frontend — ask page with SSE | Sprint 5 |
| 23 | Q&A history page | Sprint 5 |
