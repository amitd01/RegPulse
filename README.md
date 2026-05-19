# RegPulse

> **RBI Regulatory Intelligence Platform** — B2B SaaS delivering RAG-powered Q&A over RBI Circulars for Indian banking compliance professionals.

---

## Status

**REBUILD in progress.** The pre-rebuild project shipped 50 build prompts + 8 sprints + a Frontend v2 redesign on `main` with CI green, but a ReBuild audit (2026-05) found the MVP journey doesn't run end-to-end on real data, the v2 design system covers only the `(app)` route group, the circular detail page renders retrieval chunks rather than structured documents, RAG/LLM orchestration was unit-tested only at the utility-function layer, and the production scraper had never been run. The rebuild keeps ~165 files, rewrites/modifies ~45, discards 21 — and is sequenced as 10 sessions to land the MVP journey on real RBI data, in unified v2 design, with Playwright + integration tests gating every slice in CI.

See `MEMORY.md` § Status for the full audit findings (F1–F8) and `CLAUDE.md` § Rebuild Progress for slice status.

---

## What it does

- **RAG Q&A** — hybrid retrieval (pgvector + Postgres FTS + RRF + cross-encoder rerank) over RBI Circulars, answered by Claude Sonnet (extended thinking, GPT-4o fallback) with strict citation validation and confidence scoring. Below 0.5 confidence or zero valid citations → "Consult an Expert" fallback (no hallucinated answer).
- **Citation-locked** — every claim cites a circular number and section that appears in retrieved chunks. PII never reaches the LLM. RSS news appears alongside circulars but never enters the RAG retrieval corpus.
- **Action items** — answers auto-generate team-tagged tasks (Risk / Compliance / Treasury / Legal etc.) with priorities and due dates.
- **Workspace** — library, history, saved interpretations, action tracker, public snippet sharing, knowledge graph–driven retrieval expansion, semantic clustering heatmap, admin review queue.
- **DPDP-compliant** — OTP-verified account deletion with PII anonymisation; one-click data export.

---

## Architecture

```
rbi.org.in → Scraper (Celery + Redis) → Postgres (pgvector) + KG
                                            ↕
                                     FastAPI /api/v1/
                                            ↕
                                  Next.js 14 (app router)
                                            ↕
                               Claude Sonnet → GPT-4o fallback
```

| Layer | Stack |
|---|---|
| Scraper | Python 3.11, Celery, pdfplumber/pypdf (structural extraction), text-embedding-3-large |
| Backend | FastAPI, SQLAlchemy 2.0 async, Pydantic v2, slowapi, python-jose, pgvector, Anthropic + OpenAI SDKs, reportlab + qrcode |
| Frontend | Next.js 14, TypeScript strict, terminal-modern v2 design (CSS custom-property tokens, Inter Tight + Source Serif 4 + JetBrains Mono), TanStack Query, Zustand, PostHog |
| Database | Postgres 16 + pgvector (3072-dim embeddings, ivfflat indexes, GIN on FTS + JSONB) |
| Cache | Redis 7 (Q&A cache, OTP, jti blacklist, embedding cache) |
| Auth | OTP + RS256 JWT (Zustand memory) + HttpOnly refresh cookie + jti blacklist |
| LLM | Claude Sonnet 4 primary (10k thinking budget); GPT-4o fallback wrapped in pybreaker (slice 10) |
| Tests | pytest unit (SQLite + fakeredis); pytest integration (pgvector container); pytest evals (golden + retrieval); Playwright E2E |
| Deploy | GCP Cloud Run + Cloud SQL + Memorystore + Artifact Registry + Secret Manager + WIF |

---

## Quick start (localhost)

```bash
git clone <repo> && cd RegPulse
cp .env.example .env        # dev defaults already filled — no API keys needed for tests
docker compose up --build -d
# 6 containers: postgres, redis, backend, scraper, celery-beat, frontend

# Open the app
open http://localhost:3000
# OTP in DEMO_MODE is always 123456
# Backend OpenAPI docs:
open http://localhost:8000/api/v1/docs

# Seed the demo corpus (5 synthetic + 5 real-shape circulars)
docker exec regpulse-backend python scripts/seed_demo.py

# Run the Playwright MVP-journey suite against the running stack
make e2e
```

Real LLM responses need `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` in `.env`. Without them the app boots, auth works, library renders, but Q&A returns the consult-expert fallback.

---

## Tests

```bash
# Backend unit (no infra needed)
PYTHONPATH=backend pytest backend/tests/unit

# Backend integration (needs pgvector + Redis containers — handled by docker compose or testcontainers)
PYTHONPATH=backend pytest backend/tests/integration

# Backend evals (needs real OpenAI key + real PG)
make eval

# Frontend E2E (Playwright against running stack)
make e2e

# Visual regression (Playwright snapshots — slice 7+)
make visual

# Load (k6, requires k6 CLI)
make load
```

CI runs unit + integration + E2E on every PR; evals run on PRs touching RAG/LLM code.

---

## Project layout

```
backend/                FastAPI + SQLAlchemy app
  app/                  routers, services, models, schemas, deps
  migrations/           5 SQL files (initial + KG + confidence + sprint5 + system_user) + structured_content (slice 4)
  scripts/              seed_demo.py + backfill scripts
  tests/                unit / integration / evals
scraper/                Celery scraper (crawler, extractor, processor, tasks)
frontend/               Next.js 14 app
  src/app/              27 routes (all v2 post-rebuild)
  src/components/       design/Primitives + shell/* + ui/*
  src/lib/api/generated/  openapi-typescript output (do not edit)
files/design-v2/        v2 design source bundle (JSX, mock data, tokens — reference)
config/                 free-email blocklist
nginx/                  prod reverse-proxy config
scripts/                launch_check.sh, jira.sh
tests/load/             k6 scenarios
```

---

## Documents

| File | Purpose |
|---|---|
| `MEMORY.md` | Architecture, schema, business rules, patterns, ADRs |
| `LEARNINGS.md` | Accumulated gotchas and prevention rules |
| `CLAUDE.md` | Rules + rebuild slice tracker for Claude Code |
| `spec.md` | Full technical spec |
| `RegPulse_PRD_v4.md` | Product requirements (current) |
| `RegPulse_FSD_v4.md` | Functional specification (current) |
| `TECHNICAL_DOCS.md` | Deep technical reference |
| `TEAM_HANDOVER.md` | Engineer onboarding |
| `PRODUCTION_PLAN.md` | GCP deployment roadmap (Phases A → C) |

---

## Licence

Proprietary. © RegPulse, Inc.
