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

## Phase 2 Roadmap (Sprint 1-7)

| Sprint | Description | Status |
|--------|-------------|--------|
| Sprint 1 | Hardening (HTTPOnly cookies, Scraper Embedder), Analytics (PostHog), Landing Page | ✅ Complete (`363b1ef`) |
| Sprint 2 | Anti-Hallucination Guardrails, Golden Dataset Eval Pipeline, k6 Load Tests | ✅ Complete (`1858575`) |
| Sprint 3 | Public Snippet Sharing, RSS/News Ingest, Knowledge Graph + RAG Expansion (flag-gated) | ✅ Complete (`5379c49`/`5d6dec3`/`52375b8`/`516acf9`) |
| Sprint 4 | Premium UI Polish (Confidence Meter UI, Skeleton loaders, Dark mode, SSE jitter fix), A/B UX flag scaffolding + LLM SDK / fallback-model hardening | ✅ Complete (`f6c3a5a` + `fdc784c`) |
| Sprint 5 | Admin Manual PDF Upload, Semantic Clustering Heatmaps | ✅ Complete (`5a8a77b` + CI fixes `33d9b8d`) |
| Sprint 6 | Pre-Launch Hardening: SIGTERM shutdown, system user audit, scraper embeddings on insert, LLM exception tightening, KG expansion GA, retrieval eval, dev Dockerfile | ✅ Complete |
| Sprint 7 | DPDP Compliance (account deletion + data export), subscription auto-renewal, low-credit notifications | ✅ Complete |
| Post-Build | Real data migration, GCP deployment, Beta launch | ⏳ Planned |

## Localhost Demo

Status: **Running** (updated 2026-04-13). All 6 containers operational via `docker compose up --build -d`.

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
- KG-driven RAG expansion is now **ON by default** (`RAG_KG_EXPANSION_ENABLED=true`) — validated via retrieval eval in Sprint 6
- Sprint 5: Admin manual PDF upload (`/admin/uploads`) — drag-drop PDF → Celery processing → full pipeline (extract, chunk, embed, classify, KG, summary). Uploaded circulars get `upload_source='manual_upload'` and embeddings wired at insert time (fixes TD-08 for uploads)
- Sprint 5: Semantic clustering heatmap (`/admin/heatmap`) — daily Celery task runs k-means on question embeddings with PCA + silhouette-based k selection, labels clusters via Haiku. CSS-grid heatmap with period/bucket controls
- Sprint 5 migration `004_sprint5.sql`: `manual_uploads` table, `circular_documents.upload_source`, `question_clusters` table, `questions.cluster_id`
- Sprint 6: Pre-launch hardening — SIGTERM graceful shutdown (backend + Celery), system user for audit log (`005_sprint6_system_user.sql`), scraper embeddings wired into `process_document` INSERT (TD-08 fully resolved), LLM exception handling tightened to typed API errors (TD-10), dev Dockerfile target + `requirements-dev.txt`, retrieval-level integration eval (`test_retrieval.py`), stale PR #4 closed
- Sprint 6 migration `005_sprint6_system_user.sql`: seeds system user `00000000-0000-0000-0000-000000000001` (`system@regpulse.internal`)
- See `PRODUCTION_PLAN.md` for GCP deployment roadmap
- Sprint 7: DPDP compliance — account deletion (`PATCH /api/v1/account/delete`) with OTP verification, PII anonymisation, session revocation; data export (`GET /api/v1/account/export`) as downloadable JSON; auto-renew toggle (`PATCH /api/v1/subscriptions/auto-renew`); Celery tasks for renewal reminders (daily 08:00 IST) and low-credit notifications (daily 09:00 IST); in-request low-credit email trigger at balance 5 or 2
- Sprint 7 adds account router at `/api/v1/account` (3 endpoints), auto-renew endpoint in subscriptions, 2 Celery beat tasks, 6 unit tests

## Next Steps (Post-Sprint 7)

Sprint 7 resolved G-01 (DPDP deletion), G-02 (DPDP export), G-04 (auto-renewal), G-05 (low-credit notifications). See `DEVELOPMENT_PLAN.md` for the unified implementation plan.

### Pre-Launch (Sprint 8 + GCP Phases A–C)
| Phase | Work |
|-------|------|
| Sprint 8 | Updates feed tracking, action items stats/overdue, admin Q&A sandbox, question suggestions, PDF QR codes |
| Phase A | GCP infra provisioning: Cloud SQL, Memorystore, Artifact Registry, Secret Manager (parallel with Sprint 7) |
| Phase B | CI/CD hardening: WIF, staging env, security baseline, integration tests |
| Phase C | Data migration (full RBI scrape), observability, pre-launch testing, v1.0.0 launch |

### Post-Launch (Sprint 9+)
| Phase | Work |
|-------|------|
| Sprint 9 | pybreaker circuit breaker, TD-01/TD-03/TD-09, mobile responsive polish |
| Sprint 10–12 | Conversational Q&A, team seats, shared interpretations |
| Sprint 13–15 | Multi-regulator (SEBI), cross-regulator RAG, email digests |
| Sprint 16–18 | Enterprise API, batch export, circular version diff |

### Remaining Tech Debt
| Size | Items |
|------|-------|
| Medium | TD-01 (scraper DB isolation), TD-03 (OpenAPI codegen), TD-09 (BACKEND_PUBLIC_URL) |

### PRD v2.0 → v3.0 Gap Summary (12 gaps)
| Priority | Gaps |
|----------|------|
| ~~**Before Launch**~~ | ~~G-01 (DPDP deletion), G-02 (DPDP export)~~ — ✅ Sprint 7 |
| ~~**Sprint 7**~~ | ~~G-04 (auto-renewal), G-05 (low-credit emails)~~ — ✅ Sprint 7 |
| **Sprint 8** | G-03 (updates tracking), G-06 (action stats), G-07 (admin sandbox), G-08 (suggestions), G-09 (PDF QR), G-12 (overdue) |
| **Sprint 9** | G-10 (circuit breaker) |
| **Deferred** | G-11 (query expansion — KG expansion serves same purpose) |

## File Reference

| File | Purpose |
|------|---------|
| `MEMORY.md` | Architecture, schema, business rules, patterns |
| `context.md` | Project state — inventory, verification results |
| `spec.md` | Full technical spec — schema, API, RAG pipeline, security |
| `README.md` | External docs — build progress, API ref, setup |
| `LEARNINGS.md` | Phase 2 mistakes, root causes, and prevention rules — read before any sprint |
| `TESTCASES.md` | Complete test inventory — functional, technical, eval, load, stress |
| `PRODUCTION_PLAN.md` | GCP deployment roadmap and cost estimates |
| `DEVELOPMENT_PLAN.md` | Unified implementation plan — gap closure, infra, roadmap |
| `RegPulse_PRD_v3.md` | Product requirements v3.0 with gap analysis |
| `RegPulse_FSD_v3.md` | Functional specification v3.0 with gap analysis |
| `TECHNICAL_DOCS.md` | Full technical documentation — architecture, DB, API, RAG, security, runbook |
