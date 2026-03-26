# RegPulse

**RBI Regulatory Intelligence Platform** — Instant, cited answers to Indian banking compliance questions, powered by RBI's own circulars.

---

## Build Progress

| Phase | Prompt(s) | Description | Status |
|-------|-----------|-------------|--------|
| 1 — Infrastructure | 01–04b | Monorepo, schema, config, FastAPI, embedding service | Done |
| 2 — Scraper | 05–10 | Crawl, PDF extract, metadata, chunking, Celery, supersession | Done |
| 3 — Auth | 11–14 | Email validation, OTP, JWT, auth routes, frontend auth | Done |
| 4 — Circular Library | 15–17 | Hybrid search API, library frontend, detail page | Done |
| 5 — RAG Q&A | 18–23 | RAG pipeline, LLM service, SSE streaming, caching, Q&A pages | Done |
| 6 — Subscriptions | 24–27 | Plans, Razorpay orders/verify/webhook, upgrade + account pages | Done |
| 7 — Admin | 28–32 | Dashboard stats, review, prompts CRUD, users, circulars, scraper | Done |
| 8 — Frontend | 33–36 | Action items CRUD, saved interpretations CRUD + frontend pages | Done |
| 8 — Frontend | 37–42 | Auth pages, admin frontend, remaining polish | Pending |
| 9 — Polish | 43–47 | Analytics, load tests, PDF export, email notifications | Pending |
| 10 — Deploy | 48–50 | CI/CD, Nginx, launch checks | Pending |

**36 of 50 prompts complete.** Last updated: 2026-03-26

---

## What It Does

**Scraper** (`/scraper`): Crawls `rbi.org.in` daily. Downloads PDFs, extracts text, chunks, generates embeddings, stores in PostgreSQL + pgvector. Classifies impact level and detects superseded circulars.

**Web App** (`/backend` + `/frontend`): Work-email-gated platform for browsing circulars and asking compliance questions. Every answer cites exact circular numbers with links to `rbi.org.in`.

**Built so far:** 13-table schema, hybrid vector+BM25 search with RRF, cross-encoder reranking, SSE streaming Q&A, citation validation, prompt injection defense, atomic credit deduction, Razorpay subscriptions, full admin panel (6 sub-routers with audit logging), action items, saved interpretations, 11 frontend pages.

---

## Architecture

```
rbi.org.in → Scraper (Celery) → PostgreSQL + pgvector ← FastAPI ← Next.js 14
                                    ↕ Redis 7                ↕ LLM
                                                    claude-sonnet / gpt-4o
```

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Python 3.11 |
| Frontend | Next.js 14, TypeScript strict, Tailwind, TanStack Query, Zustand |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7, Celery |
| LLM | claude-sonnet-4-20250514 (primary), gpt-4o (fallback) |
| Payments | Razorpay (INR) |

---

## Quick Start

```bash
cp .env.example .env              # Fill in API keys
docker compose up -d              # Start postgres, redis, backend, scraper
cd frontend && pnpm install && pnpm dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API docs | http://localhost:8000/api/v1/docs |

---

## API Endpoints (44 implemented)

All paths prefixed with `/api/v1/`.

| Group | Count | Endpoints |
|-------|-------|-----------|
| Circulars | 7 | list, search, autocomplete, detail, departments, tags, doc-types |
| Questions | 4 | ask (SSE+JSON), history, detail, feedback |
| Subscriptions | 6 | plans, order, verify, webhook, plan info, history |
| Action Items | 4 | list, create, update, delete |
| Saved | 5 | list, create, detail, update, delete |
| Admin | 12 | dashboard, review (3), prompts (3), users (2), circulars (3), scraper (2) |
| Health | 2 | liveness, readiness |
| Auth | 0 | _stub — built in Sprint 3 before this session_ |

---

## Running Tests

```bash
# Backend — 64 unit tests
PYTHONPATH=backend pytest backend/tests/unit/ -v

# Frontend — 11 routes
cd frontend && npx tsc --noEmit && npx next lint && npx next build
```

---

*RegPulse is not a legal advisory service. Answers are AI-generated from indexed RBI circulars and should be verified at rbi.org.in.*
