# RegPulse

**RBI Regulatory Intelligence Platform** — Instant, cited answers to Indian banking compliance questions, powered by RBI's own circulars.

---

## Build Progress

> Built using 50 sequential Claude Code prompts. Roadmap below tracks implementation.

| Phase | Prompt(s) | Description | Status |
|-------|-----------|-------------|--------|
| 1 — Infrastructure | 01–04b | Monorepo, schema, config, FastAPI, embedding service | Done |
| 2 — Scraper | 05–10 | Crawl, PDF extract, metadata, chunking, Celery, supersession | Done |
| 3 — Auth | 11–14 | Email validation, OTP, JWT, auth routes, frontend auth | Done |
| 4 — Circular Library | 15–17 | Hybrid search API, library frontend, detail page | Done |
| 5 — RAG Q&A | 18–23 | RAG pipeline, LLM service, SSE streaming, caching, Q&A pages | Done |
| 6 — Subscriptions | 24–27 | Plans, Razorpay, credit system, upgrade page | Done |
| 7 — Admin | 28–32 | Dashboard, review, prompts, users, circulars, scraper | Done |
| 8 — Frontend | 33–42 | Auth pages, account, saved items, action items, updates | Pending |
| 9 — Polish | 43–47 | Analytics, load tests, PDF export, email notifications | Pending |
| 10 — Deploy | 48–50 | CI/CD, Nginx, launch checks | Pending |

**Last updated:** 2026-03-26 — Prompt [32] complete

---

## What It Does

**Module 1 — Scraper** (`/scraper`): Crawls `rbi.org.in` daily. Downloads PDFs, extracts text, chunks, generates embeddings (text-embedding-3-large), stores in PostgreSQL + pgvector. Classifies impact level (HIGH/MEDIUM/LOW) and detects superseded circulars.

**Module 2 — Web App** (`/backend` + `/frontend`): Work-email-gated platform where banking professionals browse circulars and ask compliance questions. Every answer cites exact circular numbers with links to `rbi.org.in`.

### Features Built (Prompts 01–23)
- 13-table PostgreSQL schema with pgvector + Alembic migrations
- Hybrid BM25 + vector search with Reciprocal Rank Fusion (K=60)
- Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)
- SSE streaming for real-time answer generation
- Citation validation — strips hallucinated circular numbers not in retrieved chunks
- Prompt injection defense (12 regex patterns + XML tag isolation)
- Atomic credit deduction (SELECT FOR UPDATE)
- Anthropic claude-sonnet primary + GPT-4o fallback
- Answer caching (Redis, 24h TTL, SHA256 key)
- Library: paginated list with 8 filter dimensions, autocomplete, detail with chunks
- Q&A: streaming ask page, history with pagination, detail with feedback

### Features Planned (Prompts 24–50)
- Subscription plans + Razorpay payment integration (INR)
- Admin console: answer review, prompt management, scraper controls, user management
- Action items auto-generated from answers
- Saved interpretations with staleness detection
- Analytics dashboard
- PDF compliance brief export
- CI/CD pipeline (GitHub Actions → AWS ECS)

---

## Architecture

```
rbi.org.in → Scraper (Celery) → PostgreSQL + pgvector ← FastAPI ← Next.js 14
                                    ↕ Redis 7                ↕ LLM
                                                    claude-sonnet / gpt-4o
```

- **API prefix:** All endpoints at `/api/v1/`
- **Embeddings:** text-embedding-3-large (3072-dim), Redis-cached
- **Reranker:** ms-marco-MiniLM-L-6-v2 (loaded in app.state)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Python 3.11 |
| Frontend | Next.js 14, TypeScript strict, Tailwind, TanStack Query, Zustand |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7, Celery |
| LLM | claude-sonnet-4-20250514 (primary), gpt-4o (fallback) |
| Payments | Razorpay (planned) |

---

## Quick Start

```bash
cp .env.example .env              # Fill in API keys
docker compose up -d              # Start postgres, redis, backend, scraper
cd frontend && pnpm install       # Install frontend deps
pnpm dev                          # Start frontend dev server
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API docs | http://localhost:8000/api/v1/docs |

---

## API Endpoints (Implemented)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /circulars | Public | List with filters, pagination |
| GET | /circulars/search | Verified | Hybrid vector + BM25 search |
| GET | /circulars/autocomplete | Public | Prefix matching |
| GET | /circulars/{id} | Public | Detail with chunks |
| GET | /circulars/departments | Public | Facet data |
| GET | /circulars/tags | Public | Facet data |
| GET | /circulars/doc-types | Public | Facet data |
| POST | /questions | Credits | Ask question (SSE or JSON) |
| GET | /questions | Verified | Question history |
| GET | /questions/{id} | Verified | Question detail |
| PATCH | /questions/{id}/feedback | Verified | Submit feedback |
| GET | /subscriptions/plans | Public | Available plans |
| POST | /subscriptions/order | Verified | Create Razorpay order |
| POST | /subscriptions/verify | Verified | Verify payment + activate |
| POST | /subscriptions/webhook | Webhook | Razorpay webhook (HMAC) |
| GET | /subscriptions/plan | Verified | Current plan info |
| GET | /subscriptions/history | Verified | Payment history |
| GET | /admin/dashboard | Admin | Aggregate stats |
| GET | /admin/review | Admin | Flagged questions |
| PATCH | /admin/review/{id}/override | Admin | Override answer |
| GET | /admin/prompts | Admin | List prompt versions |
| POST | /admin/prompts | Admin | Create + activate prompt |
| GET | /admin/users | Admin | List users |
| PATCH | /admin/users/{id} | Admin | Update user |
| GET | /admin/circulars/pending-summaries | Admin | Pending summaries |
| PATCH | /admin/circulars/{id} | Admin | Update circular |
| POST | /admin/circulars/{id}/approve-summary | Admin | Approve summary |
| GET | /admin/scraper/runs | Admin | Scraper run history |
| POST | /admin/scraper/trigger | Admin | Trigger scrape |
| GET | /health | Public | Liveness probe |
| GET | /health/ready | Public | Readiness probe |

All paths prefixed with `/api/v1/`.

---

## Running Tests

```bash
# Backend — 54 unit tests
PYTHONPATH=backend pytest backend/tests/unit/ -v

# Frontend — type-check + lint + build
cd frontend && npx tsc --noEmit && npx next lint && npx next build
```

---

## Environment Variables

See `.env.example` for the complete list with documentation. Key groups: Database, Redis, JWT (RS256), OpenAI, Anthropic, Razorpay, SMTP, Application.

---

*RegPulse is not a legal advisory service. Answers are AI-generated from indexed RBI circulars and should be verified at rbi.org.in.*
