# Claude Code Instructions — RegPulse

> **Read `MEMORY.md` and `LEARNINGS.md` before starting any task.**
>
> Sprint exit checklist: (1) re-run golden dataset eval if the sprint touched retrieval/answer code, (2) append new gotchas to `LEARNINGS.md`, (3) `git push origin main`, (4) refresh all 5 docs (README, CLAUDE, MEMORY, spec, context). All four must be green before declaring "done."

## Rules

1. All endpoints at `/api/v1/` — never deviate
2. Never import from `scraper/` in `backend/`
3. Never send PII to the LLM
4. Always validate citations — strip circular numbers not in retrieved chunks
5. Credits deducted only on success — `SELECT FOR UPDATE`
6. Admin routers in `routers/admin/` sub-package
7. Pydantic schemas in `schemas/` — not inline in routers
8. SQLAlchemy models use 2.0 `Mapped[]` annotations — TIMESTAMPTZ columns must declare `DateTime(timezone=True)` or asyncpg will reject naive datetimes
9. Services via `Depends()` — never instantiate in route bodies
10. All errors return `{"success": false, "error": "message", "code": "ERROR_CODE"}`
11. Public snippet sharing must NEVER expose `detailed_interpretation` — only `quick_answer` (truncated) + 1 citation, or the consult-expert fallback
12. RSS news items are stored in `news_items` and surfaced in `/updates`, but they are **never** mixed into the RAG retrieval corpus — RAG-only-from-circulars is invariant
13. After every prompt: update README.md, MEMORY.md, CLAUDE.md, context.md

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
| Sprint 1 | Hardening (HTTPOnly cookies, Scraper Embedder), Analytics (PostHog), Landing Page | ✅ Complete (`363b1ef`) |
| Sprint 2 | Anti-Hallucination Guardrails, Golden Dataset Eval Pipeline, k6 Load Tests | ✅ Complete (`1858575`) |
| Sprint 3 | Public Snippet Sharing, RSS/News Ingest, Knowledge Graph + RAG Expansion (flag-gated) | ✅ Complete (`5379c49`/`5d6dec3`/`52375b8`/`516acf9`) |
| Sprint 4 | Premium UI Polish (Confidence Meter UI, Skeleton loaders, Dark mode, SSE jitter fix), A/B UX flag scaffolding | ✅ Complete (local — push pending) |
| Sprint 5 | Admin Content (Manual PDF upload), Semantic Clustering Usage Heatmaps | ⏳ Planned |
| Post-Build | Real data migration, AWS deployment, Beta launch | ⏳ Planned |

## Localhost Demo

Status: **Running** (updated 2026-04-11). All 6 containers operational via `docker compose up --build -d`.

- `DEMO_MODE=true` — fixed OTP `123456`, no email/payment, no cross-encoder
- LLM uses Claude Sonnet with extended thinking (10k token budget)
- Refresh tokens are `HttpOnly` backend cookies — frontend never touches `document.cookie`
- Scraper embedder uses OpenAI `text-embedding-3-large` (no longer a stub)
- Landing page (`/`) is a full marketing page — entry via `/` or `/register` or `/login`
- Anti-hallucination guardrails active: confidence scoring + "Consult Expert" fallback
- Golden dataset eval: `tests/evals/test_hallucination.py` (30 test cases)
- k6 load test: `tests/load/k6_load_test.js` (smoke/load/spike scenarios)
- Sprint 3: public snippet sharing (`/s/[slug]`), RSS news ingest (60 RBI press items live), knowledge graph (95 entities, 29 edges across 6 demo circulars)
- Sprint 4: Confidence Meter UI in `/ask` + `/history/[id]` + `/history` list, class-based dark mode (Tailwind `darkMode: "class"`) with system-pref bootstrap + WCAG-AA palette, skeleton loaders on library/history/updates, rAF-buffered SSE token rendering, PostHog `useFeatureFlag` hook + analytics events (`confidence_meter_viewed`, `dark_mode_toggled`, `share_snippet_dialog_opened`, `ask_question_submitted`)
- Sprint 4 added two columns to `questions` (migration `003_sprint4_confidence.sql`): `confidence_score REAL NULL`, `consult_expert BOOLEAN NOT NULL DEFAULT FALSE`. Older questions render no meter (null is treated as "no signal")
- KG-driven RAG expansion is still **off by default** — Sprint 4 shipped the UI, so the next safe step is to flip `RAG_KG_EXPANSION_ENABLED=true` and re-run the golden eval to verify no regression before going GA
- See `PRODUCTION_PLAN.md` for AWS deployment roadmap

## File Reference

| File | Purpose |
|------|---------|
| `MEMORY.md` | Architecture, schema, business rules, patterns |
| `context.md` | Project state — inventory, verification results |
| `spec.md` | Full technical spec — schema, API, RAG pipeline, security |
| `README.md` | External docs — build progress, API ref, setup |
| `LEARNINGS.md` | Phase 2 mistakes, root causes, and prevention rules — read before any sprint |
| `PRODUCTION_PLAN.md` | AWS deployment roadmap and cost estimates |
