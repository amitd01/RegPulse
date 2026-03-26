# RegPulse

**RBI Regulatory Intelligence Platform** — Instant, cited answers to Indian banking compliance questions, powered by RBI's own circulars.

---

## All 50 Build Prompts Complete

| Phase | Prompt(s) | Description |
|-------|-----------|-------------|
| 1 — Infrastructure | 01–04b | Monorepo, 13-table schema, config, FastAPI bootstrap, embedding service |
| 2 — Scraper | 05–10 | RBI crawler, PDF extract, metadata, chunking, Celery, supersession |
| 3 — Auth | 11–14 | Work-email validation, OTP, RS256 JWT, refresh rotation, frontend auth |
| 4 — Circular Library | 15–17 | Hybrid search API (vector+BM25 RRF), library + detail pages |
| 5 — RAG Q&A | 18–23 | RAG pipeline, LLM service, SSE streaming, caching, ask/history pages |
| 6 — Subscriptions | 24–27 | Razorpay orders/verify/webhook, upgrade + account pages |
| 7 — Admin | 28–32 | Dashboard, review, prompts, users, circulars, scraper (6 sub-routers) |
| 8 — Features | 33–36 | Action items CRUD, saved interpretations CRUD + frontend pages |
| 9 — Frontend | 37–42 | Dashboard, updates feed, admin UI (6 pages), analytics + summary services |
| 10 — Deploy | 43–50 | PDF export, CI/CD, Nginx, Makefile, launch checks |

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
| Database | PostgreSQL 16 + pgvector (13 tables, ivfflat + GIN indexes) |
| Cache/Queue | Redis 7, Celery |
| LLM | claude-sonnet-4-20250514 (primary), gpt-4o (fallback) |
| Payments | Razorpay (INR) |
| CI/CD | GitHub Actions → AWS ECR → ECS |
| Reverse Proxy | Nginx with TLS 1.3, HSTS, CSP |

---

## Quick Start

```bash
cp .env.example .env              # Fill in API keys (see .env.example for all vars)
docker compose up -d              # Start postgres, redis, backend, scraper, frontend
cd frontend && pnpm install       # Install frontend deps (if running locally)
pnpm dev                          # Start frontend dev server
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/api/v1/docs |

---

## API (48 endpoints at /api/v1/)

| Group | Endpoints |
|-------|-----------|
| Auth | register, login, verify-otp, refresh, logout |
| Circulars | list, search, autocomplete, detail, departments, tags, doc-types |
| Questions | ask (SSE+JSON), history, detail, export, feedback |
| Subscriptions | plans, order, verify, webhook, plan info, history |
| Action Items | list, create, update, delete |
| Saved | list, create, detail, update, delete |
| Admin | dashboard, review (3), prompts (3), users (2), circulars (3), scraper (2) |
| Health | liveness, readiness |

---

## Tests

```bash
make test-backend    # 64 unit tests (pytest)
make test-frontend   # 22 routes (tsc + eslint + next build)
make test            # Both
```

## Launch Check

```bash
./scripts/launch_check.sh http://localhost:8000 http://localhost:3000
```

---

*RegPulse is not a legal advisory service. Answers are AI-generated from indexed RBI circulars and should be verified at rbi.org.in.*
