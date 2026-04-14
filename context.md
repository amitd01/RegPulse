# RegPulse — Project Status

> **All 50 prompts + Sprints 1–7 complete. CI green. UAT 81/81 passed. 8 PRD gaps remain → Sprint 8 next. GCP deploy parallel.**

---

## Current State (2026-04-14)

- **Branch:** `main` (`8c9f34b`) — Sprint 7 DPDP compliance complete, UAT passed
- **Phase:** Phase 2 ongoing (Sprints 1–7 shipped). 4/12 PRD gaps resolved in Sprint 7 (G-01/02/04/05). Sprint 8 + GCP deploy next.
- **CI:** All 3 jobs green (backend-lint, backend-test, frontend-build)
- **UAT:** 81/81 automated tests passed (14 categories). See `UAT_RESULTS.md`.
- **Golden eval:** 21/21 PASS | **Retrieval eval:** 8/8 PASS
- **Ruff:** 0 errors | **Black:** 0 reformats | **tsc --noEmit:** clean | **ESLint:** clean
- **Unit tests:** 90/96 (6 pre-existing failures in circular_library_service + llm_exceptions mock)
- **Frontend:** 25 routes | **Backend:** ~62 endpoints, 11 services, 19 tables
- **Docker:** 6 containers running; images rebuilt for Sprint 7
- **`LEARNINGS.md`** at repo root — L1–L7 + cross-sprint patterns

---

## Inventory

**Backend:** 11 services, 18 router files (~62 endpoints), 19 tables, 5 migrations
**Frontend:** 25 routes, 8 UI components, Tailwind dark mode, PostHog analytics
**Scraper:** 10 Celery tasks, 6 beat schedules (Sprint 7 added subscription_renewal_check + credit_notifications)
**Infra:** CI/CD (ci.yml + deploy.yml), Nginx config, Makefile, launch_check.sh, PRODUCTION_PLAN.md
**Evals:** `test_hallucination.py` (21), `test_retrieval.py` (8), `k6_load_test.js` (3 scenarios)
**Tests:** `test_account.py` (6 — Sprint 7), plus 84 existing unit/integration tests

---

## Tech Debt (open)

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-09 | `BACKEND_PUBLIC_URL` unset in demo | Set when GCP deploy lands |

Resolved: ~~TD-02/04/05/06/07/08/10/11/12~~ (Sprints 1–6)

---

## PRD Gap Status (4/12 resolved)

| Status | Gaps |
|--------|------|
| ✅ Sprint 7 | G-01 (DPDP deletion), G-02 (DPDP export), G-04 (auto-renewal), G-05 (low-credit) |
| Sprint 8 | G-03, G-06, G-07, G-08, G-09, G-12 |
| Sprint 9 | G-10 (circuit breaker) |
| Deferred | G-11 (KG expansion serves same purpose) |
