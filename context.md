# RegPulse — Project Status

> **50 build prompts + Sprints 1–8 + Frontend v2 + Phase D.1–D.3 complete. CI green. MVP live on GCP in DEMO_MODE. Critical path now: TD-13 (scraper PDF extraction) → real-data smoke → v1.0.0 cut.**

---

## Current State (2026-05-15)

- **Branch:** `main` — Phase D.3 (Debates API) + 59-file cleanup pass landing this session
- **Phase:** Phase 2 complete. Phase D.1/D.2/D.3 complete (Pulse Dashboard, Team Learnings, Debates wired to live backend). 10/12 PRD v3.0 gaps resolved. G-10 → Sprint 9. G-11 superseded by KG expansion.
- **CI:** All 3 jobs green on `main` (backend-lint, backend-test, frontend-build)
- **UAT:** 81/81 automated tests passed on Sprint 7 state; Sprint 8 added 10 unit tests
- **Golden eval:** 21/21 PASS | **Retrieval eval:** 8/8 PASS | **Unit tests:** 106/106
- **Frontend:** 27 routes (added `/learnings`, `/debate`) | **Backend:** ~67 endpoints, 12 services, 21 tables, 5 SQL migrations + 2 Alembic migrations
- **GCP:** Cloud Run backend/frontend + scraper job live (`regpulse-495309`, asia-south1) since 2026-05-14. DEMO_MODE.

---

## Inventory

**Backend:** 12 services, 20 router files (~67 endpoints), 21 tables, 5 SQL + 2 Alembic migrations
- Phase D.3 additions: `app/models/debate.py`, `app/routers/debates.py`, `app/schemas/debates.py`, Alembic `1066cb96e57c_add_debate_models.py`
- Sprint 8 additions: `app/dependencies/rag.py`, `scripts/backfill_question_embeddings.py`

**Frontend:** 27 routes, terminal-modern v2 design system, PostHog analytics
- Phase D.3: `hooks/useDebates.ts`; `dashboard/page.tsx` + `debate/page.tsx` migrated from mock to live persistent backend via TanStack Query
- Frontend v2 (5 chunks): tokens, AppShell, Primitives, mockData, all 12 pages rewritten

**Scraper:** 10 Celery tasks, 6 beat schedules — **TD-13 PDF extraction bottleneck blocking real-data ingest**

**Infra:** GCP Cloud Run + Cloud SQL + Memorystore + Artifact Registry + VPC + Scheduler + Secret Manager + Cloud Monitoring dashboard

**Evals:** `test_hallucination.py` (21), `test_retrieval.py` (8), `k6_load_test.js` (3 scenarios)
**Tests:** 106 unit + integration

---

## Open Items

| ID | Issue | Owner | When |
|---|---|---|---|
| **TD-13** | Scraper PDF extraction failing — only 10/600 docs land. Poppler "Syntax Error" + empty-text warnings. | next session | Sprint 9 / Phase C |
| TD-01 | Scraper writes direct to backend DB | — | Sprint 9+ |
| TD-03 | Manual api.ts client | — | Sprint 9 |
| TD-09 | `BACKEND_PUBLIC_URL` unset in demo | — | Phase 5 (custom domain) |
| G-10 | LLM circuit breaker (`pybreaker`) | — | Sprint 9 |
| OP-1 | Backfill `questions.question_embedding` for pre-Sprint 8 rows | — | Production cutover |
| OP-2 | Admin sandbox doesn't swap `PromptVersion` at LLM call time | — | Sprint 9 |
| 🗓️ 2026-05-16 | Rotate OpenAI + Anthropic API keys | amit | scheduled |
| 🗓️ 2026-05-16 | Confirm/revoke `shubhamkadam1802@gmail.com` Editor+DevOps | amit | scheduled |

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

1. **Fix TD-13** — debug `PDFExtractor` in scraper container. Verify `poppler-utils` installed, handle "Syntax Error" failures gracefully, test with failing URLs from logs. (~half day)
2. **Real RBI scrape** — re-run scraper, verify `circular_documents` count > 100, run `scripts/backfill_question_embeddings.py`.
3. **Phase 5 — custom domain + TLS** (~30 min active + provisioning wait).
4. **Phase 6 — GitHub Actions auto-deploy via WIF** (~1.5–2 hr).
5. **Phase 7 — smoke test + tag v1.0.0**.

Phase 4H (Celery on GCE) is only needed when leaving DEMO_MODE (auto-renewal, low-credit emails, RSS, clustering).
