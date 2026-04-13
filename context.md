# RegPulse — Project Status

> **All 50 prompts + Sprints 1–5 complete and pushed to `origin/main`. CI green.**

---

## Current State (2026-04-13)

- **Branch:** `main` — synced with `origin/main` at `b0cb7d3`
- **Phase:** Phase 2 complete (Sprints 1–5 shipped). Post-Build next.
- **CI:** All 3 jobs green (backend-lint, backend-test, frontend-build)
- **Golden eval:** 21/21 PASS
- **Ruff:** 0 errors — per-file-ignores configured in `pyproject.toml`
- **Frontend:** 25 routes, `tsc --noEmit` clean, `next lint` clean
- **Docker:** 6 containers running; all images rebuilt for Sprint 5
- **`LEARNINGS.md`** at repo root — L1–L5 + cross-sprint patterns. Read before any work.

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

**Backend:** 11 services, 17 router files (~58 endpoints), 19 tables, 4 migrations
**Frontend:** 25 routes, 8 UI components, Tailwind dark mode, PostHog analytics
**Scraper:** 8 Celery tasks (daily/priority scrape, process_document, process_uploaded_pdf, generate_summary, send_staleness_alerts, ingest_news, run_question_clustering), 3 beat schedules
**Infra:** CI/CD (ci.yml + deploy.yml), Nginx config, Makefile, launch_check.sh, PRODUCTION_PLAN.md

---

## Tech Debt (open)

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-02 | No graceful shutdown handlers | SIGTERM handlers post-launch |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-04 | admin_audit_log.actor_id NOT NULL — scraper can't log | Seed system user |
| TD-08 | `process_document` discards embeddings (scraper path only — fixed for uploads) | Wire into Step 6 INSERT |
| TD-09 | `BACKEND_PUBLIC_URL` unset in demo | Set when AWS deploy lands |
| TD-10 | Broad `except Exception` in LLM service (L4.13) | Tighten to Anthropic exception family |
| TD-11 | Golden eval doesn't exercise retrieval (L4.11) | Integration eval with fixture DB |
| TD-12 | pytest not in runtime image (L4.12) | Split requirements-dev.txt |

Resolved: ~~TD-05~~ (Sprint 1), ~~TD-06~~ (Sprint 1), ~~TD-07~~ (Sprint 1)
