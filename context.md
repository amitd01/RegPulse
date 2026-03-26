# RegPulse — Project Status

> **All 50 prompts complete. Project v0.1.0 ready.**

---

## Final Verified State (2026-03-26)

- **Branch:** `main` (all PRs merged)
- **Backend tests:** 64/64 passing
- **Frontend:** 22 routes, tsc clean, eslint clean, build clean
- **App startup:** 48 endpoints registered, schemas validated
- **Import boundaries:** no scraper/backend cross-imports, no PII in LLM
- **Dry run:** 20/20 simulated E2E checks passed

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

**Infrastructure:** CI/CD (ci.yml + deploy.yml), Nginx config, Makefile, launch_check.sh

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
