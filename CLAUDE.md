# Claude Code Instructions — RegPulse

> **Read `MEMORY.md` before starting any task.** It contains architecture decisions, business rules, directory structure, database schema, and coding conventions that must be followed.

## Quick Reference

- **API prefix:** All endpoints at `/api/v1/`
- **Python:** ruff + black (line-length=100) + mypy strict. Run `make lint` before completing any task.
- **TypeScript:** `strict: true` in tsconfig, ESLint + Prettier
- **Migrations:** Alembic. Every schema change needs `alembic revision --autogenerate -m "describe_change"`
- **Tests:** pytest (backend), Vitest (frontend), Playwright (E2E)
- **No secrets in code** — all keys/tokens from environment variables via `Settings` class

## Key Rules

1. **Never import from `scraper/` in `backend/`** — use `backend/app/services/embedding_service.py` for embeddings
2. **Never send PII to the LLM** — no user name, email, or org_name in prompts
3. **Always validate citations** — strip circular numbers not in retrieved chunks
4. **Credits deducted only on success** — use `SELECT FOR UPDATE` atomic deduction
5. **Admin router split** — use `routers/admin/` sub-routers, not a monolithic file
6. **Pydantic schemas in `schemas/`** — not inline in routers
7. **SQLAlchemy models in `models/`** — use 2.0 `Mapped[]` annotations
8. **Services via `Depends()`** — never instantiate in route bodies
9. **All errors** return `{"success": false, "error": "message", "code": "ERROR_CODE"}`
10. **Update docs after every prompt/task completion** — after each successful prompt, epic, module, or project milestone, update the following files to reflect current state:
    - `README.md` — build progress tracker, any new setup steps or Makefile targets
    - `MEMORY.md` — architecture changes, new tables/columns, new services or patterns
    - `CLAUDE.md` — new rules, references, or build progress
    - Any relevant spec files if scope or design changed

## Build Prompts

The project is built using 50 sequential Claude Code prompts in `../files/RegPulse_ClaudeCode_50Prompts.docx`. See `../Improv_Regpulse_v1.md` for the improvement analysis that should be applied during build.

## Build Progress

| Prompt | Description | Status | Improvements Applied |
|--------|-------------|--------|---------------------|
| 01 | Monorepo scaffolding | Done | E1, E3, E4, E5, I6 |
| 02 | PostgreSQL schema + pgvector + Alembic + ORM models | Done | A1, A2, A3, A4, D1 |
| 03 | Pydantic Settings config.py (backend + scraper) | Done | D7 (DEMO_MODE prod block) |
| 04 | FastAPI bootstrap, exceptions, db, cache, structlog, routers | Done | A5 (/api/v1/ prefix), A6 (cross-encoder timeout), D4 (webhook CORS exclude) |
| 04b | Standalone embedding service (no scraper imports) | Done | A9 (shared embedding service), B3 (no cross-module import) |
| 05 | RBI website crawler — URL discovery | Done | — |
| 06 | PDF download + text extraction (pdfplumber + OCR) | Done | — |
| 07 | Metadata extraction (circular_number, dates, dept, teams) | Done | A3 (action_deadline, affected_teams) |
| 08 | Text chunker (sentence-aware, 512-token, 64-overlap) | Done | — |
| 09 | Celery tasks, db.py, impact classifier, full pipeline | Done | — |
| 10 | Supersession resolver + staleness detection + alerts | Done | — |
| 11–14 | Remaining prompts (pre-library) | Pending | — |
| 15 | Circular Library API — Hybrid Search + Autocomplete | Done | A5 (hybrid RRF), A9 (embedding service reuse) |
| 16 | Circular Library Frontend — list page, filters, search | Done | — |
| 17 | Circular Detail Page — metadata, summary, chunks | Done | — |
| 18–50 | Remaining prompts | Pending | — |

**Last updated:** 2026-03-26 after Prompt [17]

## File Reference

| File | Purpose |
|------|---------|
| `MEMORY.md` | Full project context — architecture, schema, rules, patterns |
| `../files/RegPulse_ClaudeCode_50Prompts.docx` | 50 build prompts |
| `../files/RegPulse_PRD_v1.0.docx` | Product Requirements Document |
| `../files/RegPulse_FSD_v1.0.docx` | Functional Specification Document |
| `../Improv_Regpulse_v1.md` | Improvement analysis (40 items across 9 categories) |
| `../regpulse_mockup_all_screens.html` | UI mockup prototypes |
