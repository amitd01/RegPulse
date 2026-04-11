# Claude Code Instructions — RegPulse

> **Read `MEMORY.md` before starting any task.**

## Rules

1. All endpoints at `/api/v1/` — never deviate
2. Never import from `scraper/` in `backend/`
3. Never send PII to the LLM
4. Always validate citations — strip circular numbers not in retrieved chunks
5. Credits deducted only on success — `SELECT FOR UPDATE`
6. Admin routers in `routers/admin/` sub-package
7. Pydantic schemas in `schemas/` — not inline in routers
8. SQLAlchemy models use 2.0 `Mapped[]` annotations
9. Services via `Depends()` — never instantiate in route bodies
10. All errors return `{"success": false, "error": "message", "code": "ERROR_CODE"}`
11. After every prompt: update README.md, MEMORY.md, CLAUDE.md, context.md

## Quick Reference

- **Python:** ruff + black (line-length=100), B008 suppressed globally
- **TypeScript:** `strict: true`, ESLint + Prettier
- **Tests:** pytest (backend), Next.js build (frontend)
- **Env:** `.env.example` is the reference; `Settings` class loads all

## Build Progress (50/50 done)

| Prompt | Description | Status |
|--------|-------------|--------|
| 01–04b | Infrastructure: monorepo, schema, config, FastAPI, embedding service | Done |
| 05–10 | Scraper: crawl, PDF, metadata, chunking, Celery, supersession | Done |
| 11–14 | Auth: email validation, OTP, JWT, frontend auth | Done |
| 15–17 | Circular Library: hybrid search API, frontend, detail page | Done |
| 18–23 | RAG Q&A: retrieval, LLM, SSE streaming, caching, ask/history | Done |
| 24–27 | Subscriptions: Razorpay, plans, upgrade/account pages | Done |
| 28–32 | Admin: dashboard, review, prompts, users, circulars, scraper | Done |
| 33–36 | Action items + saved interpretations (backend + frontend) | Done |
| 37–42 | Dashboard, updates, admin UI, analytics, summary services | Done |
| 43–50 | PDF export, CI/CD, Nginx, Makefile, launch checks | Done |

## Phase 2 Roadmap (Sprint 1-5)

| Sprint | Description | Status |
|--------|-------------|--------|
| Sprint 1 | Hardening (HTTPOnly cookies, Scraper Embedder), Analytics (PostHog), Landing Page | Pending |
| Sprint 2 | Anti-Hallucination Evals (Zero Hallucination), CI/CD Evals, AWS Prod Deploy | Pending |
| Sprint 3 | Knowledge Graph, RSS/News Ingest, Social Sharing (Public Snippets) | Pending |
| Sprint 4 | Premium UI Polish (Skeleton loaders, Dark mode), A/B UX Evals | Pending |
| Sprint 5 | Admin Content (Manual PDF upload), Semantic Clustering Usage Heatmaps | Pending |

## Localhost Demo

Status: **Running** (2026-03-27). All 6 containers operational via `docker compose up --build -d`.

- `DEMO_MODE=true` — fixed OTP `123456`, no email/payment, no cross-encoder
- LLM uses Claude Sonnet with extended thinking (10k token budget)
- Scraper embedder is a stub — run `backend/scripts/backfill_embeddings.py` after scraper indexes
- Entry points: `/register` or `/login` (not `/` which is a placeholder)
- See `PRODUCTION_PLAN.md` for AWS deployment roadmap

## File Reference

| File | Purpose |
|------|---------|
| `MEMORY.md` | Architecture, schema, business rules, patterns |
| `context.md` | Project state — inventory, verification results |
| `spec.md` | Full technical spec — schema, API, RAG pipeline, security |
| `README.md` | External docs — build progress, API ref, setup |
| `PRODUCTION_PLAN.md` | AWS deployment roadmap and cost estimates |
