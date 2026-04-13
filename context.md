# RegPulse — Project Status

> **All 50 prompts + Sprints 1–6 complete. CI green. Ready for GCP deploy.**

---

## Current State (2026-04-13)

- **Branch:** `main` — Sprint 6 pre-launch hardening complete
- **Phase:** Phase 2 complete (Sprints 1–6 shipped). Post-Build (GCP deploy) next.
- **CI:** All 3 jobs green (backend-lint, backend-test, frontend-build)
- **Golden eval:** 21/21 PASS
- **Retrieval eval:** 8 tests (6 recall + 1 OOS + 1 embedding check)
- **Ruff:** 0 errors — per-file-ignores configured in `pyproject.toml`
- **Frontend:** 25 routes, `tsc --noEmit` clean, `next lint` clean
- **Docker:** 6 containers running; all images rebuilt for Sprint 6
- **`LEARNINGS.md`** at repo root — L1–L6 + cross-sprint patterns. Read before any work.

---

## Git History (main, all pushed)

```
b0cb7d3  docs: Sprint 5 exit — update context, LEARNINGS L5.4, CLAUDE.md
33d9b8d  fix(ci): resolve all pre-existing ruff errors
5a8a77b  feat(sprint-5): admin PDF upload + semantic clustering heatmaps
d7f1b52  chore: gitignore hygiene + post-push doc sync
fdc784c  fix(llm): bump anthropic SDK + assert OpenAI-compatible fallback model
f6c3a5a  feat(sprint-4): Confidence Meter UI, dark mode, skeletons, SSE jitter fix
516acf9  feat(sprint-3): knowledge graph extraction and RAG expansion
52375b8  feat(sprint-3): RSS / news ingest pipeline
45f0f2c  feat(sprint-3): public safe snippet sharing
5379c49  feat(sprint-3): schema + models for KG, news, snippets
1858575  feat(sprint-2): anti-hallucination guardrails, golden dataset, load tests
363b1ef  feat(sprint-1): security hardening, analytics, embedder, landing page
```

---

## Inventory

**Backend:** 11 services, 17 router files (~58 endpoints), 19 tables, 5 migrations
**Frontend:** 25 routes, 8 UI components, Tailwind dark mode, PostHog analytics
**Scraper:** 8 Celery tasks (daily/priority scrape, process_document, process_uploaded_pdf, generate_summary, send_staleness_alerts, ingest_news, run_question_clustering), 4 beat schedules
**Infra:** CI/CD (ci.yml + deploy.yml), Nginx config, Makefile (+ `eval` target), launch_check.sh, PRODUCTION_PLAN.md
**Evals:** `test_hallucination.py` (21 tests), `test_retrieval.py` (8 tests), `k6_load_test.js` (3 scenarios)

---

## Tech Debt (open)

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-09 | `BACKEND_PUBLIC_URL` unset in demo | Set when GCP deploy lands |

Resolved: ~~TD-02~~ (Sprint 6 — SIGTERM handlers), ~~TD-04~~ (Sprint 6 — system user), ~~TD-05~~ (Sprint 1), ~~TD-06~~ (Sprint 1), ~~TD-07~~ (Sprint 1), ~~TD-08~~ (Sprint 6 — scraper embeddings on insert), ~~TD-10~~ (Sprint 6 — typed LLM exceptions), ~~TD-11~~ (Sprint 6 — retrieval eval), ~~TD-12~~ (Sprint 6 — dev requirements split)
