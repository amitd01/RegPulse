# RegPulse — Project Status

> **All 50 prompts + Sprint 1 & 2 complete. Paused before Sprint 3.**

---

## Current State (2026-04-11)

- **Branch:** `main` (all changes merged and pushed)
- **Phase:** Phase 2 — Sprint 1 & 2 complete, Sprint 3 planned
- **Backend tests:** 64 unit + 30 hallucination eval tests
- **Frontend:** 22 routes, tsc clean, eslint clean, build clean
- **Docker:** 6 containers running (postgres, redis, backend, frontend, scraper, celery-beat)
- **Load tests:** k6 (3 scenarios: smoke, load, spike)

---

## Git History (main)

```
1858575  feat(sprint-2): anti-hallucination guardrails, golden dataset, and load tests
363b1ef  feat(sprint-1): security hardening, analytics, embedder, and landing page
8c79f8c  docs: final update — all 5 docs reflect complete project state (50/50 prompts) (#9)
fc03e8e  fix: response_model=None for POST /questions (#8)
316ddd3  Prompts 37–50 — Dashboard, admin UI, analytics, PDF export, CI/CD (#7)
5b388b4  Prompts 15–36 — Library, RAG Q&A, Subscriptions, Admin (#6)
43e4a02  Prompt 14b — docs update (#5)
2539301  Prompts 11–14 — Auth (Sprint 3)
91393f0  Prompts 01–10 — Infrastructure + Scraper
```

---

## Sprint 1 Changes (commit `363b1ef`)

| File | Change |
|------|--------|
| `backend/app/routers/auth.py` | HTTPOnly cookie lifecycle (set/read/clear refresh_token) |
| `backend/app/config.py` | PEM newline expansion, cookie domain config |
| `backend/app/main.py` | DEMO_MODE cross-encoder skip |
| `frontend/src/stores/authStore.ts` | Removed client-side cookie handling, 2-arg `setAuth(user, accessToken)` |
| `frontend/src/lib/api.ts` | `withCredentials: true` for cookie auto-send |
| `frontend/src/app/page.tsx` | Full marketing landing page (navy hero, feature cards, footer) |
| `frontend/src/providers/PostHogProvider.tsx` | PostHog analytics integration |
| `frontend/src/components/PostHogPageView.tsx` | Client-side pageview tracking |
| `scraper/processor/embedder.py` | Stub → OpenAI `text-embedding-3-large` with batching |
| `.env.example` | PostHog env vars added |
| `PRODUCTION_PLAN.md` | AWS deployment roadmap |

## Sprint 2 Changes (commit `1858575`)

| File | Change |
|------|--------|
| `backend/app/services/llm_service.py` | Confidence scoring, "Consult Expert" fallback, hardened system prompt (8 rules) |
| `backend/tests/evals/golden_dataset.json` | 30 synthetic test cases (12 factual, 3 multi-circular, 8 OOS, 5 injection) |
| `backend/tests/evals/test_hallucination.py` | Evaluation pipeline: confidence, citations, injection, golden dataset structure |
| `backend/tests/evals/conftest.py` | Lightweight test setup for eval-only runs |
| `tests/load/k6_load_test.js` | Load test: smoke (1 VU), load (20 VU ramp), spike (50 VU burst) |

---

## Resolved Tech Debt (from Sprint 1)

| ID | Was | Resolution |
|----|-----|------------|
| TD-05 | Scraper embedder returned empty vectors | Uses OpenAI `text-embedding-3-large` with batching |
| TD-06 | Landing page was bare placeholder | Full marketing landing page with hero, features, footer |
| TD-07 | `refresh_token` cookie not httpOnly | Backend `Set-Cookie: HttpOnly; Secure; SameSite=lax` |

## Remaining Tech Debt

| ID | Issue | Plan |
|---|---|---|
| TD-01 | Scraper writes directly to backend DB | API isolation in v2 |
| TD-02 | No graceful shutdown handlers | SIGTERM handlers post-launch |
| TD-03 | Manual api.ts client | OpenAPI codegen in v1.1 |
| TD-04 | admin_audit_log.actor_id NOT NULL | Seed system user |

---

## Inventory

**Backend services (8):** embedding, circular_library, rag, llm, subscription, analytics, summary, pdf_export

**Backend routers (14 files, 48 endpoints):**
- `auth.py` — register, login, verify-otp, refresh, logout
- `circulars.py` — list, search, autocomplete, detail, departments, tags, doc-types
- `questions.py` — ask (SSE+JSON), history, detail, export, feedback
- `subscriptions.py` — plans, order, verify, webhook, plan, history
- `action_items.py` — list, create, update, delete
- `saved.py` — list, create, detail, update, delete
- `admin/` — dashboard, review (3), prompts (3), users (2), circulars (3), scraper (2)

**Frontend (22 routes):**
- Public: `/`, `/library`, `/library/[id]`, `/login`, `/register`, `/verify`
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
| AWS Deployment | Deferred to post-Sprint 3 | Saves ~$205/mo while features are in flux |
| Golden Dataset | Synthetic for dev phase | Enables adversarial test cases without live API costs |
| Load Testing | Local Docker Compose | Zero cost, reproducible, same k6 scripts work on AWS later |

---

## Next Steps (Sprint 3 — when resumed)

1. Knowledge Graph service for cross-circular references
2. RSS/News ingestion pipeline for market-event awareness
3. LinkedIn/X social sharing buttons on Q&A history
4. Public share page (`/share/[id]`) with safe snippet + registration CTA
5. Social proof section on landing page
