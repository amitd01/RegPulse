# RegPulse — Project Status

> **All 50 prompts complete. Localhost demo running. Awaiting feedback before next dev cycle.**

---

## Current State (2026-03-27)

- **Branch:** `main` (all PRs merged, local has demo deployment patches)
- **Phase:** Localhost demo trial — collecting user feedback
- **Backend tests:** 64/64 passing
- **Frontend:** 22 routes, tsc clean, eslint clean, build clean
- **Docker:** 6 containers running (postgres, redis, backend, frontend, scraper, celery-beat)

---

## Localhost Demo Deployment

**Started:** 2026-03-27

**Changes made for demo (not yet committed):**

| File | Change |
|------|--------|
| `backend/app/services/otp_service.py` | DEMO_MODE: fixed OTP "123456" |
| `backend/app/routers/auth.py` | DEMO_MODE: skip email validation + sending |
| `backend/app/services/llm_service.py` | Extended thinking (10k budget), skip thinking blocks in stream |
| `backend/app/main.py` | DEMO_MODE: skip cross-encoder download |
| `backend/app/config.py` | PEM newline expansion validator for JWT keys |
| `frontend/src/stores/authStore.ts` | Set/clear `refresh_token` cookie on auth state change |
| `docker-compose.yml` | 1 worker, init SQL mount, scraper queue fix, PYTHONPATH |
| `scraper/Dockerfile` | Fixed module path (`/scraper/` workdir) |
| `backend/migrations/001_initial_schema.sql` | Added missing `password_changed_at` column |
| `backend/scripts/backfill_embeddings.py` | New script: backfill OpenAI embeddings for scraper chunks |
| `.env` | Created with real API keys, dummy Razorpay/SMTP, DEMO_MODE=true |
| `frontend/public/` | Created empty directory (Docker build requires it) |
| `PRODUCTION_PLAN.md` | New: AWS deployment roadmap |

**Known issues found during demo:**
1. Scraper embedder is a stub — chunks indexed without embeddings; requires manual backfill
2. `password_changed_at` column missing from SQL schema (ORM expects it)
3. `refresh_token` cookie was never set — middleware redirected all protected routes to `/login`
4. Cross-encoder download hangs in Docker for Mac (HuggingFace SSL timeout)
5. Celery scraper tasks routed to `scraper` queue but worker only consumed `celery` queue
6. OTP rate limit (3/hour) too low for testing
7. Landing page (`/`) is bare placeholder — no navigation to login/register
8. `.env` multiline PEM keys break Docker's env parser (fixed with `\n` encoding)
9. `ADMIN_EMAIL_ALLOWLIST` needs JSON format for pydantic-settings v2

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

## Git History (main)

```
fc03e8e  fix: response_model=None for POST /questions (#8)
316ddd3  Prompts 37–50 — Dashboard, admin UI, analytics, PDF export, CI/CD (#7)
5b388b4  Prompts 15–36 — Library, RAG Q&A, Subscriptions, Admin (#6)
43e4a02  Prompt 14b — docs update (#5)
2539301  Prompts 11–14 — Auth (Sprint 3)
6c242a9  Jira CLI
91393f0  Prompts 01–10 — Infrastructure + Scraper
```

**Uncommitted:** Demo deployment patches (listed above). To be committed after feedback review.

---

## Phase 2 Strategy & Architecture Decisions (Post-Demo)

The project is entering **Phase 2**, prioritizing anti-hallucination accuracy, scalability, and UX polish. 

### Key Architectural Choices Documented
1. **Analytics Engine:** **PostHog** chosen over Mixpanel/Amplitude. Rationale: Open-source, avoids lock-in, allows extensive raw data analysis and session replays which is critical for UX evaluations.
2. **Social Sharing Strategy:** Social links (LinkedIn/X) will expose a **"Public Safe Snippet"** of the answer, preventing enterprise IP leakage while still driving organic growth via a "Register for more" gating prompt.
3. **Anti-Hallucination Mandate:** The LLM constraint is absolute. It must gracefully fallback to "Consult an expert" instead of generating hypotheticals or extrapolating beyond explicit circular retrieval chunks.

### Multi-Sprint Execution Plan
**(We are currently starting Sprint 1)**
1. **Sprint 1 (Hardening & Tracking):** PostHog integration, HTTPOnly JWT refactor, direct OpenAI Embedder fix in Celery, and a proper Marketing Landing Page (`/`).
2. **Sprint 2 (Zero-Hallucination & Cloud):** LLM prompt/constraint tightening, automated LLM-as-a-judge CI pipeline (golden dataset check), and AWS deployment.
3. **Sprint 3 (Brain & Social):** Knowledge Graph for entity relations, RSS/News ingestion to track market events, and public social sharing routes.
4. **Sprint 4 (Premium UI):** Skeleton loaders, Dark mode contrast optimizations, and streaming citation jitter fixes.
5. **Sprint 5 (Admin Analytics):** Manual PDF upload console, BERTopic usage semantic clustering, and admin heatmaps.
