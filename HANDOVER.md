# RegPulse — Session Handover

> **From:** Wrap-up session 2026-05-15 (mixed Claude Code + Antigravity work)
> **To:** Next session
> **Branch:** `main` — pushed to `origin/main`
> **Live URLs:** [Frontend](https://regpulse-frontend-yvigu4ssea-el.a.run.app) · [Backend](https://regpulse-backend-yvigu4ssea-el.a.run.app) · [API docs](https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/docs)

---

## 🟢 Open this file first when you sit down

Two things to know upfront:

1. **The demo is live but stale.** GCP backend + frontend serve cleanly. The scraper container fix landed in `aed8425` and the daily job runs. BUT PDF extraction is failing for ~99% of May circulars — only 10 from April 13 are actually in the DB. **This is the top blocker** (SCR-1). Until it's fixed, every Q&A in the demo will fall back to "Consult an Expert."
2. **Phase D is done.** D.1 (Pulse Dashboard API), D.2 (Team Learnings API), and D.3 (Debates API) all shipped and wired into the v2 frontend. Live persistent backend, no more mocks.

---

## 📋 First 10 minutes — status checks

Paste these into a terminal at the repo root. Each is read-only.

### 1. Scraper job — has it run again, and is extraction still broken?

```bash
# Most recent executions
gcloud run jobs executions list --job=regpulse-scraper --region=asia-south1 --limit=5 --format='table(name,status.startTime,status.completionTime,status.succeededCount,status.failedCount)'

# How many circulars actually landed?
curl -s https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/circulars | python3 -m json.tool | head -10

# What's the extraction error rate?
gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=regpulse-scraper AND (textPayload=~"Syntax Error" OR textPayload=~"process_document_empty_text")' --limit=20 --freshness=24h --format='value(timestamp,textPayload)'
```

**Expected:** still seeing `Syntax Error` from poppler/pdftotext and `process_document_empty_text` warnings. Until that's fixed, `circulars` count won't grow.

### 2. Backend + frontend health

```bash
curl -s -o /dev/null -w "Backend:  HTTP %{http_code} in %{time_total}s\n" https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/health
curl -s -o /dev/null -w "Frontend: HTTP %{http_code} in %{time_total}s\n" https://regpulse-frontend-yvigu4ssea-el.a.run.app/
gcloud run services describe regpulse-backend --region=asia-south1 --format='value(status.url,status.traffic[].revisionName,status.traffic[].percent)'
```

### 3. Scheduler + budget

```bash
gcloud scheduler jobs describe regpulse-scraper-daily --location=asia-south1 --format='table(state,schedule,timeZone,scheduleTime,lastAttemptTime)'
gcloud billing budgets list --billing-account=0130B1-10E7BB-34EF9C --filter='displayName:"RegPulse monthly cap"' --format='value(displayName,amount.specifiedAmount.units,thresholdRules[].thresholdPercent)'
```

### 4. Git baseline

```bash
git -C /Users/amitdas/claude/Repos/RegPulse status --short
git -C /Users/amitdas/claude/Repos/RegPulse log --oneline -10
git -C /Users/amitdas/claude/Repos/RegPulse status -sb
```

**Expected:** clean working tree, `main` up to date with `origin/main`. If you see uncommitted changes, that's another Antigravity session having edited files between sessions — check what's there before committing.

---

## 🌐 What's live (one-screen summary)

| Resource | Identifier | Notes |
|---|---|---|
| **Project** | `regpulse-495309` | asia-south1, billing `0130B1-10E7BB-34EF9C` |
| **Cloud SQL** | `regpulse-db` | Postgres 16 Enterprise, HA, public IP `34.100.234.6` + private `10.81.0.2`, 21 tables, no ANN indexes (pgvector 2000-dim cap) |
| **Memorystore Redis** | `regpulse-redis` | Basic 1GB, private `10.45.36.187:6379`, AUTH enabled |
| **VPC Connector** | `regpulse-connector` | /28 at `10.8.0.0/28`, attached to default VPC |
| **Artifact Registry** | `asia-south1-docker.pkg.dev/regpulse-495309/regpulse` | `backend:rc2`, `frontend:rc1`, `scraper:rc1` (with WORKDIR fix) |
| **Secret Manager** | 13 × `REGPULSE_*` | API keys + DB/Redis creds + JWT pem files |
| **Runtime SA** | `regpulse-runtime@regpulse-495309.iam.gserviceaccount.com` | secretAccessor, cloudsql.client, run.invoker, logWriter, metricWriter |
| **Backend** | Cloud Run `regpulse-backend` rev 00004 | live |
| **Frontend** | Cloud Run `regpulse-frontend` rev 00001 | live |
| **Scraper Job** | Cloud Run Job `regpulse-scraper` | 2 vCPU, 2Gi, 1h timeout, eager-mode one-shot |
| **Scheduler** | `regpulse-scraper-daily` | `30 20 * * *` UTC (= 02:00 IST) |
| **Observability** | Cloud Monitoring "RegPulse Scraper Observability" | log-based metrics for documents/errors/success |

**Mode:** `ENVIRONMENT=staging, DEMO_MODE=true, FREE_CREDIT_GRANT=999999`. OTP fixed `123456`. Payments/SMTP disabled.

---

## ⚠️  Open items going into the next session

| # | What | Severity | Where |
|---|---|---|---|
| **0** | **SCR-1 — scraper PDF extraction failing on ~99% of May circulars** | 🔥 **Top priority** | Debug `scraper/extractor/pdf_extractor.py` against failing URLs from Cloud Run Job logs. Verify poppler-utils install in container. May need ocr fallback for "Syntax Error" PDFs. |
| 1 | Rotate OpenAI + Anthropic API keys (transcript-exposed during Phase 3B) | **High** | 🗓️  Scheduled 2026-05-16. Revoke at console.anthropic.com + platform.openai.com → `export OPENAI_KEY=… ANTHROPIC_KEY=… && bash scripts/gcp/phase3b_external_secrets.sh`. |
| 2 | Confirm / revoke `shubhamkadam1802@gmail.com` Editor+DevOps access | **Medium** | 🗓️  Scheduled 2026-05-16. Ask IT; if not Think360 → `gcloud projects remove-iam-policy-binding regpulse-495309 --member="user:shubhamkadam1802@gmail.com" --role="roles/editor"` (and `roles/iam.devOps`). |
| 3 | UAT audit blocker: headless agent fails OTP flow with 422/400 | Medium | Investigate `auth/otp` strict session/validation that blocks headless browsers. May need a "service test account" path that bypasses the strict checks in `DEMO_MODE`. |

---

## 🛠️  Suggested next dev activities (ranked)

### A. **SCR-1 fix — PDF extraction** *(do this first)*
- Grab 5–10 failing URLs from scraper logs (`textPayload=~"Syntax Error"`).
- Reproduce locally inside the scraper container with `pdftotext` against each URL.
- Diagnose: corrupted PDFs / encrypted PDFs / wrong content-type / missing fonts.
- Likely fix paths: (i) catch poppler errors and fall back to `pytesseract` OCR; (ii) skip and mark `scraper_runs.failed += 1` with reason; (iii) pre-validate PDF magic bytes before extraction.
- Estimated time: 1–2 hr.

### B. Phase 5 — Custom domain + TLS
- `gcloud beta run domain-mappings create --service=regpulse-frontend --domain=regpulse.in --region=asia-south1` + `--service=regpulse-backend --domain=api.regpulse.in`
- Update DNS at registrar with CNAME/A records GCP returns.
- Wait ~15–60 min for Google-managed SSL.
- Update `FRONTEND_URL` + `BACKEND_PUBLIC_URL` envs, rebuild frontend with new `NEXT_PUBLIC_API_URL`.
- Estimated time: 30 min + provisioning wait.

### C. Phase 6 — GitHub Actions auto-deploy via WIF
- Configure WIF pool + provider on the project.
- Bind GitHub repo identity (`amitd01/RegPulse`) to impersonate a deploy SA (`run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`).
- Wire `.github/workflows/deploy.yml` (stubbed) to fire on `v*` tags.
- Estimated time: 1.5–2 hr.

### D. ANN-index recovery for vector search
- Symptoms today: every RAG question does a seq-scan over `document_chunks.embedding` — fine for <500 chunks, slow at 5000+. Currently irrelevant because SCR-1 keeps the corpus small.
- Options when needed: (1) `halfvec(3072)` migration for ivfflat up to 4000 dims; (2) wait for Cloud SQL pgvector 0.7+; (3) downgrade to `text-embedding-3-small` (quality regression, not recommended).

### E. Phase 7 — Final smoke tests + v1.0.0 tag
- Only after SCR-1 fix + Phase 5 domain mapping.
- Run full UAT against GCP staging, tag `v1.0.0`, cut release.

---

## 🗺️  Where things live

| Need | Path |
|---|---|
| Run any GCP-deploy step | `scripts/gcp/phase{N}*.sh` |
| Full deploy state + checklist | `GCP_DEPLOY_RUNBOOK.md` |
| Production architecture spec | `PRODUCTION_PLAN.md` |
| Codebase invariants + business rules | `MEMORY.md` |
| Phase 2 gotchas | `LEARNINGS.md` § Sprint 1–8 |
| GCP deploy gotchas | `LEARNINGS.md` § LGCP.1–LGCP.6 |
| What product features exist | `RegPulse_PRD_v4.md` / `RegPulse_FSD_v4.md` |
| Backend code | `backend/app/` (FastAPI), `backend/migrations/` (SQL), `backend/alembic/versions/` (model migrations) |
| Scraper code | `scraper/` (sync Celery + one-shot wrapper) |
| Frontend code | `frontend/src/` (Next.js 14, terminal-modern v2) |
| Cloud SQL root password | `/tmp/regpulse_db_pw` on the laptop (also versioned in Secret Manager) |
| Cloud Run logs | `gcloud logging read 'resource.type=cloud_run_revision'` |
| Cloud Run Job logs | `gcloud logging read 'resource.type=cloud_run_job'` |

---

## 🚪 To resume cold (no context from this session)

1. `git pull origin main`
2. Read `MEMORY.md` (compact) for invariants and current GCP state
3. Read this file's "First 10 minutes" — run the diagnostic commands
4. Read `LEARNINGS.md` § LGCP.1–LGCP.6 — GCP deploy gotchas
5. Start on SCR-1 (PDF extraction debugging) — it's the only thing blocking real-data demos

That's enough to be productive.

---

## ✅ This session's deliverables

- Phase D.3 Debates API committed + pushed (models, routers, schemas, Alembic migration, `useDebates` hook)
- 59-file working-tree cleanup pass committed + pushed (`+292 / −598`, mostly import + boilerplate simplification)
- MEMORY.md compacted to ~190 lines (under 200-line cap), Phase 2 sprint detail moved to `DEVELOPMENT_PLAN.md`, SCR-1 added to open tech debt
- context.md refreshed from 2026-04-22 to 2026-05-15 reality
- HANDOVER.md (this file) regenerated for next session
