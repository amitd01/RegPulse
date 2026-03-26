# RegPulse — Session Context (Live Document)

> **Updated after every successful prompt execution.**

---

## Current State

- **Branch:** `claude/regpulse-sprint-4-setup-qdC85`
- **Last prompt completed:** **Prompt [23]** — Q&A History Page
- **Next prompt:** **Prompt [24]** — Subscription Plans
- **Sprint:** Sprint 5 complete. Sprint 6 (Subscriptions) begins at Prompt [24].
- **Date:** 2026-03-26

---

## Prompt Execution Log

| Prompt | Description | Status | Tests | Notes |
|--------|-------------|--------|-------|-------|
| 15 | Circular Library API — Hybrid Search + Autocomplete | Done | 30/30 | CircularLibraryService, hybrid RRF, auth deps |
| 16 | Circular Library Frontend — list page with filters | Done | Build pass | TanStack Query hooks, FilterPanel, CircularCard |
| 17 | Circular Detail Page — metadata, summary, chunks | Done | Build pass | Detail page with chunks, AppSidebar, middleware |
| 18 | RAG Service — hybrid retrieval pipeline | Done | 54/54 | Vector + FTS → RRF → dedup → cross-encoder rerank |
| 19 | LLM Service — structured JSON, injection guard | Done | 54/54 | Anthropic primary, GPT-4o fallback, citation validation |
| 20 | Questions router — POST /questions + SSE | Done | 54/54 | Streaming + non-streaming, no-answer handling |
| 21 | Answer caching + credit deduction | Done | 54/54 | Redis cache, SELECT FOR UPDATE atomic deduction |
| 22 | Q&A frontend — ask page with SSE | Done | Build pass | SSE via fetch + ReadableStream, real-time rendering |
| 23 | Q&A history page + detail page | Done | Build pass | History list, detail with feedback buttons |

---

## What Exists (Backend)

### Services
- `embedding_service.py` — OpenAI embeddings with Redis cache
- `circular_library_service.py` — Hybrid search, autocomplete, list, detail, facets
- `rag_service.py` — Full RAG pipeline: embed → vector+FTS → RRF → dedup → cross-encoder rerank
- `llm_service.py` — Anthropic primary + GPT-4o fallback, structured JSON, citation validation, SSE streaming

### Utils
- `injection_guard.py` — 12 regex patterns, `check_injection()` + `sanitise_for_llm()`
- `credit_utils.py` — `deduct_credit()` with SELECT FOR UPDATE

### Routers
- `circulars.py` — **FULL**: 7 endpoints
- `questions.py` — **FULL**: POST (ask+SSE), GET list (history), GET detail, PATCH feedback
- `auth.py` — **STUB**
- `subscriptions.py`, `action_items.py`, `saved.py` — **STUBS**
- `admin/` — **STUBS**

### Tests — 54 passing
- `test_circular_library_service.py` — 14 tests
- `test_circulars_router.py` — 16 tests
- `test_rag_service.py` — 9 tests (RRF, dedup, normalisation, chunk utils)
- `test_llm_service.py` — 15 tests (citation validation, parsing, injection guard)

---

## What Exists (Frontend)

### Pages
- `/` — Landing page
- `/library` — Circular list with filters, search, pagination
- `/library/[id]` — Circular detail with metadata, summary, chunks
- `/ask` — Q&A page with SSE streaming, citations, recommended actions
- `/history` — Question history list with pagination
- `/history/[id]` — Question detail with feedback buttons

### Hooks
- `useCirculars.ts` — 7 hooks for circulars API
- `useQuestions.ts` — useQuestionHistory, useQuestionDetail, useAskQuestion, useSubmitFeedback

### Build: 7 routes, all passing lint + type-check + build

---

## Key Architecture Decisions (Sprint 5)

1. **RAG pipeline** follows MEMORY.md spec exactly: embed → parallel vector+FTS → RRF(K=60) → dedup(max_per_doc) → cross-encoder rerank → top_k_final
2. **LLM system prompt** instructs JSON-only output with strict schema
3. **Citation validation** strips any circular_number not in retrieved chunk set
4. **SSE streaming** uses custom async generator yielding `event: token`, `event: citations`, `event: done`
5. **Credit deduction** only on `done` — no charge for cache hits, no-answer, or errors
6. **Answer cache** in Redis with 24h TTL, keyed on SHA256 of normalised question
7. **Frontend SSE** uses native `fetch` + `ReadableStream` (not EventSource, for POST support)

---

## Upcoming Prompts

| Prompt | Description | Sprint |
|--------|-------------|--------|
| 24 | Subscription plans + Razorpay integration | Sprint 6 |
| 25 | Credit system + plan management | Sprint 6 |
| 26 | Subscription webhook handling | Sprint 6 |
| 27 | Subscription frontend | Sprint 6 |
| 28+ | Admin panel, remaining frontend, polish, deploy | Sprint 7+ |
