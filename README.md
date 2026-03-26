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
| 9 — Frontend | 37–42 | Dashboard, updates feed, admin UI (6 pages), analytics, summary | Done |
| 10 — Deploy | 43–50 | Polish, CI/CD, Nginx, launch | Pending |

**42 of 50 prompts complete.** Last updated: 2026-03-26

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
cp .env.example .env && docker compose up -d && cd frontend && pnpm install && pnpm dev
```

---

## Running Tests

```bash
PYTHONPATH=backend pytest backend/tests/unit/ -v    # 64 backend tests
cd frontend && npx next build                        # 22 frontend routes
```

---

*RegPulse is not a legal advisory service. Answers are AI-generated from indexed RBI circulars and should be verified at rbi.org.in.*
