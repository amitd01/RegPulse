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

## Phase 2 Roadmap (Multi-Sprint)

| Phase/Sprint | Description | Status |
|--------------|-------------|--------|
| Sprint 1 | Analytics (PostHog), Core Hardening (HTTPOnly cookies, Direct Embedder), Landing Page | ✅ Complete (`363b1ef`) |
| Sprint 2 | Anti-Hallucination Guardrails, Golden Dataset Eval Pipeline, k6 Load Tests | ✅ Complete (`1858575`) |
| Sprint 3 | Knowledge Graph mapping, RSS/News Ingest, Social Sharing (Public Safe Snippet) | ⏳ Planned |
| Sprint 4 | Premium UI Polish, Skeleton loaders, Dark Mode, Confidence Meter UI | ⏳ Planned |
| Sprint 5 | Admin Workflow: Manual PDF Onboarding, Semantic Clustering Heatmaps for Queries | ⏳ Planned |
| Post-Build | Real data migration, AWS deployment (PRODUCTION_PLAN.md), Beta launch | ⏳ Planned |

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
| LLM | claude-sonnet-4-20250514 with extended thinking (primary), gpt-4o (fallback) |
| Payments | Razorpay (INR) |
| CI/CD | GitHub Actions → AWS ECR → ECS |
| Reverse Proxy | Nginx with TLS 1.3, HSTS, CSP |

---

## Quick Start (Demo Mode)

```bash
cp .env.example .env              # Fill in OPENAI_API_KEY and ANTHROPIC_API_KEY
                                  # Set DEMO_MODE=true, dummy Razorpay/SMTP keys
docker compose up --build -d      # Start all 6 containers (schema auto-applied)

# Trigger scraper to index RBI circulars:
docker exec regpulse-scraper celery -A celery_app -b redis://redis:6379/1 call scraper.tasks.daily_scrape

# Backfill embeddings (required for Q&A to work):
docker exec regpulse-backend python scripts/backfill_embeddings.py
```

| Service | URL |
|---------|-----|
| Register/Login | http://localhost:3000/register |
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/api/v1/docs |

**Demo credentials:** Any work-looking email + OTP `123456`. 5 free credits granted on registration.

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

### Anti-Hallucination Evaluation

```bash
# Run inside backend container:
python -m pytest tests/evals/test_hallucination.py -v
```

30 synthetic test cases across 4 categories:
- **12 factual** — direct citation questions with ground truth
- **3 multi-circular** — cross-reference questions requiring multiple sources
- **8 out-of-scope** — questions the system must refuse (SEBI, tax, crypto, etc.)
- **5 injection** — prompt manipulation attempts that must be blocked

### Load Testing

```bash
brew install k6
k6 run tests/load/k6_load_test.js   # Runs against local Docker Compose
```

3 scenarios: smoke (1 VU), load (ramp to 20 VU), spike (burst to 50 VU).

## Launch Check

```bash
./scripts/launch_check.sh http://localhost:8000 http://localhost:3000
```

---

---

## Production Deployment

See `PRODUCTION_PLAN.md` for the full AWS deployment roadmap including:
- ECS Fargate (backend, frontend, scraper, celery-beat)
- RDS PostgreSQL 16 + pgvector, ElastiCache Redis 7
- ALB with ACM certificate, WAF
- CI/CD via GitHub Actions (tag-triggered deploy)
- Estimated cost: ~$205/month (ap-south-1)

---

*RegPulse is not a legal advisory service. Answers are AI-generated from indexed RBI circulars and should be verified at rbi.org.in.*
