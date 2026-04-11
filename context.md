# RegPulse — Project Status

> **All 50 prompts + Sprints 1, 2, 3, 4 pushed to origin/main. Sprint 4 follow-up (LLM SDK + config hardening) staged locally, push pending.**

---

## Current State (2026-04-11)

- **Branch:** `main` — Sprints 1–4 pushed (`f6c3a5a`); LLM hardening commit staged locally
- **Phase:** Phase 2 — **Sprint 4 + LLM follow-up complete**, KG expansion flag now ON in local `.env`, end-to-end smoke verified
- **Backend tests:** 64 unit + Sprint 3 unit suites (unchanged in Sprint 4 — only schema/persistence touched on the backend)
- **Anti-hallucination eval:** **28/28 PASS, 0 FAIL** re-run on 2026-04-11 after Sprint 4 backend persistence changes (router + schema + ORM)
- **Frontend:** 23 routes, `tsc --noEmit` clean, `next lint` clean
- **Docker:** 6 containers running; backend hot-synced via `docker cp` after migration `003_sprint4_confidence.sql` applied
- **Knowledge graph:** 95 entities + 29 edges across 6 demo circulars (backfilled via `scripts/backfill_kg.py`)
- **News ingest:** 60 RBI press releases live, beat schedule every 30 min
- **Public snippets:** end-to-end share flow verified (POST → public GET → OG image → revoke)
- **Sprint 4 deliverables:** ConfidenceMeter (full + compact variants), class-based dark mode (Tailwind `darkMode:"class"`, ThemeBootstrap pre-hydration script, ThemeToggle in sidebar), CardListSkeleton, rAF token buffer + stable layout containers in `/ask`, `useFeatureFlag` hook + `trackEvent` helper, new analytics events
- **`LEARNINGS.md`** at repo root captures Phase 2 mistakes/root-causes/prevention — read before any sprint

---

## Git History (main, all pushed to origin)

```
c83fd1f  docs: add LEARNINGS.md capturing Phase 2 gotchas
2de014b  docs: Sprint 3 complete — KG, news ingest, public snippets
516acf9  feat(sprint-3): knowledge graph extraction and RAG expansion
52375b8  feat(sprint-3): RSS / news ingest pipeline
45f0f2c  feat(sprint-3): public safe snippet sharing
5379c49  feat(sprint-3): schema + models for KG, news, snippets
dad1fff  docs: Sprint 1+2 completion
1858575  feat(sprint-2): anti-hallucination guardrails, golden dataset, load tests
363b1ef  feat(sprint-1): security hardening, analytics, embedder, landing page
8c79f8c  docs: final update — 50/50 prompts (#9)
fc03e8e  fix: response_model=None for POST /questions (#8)
```

---

## Sprint 3 Changes

### Pillar A — Knowledge Graph (`516acf9`)
| File | Change |
|------|--------|
| `scraper/processor/entity_extractor.py` | Two-pass extractor: regex pre-pass (circular numbers, sections, amounts, dates) + Claude Haiku LLM pass for orgs/regulations/teams + triples |
| `scraper/tasks.py` | Step 6.5 in `process_document` runs extraction + `persist_kg` helper for upsert |
| `backend/app/services/kg_service.py` | Read-only helpers: `find_entities_in_text`, `get_neighbors`, `neighbor_circular_numbers` |
| `backend/app/services/rag_service.py` | Optional `_kg_expand` step gated by `RAG_KG_EXPANSION_ENABLED` (default OFF) |
| `backend/scripts/backfill_kg.py` | Walks ACTIVE circulars and populates KG from existing chunks |
| `scraper/tests/test_entity_extractor.py` | 13 unit assertions (regex, LLM mocking, validation, determinism) |

### Pillar B — RSS / News Ingest (`52375b8`)
| File | Change |
|------|--------|
| `scraper/crawler/rss_fetcher.py` | feedparser-based fetcher with dedup + graceful failure (RBI Press, BS, LiveMint, ET Banking) |
| `scraper/processor/news_relevance.py` | Embed news title+summary, score against active circulars via pgvector cosine, link above 0.75 |
| `scraper/tasks.py` | New `ingest_news` task with per-item savepoints (idempotent) |
| `scraper/celery_app.py` | Beat schedule every 30 min, routes to scraper queue |
| `scraper/requirements.txt` | `feedparser==6.0.11` |
| `backend/app/routers/news.py` | `GET /api/v1/news`, `GET /api/v1/news/{id}` (verified) |
| `backend/app/routers/admin/news.py` | `GET /admin/news`, `PATCH /admin/news/{id}` |
| `frontend/src/lib/api/news.ts` | News client + `sourceLabel` helper |
| `frontend/src/app/(app)/updates/page.tsx` | Tab control: Circulars + Market News |
| `scraper/tests/test_rss_fetcher.py` | 8 fetcher assertions (mocked feedparser) |

### Pillar C — Public Safe Snippet Sharing (`5d6dec3`)
| File | Change |
|------|--------|
| `backend/app/services/snippet_service.py` | Pure builder enforcing redaction guarantee (quick_answer ≤80 words, citation quote ≤200 chars, consult_expert fallback) |
| `backend/app/services/og_image_service.py` | 1200×630 PNG renderer (Pillow) |
| `backend/app/routers/snippets.py` | POST/GET/DELETE/list with slowapi rate limit (60/min) on public read |
| `backend/app/rate_limit.py` | Extracted shared limiter (avoids circular import) |
| `backend/app/config.py` | `SNIPPET_RATE_LIMIT_PER_MIN`, `SNIPPET_EXPIRY_DAYS`, `BACKEND_PUBLIC_URL`, KG/RSS env knobs |
| `frontend/src/lib/api/snippets.ts` | Client + `fetchPublicSnippet` SSR helper |
| `frontend/src/components/ShareSnippetDialog.tsx` | Generate + LinkedIn/X share UI |
| `frontend/src/app/(app)/history/[id]/page.tsx` | Share button wired to dialog |
| `frontend/src/app/s/[slug]/page.tsx` | Public Server Component with `generateMetadata` for og:image |
| `frontend/src/middleware.ts` | `/s/*` allowlisted as public |
| `backend/tests/unit/test_snippet_service.py` | 9 redaction-guarantee assertions |

### Schema Migration (`5379c49`)
- `backend/migrations/002_sprint3_knowledge_graph.sql` — `kg_entities`, `kg_relationships`, `news_items`, `public_snippets` + 4 enum types
- ORM models: `app/models/{kg,news,snippet}.py`
- Pydantic schemas: `app/schemas/{kg,news,snippet}.py`

---

## Resolved Tech Debt

| ID | Was | Resolution |
|----|-----|------------|
| TD-05 | Scraper embedder returned empty vectors | Sprint 1 — OpenAI batching |
| TD-06 | Landing page was placeholder | Sprint 1 — Full marketing page |
| TD-07 | refresh_token cookie not httpOnly | Sprint 1 — `Set-Cookie: HttpOnly` |

## Remaining Tech Debt

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-02 | No graceful shutdown handlers | SIGTERM handlers post-launch |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-04 | admin_audit_log.actor_id NOT NULL — scraper can't log | Seed system user |
| TD-08 | `process_document` INSERT omits `embedding` column — only `backfill_embeddings.py` populates it | Wire `_embeddings` into the chunk INSERT in scraper Step 6 |
| TD-09 | `BACKEND_PUBLIC_URL` unset in demo (OG image URL falls back to localhost:8000) | Set when AWS deploy lands |
| TD-10 | `LLMService.generate` swallows `TypeError`/`AttributeError` via broad `except Exception` (LEARNINGS L4.13) | Tighten to Anthropic exception family |
| TD-11 | Golden eval mocks LLM and never exercises `RAGService.retrieve()` (LEARNINGS L4.11) | Add fixture-DB integration eval |
| TD-12 | `pytest` not in runtime backend image; eval runs need ad-hoc `pip install` after recreate (LEARNINGS L4.12) | Split `requirements-dev.txt` |

---

## Inventory

**Backend services (11):** embedding, circular_library, rag, llm, subscription, analytics, summary, pdf_export, snippet, kg, og_image

**Backend routers (17 files, ~58 endpoints):**
- `auth.py` — register, login, verify-otp, refresh, logout
- `circulars.py` — list, search, autocomplete, detail, departments, tags, doc-types
- `questions.py` — ask (SSE+JSON), history, detail, export, feedback
- `subscriptions.py` — plans, order, verify, webhook, plan, history
- `action_items.py` — list, create, update, delete
- `saved.py` — list, create, detail, update, delete
- `snippets.py` — create, list, public get, og image, revoke (Sprint 3)
- `news.py` — list, detail (Sprint 3)
- `admin/` — dashboard, review, prompts, users, circulars, scraper, news (Sprint 3)

**Frontend (23 routes):**
- Public: `/`, `/library`, `/library/[id]`, `/login`, `/register`, `/verify`, `/s/[slug]` (Sprint 3)
- Auth: `/dashboard`, `/ask`, `/history`, `/history/[id]`, `/upgrade`, `/account`, `/action-items`, `/saved`, `/updates`
- Admin: `/admin`, `/admin/review`, `/admin/prompts`, `/admin/users`, `/admin/circulars`, `/admin/scraper`

**Infrastructure:** CI/CD (ci.yml + deploy.yml), Nginx config, Makefile, launch_check.sh, PRODUCTION_PLAN.md

---

## Architectural Decisions (Phase 2)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Analytics | PostHog (open-source) | Avoids vendor lock-in, raw data access, session replays |
| Social Sharing | Public Safe Snippets + registration gate | Prevents IP leakage, drives organic growth |
| Anti-Hallucination | 3-layer protection (injection guard → context guard → confidence scoring) | Zero tolerance for fabricated regulatory advice |
| Auth Security | HTTPOnly backend cookies | XSS-resistant refresh token management |
| KG Storage | Plain Postgres (no Neo4j) | ~100 entities fits trivially; can migrate later if depth grows |
| News Source Separation | `news_items` table, never mixed into RAG corpus | Preserves "RAG-only-from-circulars" invariant |
| KG RAG Expansion | Built but flag-gated OFF | Enable after Sprint 4 ships the Confidence Meter UI for safe rollout |
| AWS Deployment | Deferred to post-Sprint 5 | Saves ~$205/mo while features are in flux |

---

## Sprint 4 follow-up (post-merge LLM hardening)

After Sprint 4 was pushed at `f6c3a5a`, an end-to-end smoke test against `POST /api/v1/questions` with `RAG_KG_EXPANSION_ENABLED=true` exposed two preexisting demo failures (NOT Sprint 4 regressions):
- `anthropic==0.42.0` predates the `thinking={"type": "enabled"}` kwarg added in Sprint 1, so every primary LLM call was silently falling through to the OpenAI fallback (LEARNINGS L4.9).
- The local `.env` had `LLM_FALLBACK_MODEL=claude-sonnet-4-20250514`, so the OpenAI fallback then crashed with `404 model not found` (LEARNINGS L4.10).

**Fixes applied (next commit):**
- `backend/requirements.txt` → `anthropic==0.49.0`
- `backend/app/config.py` → `model_post_init` now hard-fails at startup if `LLM_FALLBACK_MODEL.startswith("claude-")`
- `.env.example` → comments spell out which LLM_* model id is consumed by which provider client
- `.env` (local, gitignored) → fallback restored to `gpt-4o`
- `LEARNINGS.md` → L4.8–L4.13 (compose recreate vs restart, SDK pin drift, LLM fallback config, eval mocking limits, pytest in runtime image, broad-except antipattern)
- `MEMORY.md` + `context.md` → TD-10/11/12 added to the Tech Debt table

**Verification:**
- Backend image rebuilt + recreated; `anthropic.__version__ == "0.49.0"`, `LLM_FALLBACK_MODEL == "gpt-4o"`, `RAG_KG_EXPANSION_ENABLED == True`
- Live `/questions` smoke test: returned `confidence_score: 0.23`, `consult_expert: true`, `model_used: "claude-sonnet-4-20250514"` (primary path, no fallback), credit deducted 5 → 4. The low score correctly triggered the consult-expert fallback, which is the intended Sprint 2 + Sprint 4 behaviour for a question that the demo's tiny corpus can't ground.
- Golden eval re-run: 28/28 PASS, 0 FAIL.

## Sprint 4 — Done (local, push pending)

1. **Confidence Meter UI** — `frontend/src/components/ui/ConfidenceMeter.tsx` (full + compact). Wired into `/ask` (live SSE), `/history/[id]` (post-API), `/history` list (compact pill). Backend persists `confidence_score` + `consult_expert` on `questions` (migration `003_sprint4_confidence.sql`).
2. **Skeleton loaders** — `frontend/src/components/ui/Skeleton.tsx` (`Skeleton`, `CardListSkeleton`). Replace `Spinner` on `/library`, `/history`, `/updates` (both tabs).
3. **Dark mode** — `tailwind.config.ts darkMode: "class"`, `frontend/src/stores/themeStore.ts`, `frontend/src/components/ThemeBootstrap.tsx`, `frontend/src/components/ThemeToggle.tsx`. Pre-hydration script in `app/layout.tsx` prevents FOUC. WCAG-AA palette in ConfidenceMeter bands.
4. **SSE jitter fix** — `/ask` buffers tokens and flushes once per animation frame; ConfidenceMeter wrapper has a stable `min-h-[1px]` container so no layout shift when the citations event arrives mid-stream.
5. **A/B UX flag scaffolding** — `frontend/src/lib/analytics.ts` (`trackEvent`), `frontend/src/hooks/useFeatureFlag.ts`. Events emitted: `ask_question_submitted`, `confidence_meter_viewed`, `dark_mode_toggled`, `share_snippet_dialog_opened`.

## Next Steps (post-Sprint-4)

1. Push to `origin/main` after user authorization.
2. Flip `RAG_KG_EXPANSION_ENABLED=true` and re-run the golden eval to verify zero regression before GA.
3. Sprint 5 — Manual PDF onboarding + semantic clustering heatmaps.

---

## Sprint Exit Checklist (codified after Sprint 3)

Before declaring any sprint complete, all four must be green:

1. **Evals re-run** — golden dataset eval at `backend/tests/evals/test_hallucination.py` must pass if the sprint touched retrieval or answer logic. Run via `docker exec regpulse-backend bash -c 'cd /app && PYTHONPATH=/app python tests/evals/test_hallucination.py'`.
2. **`LEARNINGS.md` updated** — append any new gotchas from the sprint in the standard format (what bit us → root cause → fix → prevention).
3. **All commits pushed** — `git push origin main`. Local-only commits do not count as "shipped."
4. **All five docs refreshed** — README, CLAUDE, MEMORY, spec, context all reflect the current state in the same commit batch as the feature work.
