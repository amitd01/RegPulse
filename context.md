# RegPulse — Project Status

> **50 build prompts + Sprints 1–8 complete. CI green. All pre-launch code gaps closed. Next critical path: GCP Phases A→C.**

---

## Current State (2026-04-14)

- **Branch:** `main` (`56d628f`) — Sprint 8 UX + admin tooling merged via PR #10
- **Phase:** Phase 2 complete. 10/12 PRD v3.0 gaps resolved (G-01/02/03/04/05/06/07/08/09/12). G-10 deferred to Sprint 9. G-11 superseded by KG expansion.
- **CI:** All 3 jobs green on `main` (backend-lint 12s, backend-test 2m 15s, frontend-build 1m 19s)
- **UAT:** 81/81 automated tests passed on Sprint 7 state (see `UAT_RESULTS.md`); Sprint 8 added 10 unit tests on top
- **Golden eval:** 21/21 PASS | **Retrieval eval:** 8/8 PASS
- **Ruff:** 0 errors | **Black:** 0 reformats | **tsc --noEmit:** clean | **ESLint:** clean
- **Unit tests:** 106/106 passing (fixed 6 pre-existing failures flagged in Sprint 7 handover as part of Sprint 8 CI cleanup)
- **Frontend:** 25 routes | **Backend:** ~65 endpoints, 11 services, 19 tables, 5 migrations
- **Docker:** 6-container `docker compose up --build -d`; rebuild required to pick up Sprint 8 endpoints
- **`LEARNINGS.md`** at repo root — L1–L8 + cross-sprint patterns

---

## Inventory

**Backend:** 11 services, 19 router files (~65 endpoints), 19 tables, 5 migrations
  - New Sprint 8: `app/dependencies/rag.py` (shared RAG/LLM builders), `scripts/backfill_question_embeddings.py`
  - New Sprint 8 endpoints: `GET /circulars/updates`, `POST /circulars/updates/mark-seen`, `GET /action-items/stats`, `GET /admin/prompts/test-question`, `GET /questions/suggestions`; `GET /questions/{id}/export` now returns `application/pdf`
**Frontend:** 25 routes, 9 UI components, Tailwind dark mode, PostHog analytics
  - Sprint 8: filter chips + sidebar unread badge on `/updates`, overdue badge on `/action-items`, debounced suggestions dropdown on `/ask`
**Scraper:** 10 Celery tasks, 6 beat schedules
**Infra:** CI/CD (ci.yml + deploy.yml), Nginx config, Makefile, launch_check.sh, PRODUCTION_PLAN.md
**Evals:** `test_hallucination.py` (21), `test_retrieval.py` (8), `k6_load_test.js` (3 scenarios)
**Tests:** Sprint 7 added `test_account.py` (6). Sprint 8 added `test_pdf_export.py` (5), `test_action_items_stats.py` (2), `test_updates_feed.py` (3). Full: 106 unit.

---

## Tech Debt & Follow-ups (open)

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 (Sprint 9+) |
| TD-03 | Manual api.ts client | OpenAPI codegen (Sprint 9) |
| TD-09 | `BACKEND_PUBLIC_URL` unset in demo | Set when GCP deploy lands |
| G-10 | Simple try/catch LLM fallback — no circuit-open tracking | `pybreaker` in requirements.txt; wire in Sprint 9 |
| OP-1 | `questions.question_embedding` NULL for pre-Sprint 8 rows | Run `scripts/backfill_question_embeddings.py` once in production |
| OP-2 | Admin sandbox doesn't actually swap `PromptVersion` at LLM call time | Wire `PromptVersion.prompt_text` through `LLMService` in Sprint 9 (low priority; endpoint validates `prompt_id` exists) |

Resolved: ~~TD-02/04/05/06/07/08/10/11/12~~ (Sprints 1–6); G-01–G-09, G-12 (Sprints 7–8).

---

## PRD Gap Status (10/12 resolved)

| Status | Gaps |
|--------|------|
| ✅ Sprint 7 | G-01 (DPDP deletion), G-02 (DPDP export), G-04 (auto-renewal), G-05 (low-credit) |
| ✅ Sprint 8 | G-03 (updates tracking), G-06 (action stats), G-07 (admin sandbox), G-08 (suggestions), G-09 (PDF QR), G-12 (overdue) |
| Sprint 9 | G-10 (circuit breaker) |
| Deferred | G-11 (KG expansion serves same purpose) |

---

## Critical Path to v1.0.0

Pre-launch code work is complete. Remaining path to launch:

1. **Phase A — GCP infra provisioning** (~1 week): GCP project, Cloud SQL + pgvector, Memorystore Redis, Artifact Registry, Secret Manager, VPC connectors. See `PRODUCTION_PLAN.md §Phase 2`.
2. **Phase B — CI/CD + security hardening** (~1 week): Workload Identity Federation, first deploy, staging env, custom domain + TLS, `pip audit` / `pnpm audit` in CI, integration test job. See `PRODUCTION_PLAN.md §Phase 4–5`.
3. **Phase C — Data migration + launch** (~1 week): Full RBI scrape, `scripts/backfill_question_embeddings.py`, Cloud Monitoring alert policies, pre-launch smoke tests, tag `v1.0.0`. See `PRODUCTION_PLAN.md §Phase 6–8`.

Target window: ~3 weeks from merge of Sprint 8 to v1.0.0 beta launch, with Phase A and Sprint 9 work parallelisable during Phase B.
