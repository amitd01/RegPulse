# RegPulse — Session Handover

> **From:** Sprint 8 session (2026-04-14)
> **To:** Next development session
> **Branch:** `claude/plan-next-steps-YNX8b` (pushed); `main` at `6fa982d`

---

## What Was Done This Session

### Sprint 8 — Pre-Launch UX & Admin Gaps
Shipped the 6 PRD v3.0 gap closures queued for Sprint 8:

| Gap | Feature | Key Files |
|-----|---------|-----------|
| G-03 | Updates feed tracking (unread count + mark-seen + filter chips + sidebar badge) | `backend/app/routers/circulars.py`, `schemas/circulars.py`, `frontend/src/app/(app)/updates/page.tsx`, `frontend/src/components/AppSidebar.tsx` |
| G-06 | Action items `/stats` endpoint (counts by status + overdue) | `backend/app/routers/action_items.py`, `schemas/questions.py` |
| G-12 | Action items `is_overdue` computed field | same |
| G-07 | Admin Q&A sandbox (`GET /admin/prompts/test-question`) — no credits, no Question row, logs to AnalyticsEvent | `backend/app/routers/admin/prompts.py`, `dependencies/rag.py` |
| G-08 | Question suggestions (`GET /questions/suggestions`) — pgvector ANN over user's own `questions.question_embedding` | `backend/app/routers/questions.py`, `frontend/src/app/(app)/ask/page.tsx`, `backend/scripts/backfill_question_embeddings.py` |
| G-09 | Real PDF export with QR codes per citation (`reportlab`, `qrcode[pil]`) | `backend/app/services/pdf_export_service.py`, `backend/app/routers/questions.py`, `requirements.txt` |

### Plumbing
- Extracted `build_rag_service` / `build_llm_service` into `backend/app/dependencies/rag.py` so questions and admin routers share the same wiring.
- Started persisting `questions.question_embedding` in both streaming and non-streaming paths (cache-friendly — EmbeddingService hits its Redis cache from the earlier `RAGService.retrieve` call).
- Added one-off backfill script `scripts/backfill_question_embeddings.py` for pre-existing questions — idempotent, run manually once post-deploy.

### Tests
- 10 new unit tests (all passing):
  - `test_pdf_export.py` — 5 tests (PDF bytes, missing fields, QR embed, text fallback, escape helper)
  - `test_action_items_stats.py` — 2 tests (grouped counts, is_overdue on list)
  - `test_updates_feed.py` — 3 tests (recent feed, impact filter, mark-seen drops unread to 0)
- Total unit suite: 100 passed, 6 pre-existing failures carried over (same set documented in previous handover).

### CI
- `ruff check backend/` → clean.
- `black --check --line-length 100 backend/` → clean.
- `npx tsc --noEmit` → clean.
- `npx next lint` on changed files → clean.

### Docs
- CLAUDE.md: roadmap now shows Sprint 8 ✅ Complete; gap tracker updated.
- DEVELOPMENT_PLAN.md: gap closure table updated.
- This HANDOVER.md.

---

## What To Do Next

### Immediate
Sprint 8 work is **merge-ready on `claude/plan-next-steps-YNX8b`** — open a PR when ready. Once merged, there is no more pre-launch code work.

### Parallel (Phase A) — GCP infra, ~1 week
Per `PRODUCTION_PLAN.md`:
- Create GCP project, enable APIs
- Provision Cloud SQL (PostgreSQL 16 + pgvector), Memorystore Redis
- Create Artifact Registry, store secrets in Secret Manager
- VPC connectors for Cloud Run ↔ Redis/SQL

### After GCP (Phases B → C)
- Phase B: Workload Identity Federation, first deploy, staging env, security hardening
- Phase C: Full RBI scrape (replace 10-circular demo), observability, v1.0.0 launch
- Run `python scripts/backfill_question_embeddings.py` once in production after deploy so existing questions get embeddings for the suggestions endpoint.

### Sprint 9 (post-launch)
- G-10: `pybreaker` circuit breaker in `llm_service.py` (`pybreaker` is already vendored in `requirements.txt`).
- TD-01, TD-03, TD-09.
- Mobile responsive polish.

---

## Key Files to Read First

| File | Why |
|------|-----|
| `LEARNINGS.md` | **Mandatory.** L1–L7 gotchas. Prevents repeat mistakes. |
| `CLAUDE.md` | Rules, build progress, localhost demo state |
| `DEVELOPMENT_PLAN.md` | Sprint roadmap; gap tracker |
| `PRODUCTION_PLAN.md` | GCP deploy steps |
| `UAT_RESULTS.md` | What was tested, what wasn't |
| `context.md` | Current inventory, tech debt, gap status |

---

## Environment State

| Component | State |
|-----------|-------|
| Docker | Code changes not yet rebuilt into running containers — run `docker compose up --build -d` if you want the Sprint 8 endpoints live. |
| Database | Schema unchanged (all Sprint 8 uses pre-existing columns). 10 circulars, 128 chunks, 6 users, 69 news items. |
| Git | `claude/plan-next-steps-YNX8b` ahead of `main` by one Sprint 8 commit. |
| CI | Not yet run in GH Actions for this branch — will run on PR. |

---

## Known Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| 6 pre-existing unit test failures | Low — inherited from pre-Sprint 8 | Update `test_circular_library_service` filter count assertions + fix 1 LLM mock. |
| Razorpay flow untested | Medium — requires test API keys | Test with Razorpay sandbox before launch. |
| Question suggestions empty for users created before Sprint 8 | Low — only until backfill runs | Run `scripts/backfill_question_embeddings.py` once in production. |
| Admin sandbox doesn't actually swap `PromptVersion` at runtime | Low — endpoint validates `prompt_id` exists but LLMService currently uses an in-module system prompt | Wire PromptVersion.prompt_text through LLMService in a follow-up sprint. |

---

## Quick Commands

```bash
# Start everything
docker compose up --build -d

# Run unit tests locally
cd /tmp && DATABASE_URL="sqlite+aiosqlite:///:memory:" REDIS_URL="redis://localhost:6379/0" \
  JWT_PRIVATE_KEY="test" JWT_PUBLIC_KEY="test" OPENAI_API_KEY="test" ANTHROPIC_API_KEY="test" \
  RAZORPAY_KEY_ID="test" RAZORPAY_KEY_SECRET="test" RAZORPAY_WEBHOOK_SECRET="test" \
  SMTP_HOST="localhost" SMTP_PORT="587" SMTP_USER="test" SMTP_PASS="test" SMTP_FROM="test@test.com" \
  FRONTEND_URL="http://localhost:3000" \
  PYTHONPATH=/home/user/RegPulse/backend pytest /home/user/RegPulse/backend/tests/unit/ -v

# Lint
ruff check backend/ && black --check --line-length 100 backend/

# Frontend
cd frontend && npx tsc --noEmit && npx next lint

# Backfill question embeddings (run once in production after deploy)
docker exec regpulse-backend python scripts/backfill_question_embeddings.py
```

---

*Handover created 2026-04-14.*
