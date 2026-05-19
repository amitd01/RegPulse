# Claude Code Instructions — RegPulse

> **Read `MEMORY.md` and `LEARNINGS.md` before starting any task.**

## Project state — REBUILD in progress

The pre-rebuild project shipped 50 build prompts + 8 sprints + Frontend v2 on `main` with CI green, but the ReBuild audit confirmed the MVP journey doesn't run end-to-end on real data, the v2 redesign covers only the `(app)` route group, the circular detail page dumps retrieval chunks instead of rendering documents, RAG/LLM orchestration is unit-tested only at the utility-function layer, and the production scraper has never run. The rebuild is sequenced as 1 freeze session + 1 contract session + 8 vertical-slice sessions. Foundation (schema, models, routers, services, auth, v2 tokens, AppShell) is reused; rewrite surface is the PDF extractor, the document renderer, all non-v2 routes (auth, admin, landing, snippet share, detail pages), and the test infrastructure (Playwright E2E + pgvector integration suite in CI).

## Rules

1. All endpoints at `/api/v1/` — never deviate
2. Never import from `scraper/` in `backend/`
3. Never send PII to the LLM
4. Always validate citations — strip circular numbers not in retrieved chunks
5. Credits deducted only on success — `SELECT FOR UPDATE`
6. Admin routers in `routers/admin/` sub-package
7. Pydantic schemas in `schemas/` — not inline in routers
8. SQLAlchemy 2.0 `Mapped[]` annotations — TIMESTAMPTZ columns use `DateTime(timezone=True)`
9. Services via `Depends()` — never instantiate in route bodies
10. All errors return `{"success": false, "error": "message", "code": "ERROR_CODE"}`
11. Public snippet sharing must NEVER expose `detailed_interpretation` — only `quick_answer` (truncated) + 1 citation, or the consult-expert fallback
12. RSS news items live in `news_items` and surface in `/updates`, but are **never** mixed into the RAG retrieval corpus
13. **No UI without an OpenAPI contract.** Mock-only frontend routes are not allowed past slice 2 — the backend stub must exist before the page ships
14. **No DEMO_MODE quality regressions.** Reranker, citation validation, confidence scoring, KG expansion all stay on in every runnable mode
15. **Every route uses v2 design tokens.** No `bg-navy-*` / `text-navy-*` / `slate-*` Tailwind utility classes anywhere in `frontend/src/app/` — design tokens are CSS custom properties in `globals.css`, dark mode via `html.dark`
16. **Retrieval shape ≠ reading shape.** Never render `document_chunks.chunk_text` directly to users — use `circular_documents.structured_content` for human-facing rendering
17. **Slice complete = integration-green + Playwright-green.** Unit-green plus manual UAT is not a quality gate
18. Frontend API client is **generated** from OpenAPI; do not hand-edit `frontend/src/lib/api/generated/*`
19. After each slice: update `MEMORY.md` + `spec.md` + `LEARNINGS.md` (if anything surprised us); commit with `SLICE-N:` prefix

## Quick Reference

- **Python:** ruff + black (line-length=100), B008 suppressed globally
- **TypeScript:** `strict: true`, ESLint + Prettier
- **Backend tests:** pytest unit (SQLite + fakeredis); pytest integration (pgvector + Redis containers in CI); pytest evals (golden + retrieval, needs real OpenAI key)
- **Frontend tests:** Playwright E2E against `docker compose up` stack
- **Env:** `.env.example` ships dev defaults — `pytest` runs from a fresh clone without manual editing
- **Codegen:** `make api-codegen` regenerates `frontend/src/lib/api/generated/*` from FastAPI's OpenAPI spec

## Rebuild Progress

| Session | Slice | Description | Status |
|---|---|---|---|
| S1 | — | Foundation freeze: lock schema/models/migrations; regenerate `.env.example`; install full dep set; seed script populates 10 circulars with real embeddings | Done — `aiosqlite` + `fakeredis` added to `requirements-dev.txt`; `make dev-env` generates RSA keypair into `.env`; `DEMO_MODE=true` default; pytest 106/106 from clean clone |
| S2 | — | OpenAPI contract + `openapi-typescript` codegen; stub routers for `/learnings`, `/debate`, `/annotations`, `/feedback/structured` | Done — 3 stub routers (10 endpoints) live with shape-correct empties on reads + 501 on writes; `FeedbackRequest.categories` added; `make api-codegen` generates `frontend/src/lib/api/generated/schema.d.ts` (5,930 lines, 72 paths); 18 contract tests; pytest 124/124; `tsc --noEmit` green |
| S3 | 1 | Auth journey on v2: rewrite `(auth)/{login,register,verify}` + layout; Playwright `auth.spec.ts` | Done — `(auth)/*` + `OTPInput` ported to v2 tokens (0 navy classes); Playwright installed; `auth.spec.ts` lists 5 E2E cases; pytest unit+integration 134/134 green; `make e2e` wired |
| S4 | 2 | Real-data circular reading: structural PDF extractor; `circular_documents.structured_content` migration; 20 real RBI circulars scraped; rewrite `/library/[id]` with document renderer; Playwright `library.spec.ts` | Pending |
| S5 | 3 | RAG Q&A end-to-end on real data: integration test suite for `RAGService.answer_question`; reverse DEMO_MODE reranker skip; Playwright `ask.spec.ts` | Pending |
| S6 | 4 | Loop closure: rewrite `/history/[id]` with same renderer; Save → list → reopen Playwright `save-history.spec.ts` | Pending |
| S7 | 5 | Admin to v2: port all 8 admin routes + heatmap component; visual regression snapshots | Pending |
| S8 | 6 | Public surfaces to v2: landing + snippet share; `grep navy-` repo-wide returns 0 | Pending |
| S9 | 7 | Learnings + Debates + structured Feedback backend (G-13/14/16/17) — implement S2 stubs for real | Pending |
| S10 | 8 | Annotations + Sprint 9 polish: `pybreaker` (G-10), `BACKEND_PUBLIC_URL` (TD-09), mobile responsive | Pending |
| S11+ | — | GCP Phases A → B → C per `PRODUCTION_PLAN.md`; tag `v1.0.0` | Pending |

## File Reference

| File | Purpose |
|---|---|
| `MEMORY.md` | Architecture, schema, business rules, patterns, ADRs |
| `LEARNINGS.md` | Mistakes + root causes + prevention rules — append every slice |
| `spec.md` | Full technical spec — schema, API, RAG pipeline, security |
| `README.md` | External docs — setup, status, API reference |
| `RegPulse_PRD_v4.md` | Product requirements v4.0 (current) |
| `RegPulse_FSD_v4.md` | Functional specification v4.0 (current) |
| `TEAM_HANDOVER.md` | Orientation doc for engineers joining mid-rebuild |
| `TECHNICAL_DOCS.md` | Deep technical reference (architecture, DB, API, RAG, security, runbook) |
| `PRODUCTION_PLAN.md` | GCP deployment roadmap (Phases A → C) |
| `files/design-v2/project/` | v2 design source bundle — JSX, mock data, tokens (reference only) |
