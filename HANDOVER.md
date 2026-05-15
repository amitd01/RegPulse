# RegPulse — Session Handover

> **From:** Phase D.3 + cleanup wrap-up session (2026-05-15)
> **To:** Next session
> **Branch:** `main` — two new commits: D.3 + cleanup, then docs refresh
> **Live URLs:** [Frontend](https://regpulse-frontend-yvigu4ssea-el.a.run.app) · [Backend](https://regpulse-backend-yvigu4ssea-el.a.run.app) · [API docs](https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/docs)

---

## What shipped this session

1. **Phase D.3 — Debates API (live)**
   - `backend/app/models/debate.py` — `DebateThread` + `DebateReply` (stance enum: AGREE/DISAGREE/NEUTRAL)
   - `backend/app/schemas/debates.py` + `backend/app/routers/debates.py` — 5 endpoints: list/create thread, list/create reply, update stance
   - `backend/alembic/versions/1066cb96e57c_add_debate_models.py` — autogenerate sanitised to avoid index drop/create thrash
   - `frontend/src/hooks/useDebates.ts` — TanStack Query hooks
   - Dashboard `DebateCard` and `/debate` page migrated from `RP_DATA` mock to live persistent backend
2. **59-file cleanup pass** — formatter pass that de-wraps multi-line `mapped_column(...)` and similar declarations to fit the 100-char limit. Net: −598 / +292 lines. Behaviour-equivalent.
3. **Docs refresh** — `MEMORY.md` compacted (238 → ~165 lines), `context.md` refreshed to 2026-05-15 state, `HANDOVER.md` rewritten (this file). `CLAUDE.md`, `README.md`, `spec.md`, `LEARNINGS.md`, `DEVELOPMENT_PLAN.md`, `TECHNICAL_DOCS.md` all reflect Phase D.3.

---

## 🟢 Open this file first when you sit down

Two priorities are competing for the next session:

- **TD-13 (P0):** Scraper PDF extraction is failing. Only 10 of ~600 documents discovered in May actually landed in `circular_documents` because of "Syntax Error" + `process_document_empty_text` warnings (poppler/pdftotext). The system is "live" but stale. Without this fixed, we can't run real-data UAT or cut v1.0.0.
- **Scheduled for 2026-05-16:** Rotate OpenAI + Anthropic API keys (transcript-exposed during Phase 3B), and confirm/revoke `shubhamkadam1802@gmail.com` Editor+DevOps access.

---

## 📋 First 10 minutes — status checks

Paste these into a terminal at the repo root. Each is read-only.

### 1. Latest scraper execution + state
```bash
gcloud run jobs executions list --job=regpulse-scraper --region=asia-south1 --limit=3 --format='table(name,status.startTime,status.completionTime,status.runningCount,status.succeededCount,status.failedCount)'
gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=regpulse-scraper' --limit=50 --freshness=24h --format='value(timestamp,severity,jsonPayload.event,jsonPayload.message,textPayload)'
```
**Check for:** `process_document_empty_text` and `Syntax Error` lines (those are the TD-13 signal).

### 2. Cloud SQL — circulars actually present?
```bash
curl -s https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/circulars | python3 -m json.tool | head -30
# OR direct via proxy:
cloud-sql-proxy --port=5433 regpulse-495309:asia-south1:regpulse-db &
PROXY=$!; sleep 5
PGPASSWORD=$(cat /tmp/regpulse_db_pw) psql -h localhost -p 5433 -U postgres -d regpulse -c "SELECT count(*) AS circulars, max(indexed_at) AS latest FROM circular_documents;"
PGPASSWORD=$(cat /tmp/regpulse_db_pw) psql -h localhost -p 5433 -U postgres -d regpulse -c "SELECT count(*) AS chunks FROM document_chunks;"
kill $PROXY
```
**Expected (today):** circulars ≈ 10 (TD-13 not yet fixed). Once TD-13 lands, count should climb past 500.

### 3. Backend health + error rate
```bash
curl -s -o /dev/null -w "Health: HTTP %{http_code} in %{time_total}s\n" https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/health
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=regpulse-backend AND severity>=ERROR' --limit=50 --freshness=6h --format='value(timestamp,jsonPayload.event,jsonPayload.message,textPayload)'
gcloud run services describe regpulse-backend --region=asia-south1 --format='value(status.url,status.traffic[].revisionName,status.traffic[].percent)'
```

### 4. Debates API smoke (D.3 just landed)
```bash
# Should return [] until someone creates a thread
curl -s https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/debates -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### 5. Scheduler enabled?
```bash
gcloud scheduler jobs describe regpulse-scraper-daily --location=asia-south1 --format='table(state,schedule,timeZone,scheduleTime,lastAttemptTime)'
```

### 6. Budget check
```bash
gcloud billing budgets list --billing-account=0130B1-10E7BB-34EF9C --filter='displayName:"RegPulse monthly cap"' --format='value(displayName,amount.specifiedAmount.units,thresholdRules[].thresholdPercent)'
```

---

## 🔧 TD-13 — Scraper PDF extraction (next session's main task)

**Symptom:** ~600 documents discovered per scraper run, only 10 stored. Logs dominated by:
- `WARNING: Syntax Error` (from poppler/pdftotext)
- `process_document_empty_text` events (text extraction returned empty string)

**Hypothesis ranking:**
1. **`poppler-utils` not installed** in `scraper/Dockerfile`, or installed without the right backend libraries. Verify with `gcloud run jobs executions describe ... --format=...` and `pdftotext --version` in the container.
2. **Subset of RBI PDFs are scanned image-only** — extraction returns empty string regardless of poppler. Fix: detect empty extraction → fall back to OCR (e.g., `pdf2image + pytesseract`) OR mark `extraction_status='empty'` and surface to admin queue.
3. **Specific syntax errors** in particular PDFs we should ignore rather than fail the whole job.

**Suggested approach:**
- Pull a few of the failing URLs from logs
- Reproduce locally: `docker compose exec scraper pdftotext /tmp/sample.pdf - | head`
- Decide between (a) Dockerfile fix (re-add `poppler-utils` + `tesseract-ocr` + `pdf2image`), (b) graceful skip + admin-queue fallback, or (c) both
- Add a unit test in `scraper/tests/` that runs the extractor against a known-bad PDF
- Re-run scraper, verify count climbs

---

## 🌐 What's live

| Resource | Identifier | Notes |
|---|---|---|
| **Project** | `regpulse-495309` | asia-south1, billing `0130B1-10E7BB-34EF9C` |
| **Cloud SQL** | `regpulse-db` | Postgres 16 Enterprise HA, public+private IP, 21 tables, no ANN indexes (pgvector 2000-dim cap — see LEARNINGS LGCP.5) |
| **Memorystore Redis** | `regpulse-redis` | Basic 1GB, private `10.45.36.187:6379`, AUTH enabled |
| **VPC Connector** | `regpulse-connector` | /28 at `10.8.0.0/28` |
| **Artifact Registry** | `asia-south1-docker.pkg.dev/regpulse-495309/regpulse` | `backend:rc2`, `frontend:rc1`, `scraper:rc1` |
| **Secret Manager** | 13 × `REGPULSE_*` | API keys + DB/Redis creds + JWT pem files |
| **Runtime SA** | `regpulse-runtime@regpulse-495309.iam.gserviceaccount.com` | secretAccessor, cloudsql.client, run.invoker, logWriter, metricWriter |
| **Backend** | `regpulse-backend` rev 00004 | `min-instances=1` |
| **Frontend** | `regpulse-frontend` rev 00001 | `min-instances=1` |
| **Scraper Job** | `regpulse-scraper` | 2 vCPU, 2Gi, 1h timeout, eager-mode one-shot |
| **Scheduler** | `regpulse-scraper-daily` | `30 20 * * *` UTC (= 02:00 IST) |
| **Observability** | Cloud Monitoring dashboard "RegPulse Scraper Observability" | log-based metrics for processed docs, errors, success |

**Mode:** `ENVIRONMENT=staging, DEMO_MODE=true, FREE_CREDIT_GRANT=999999`. OTP fixed `123456`. Payments/SMTP disabled.

---

## ⚠️ Backlog (deferred)

| Phase | Work | Why deferred |
|---|---|---|
| **TD-13** | Scraper PDF extraction fix | **Top priority, see above** |
| 4H | Celery worker on GCE (`e2-small`) | Only needed when leaving DEMO_MODE (auto-renewal, low-credit emails, RSS news ingest, question clustering all need it). 1–1.5 hr. |
| 5 | Custom domain + TLS (`regpulse.in` / `api.regpulse.in`) | Needs domain ownership + DNS access. 30 min active + provisioning wait. |
| 6 | GitHub Actions auto-deploy via WIF | Removes laptop-`gcloud builds submit` dependency. 1.5–2 hr. |
| D | ANN-index recovery for vector search | Symptom shows once `document_chunks` > ~1000. Options: (1) `halfvec(3072)` migration (cleanest), (2) wait for Cloud SQL pgvector 0.7+, (3) downgrade to `text-embedding-3-small` (quality regression). |
| Sprint 9 | G-10 circuit breaker (`pybreaker`) | LLM fallback today is naive try/catch. |
| Sprint 9 | OP-2 wire `PromptVersion.prompt_text` through `LLMService` | Admin sandbox doesn't actually swap prompts at LLM call time. |

---

## 🗺️ Where things live

| Need | Path |
|---|---|
| Run any GCP-deploy step | `scripts/gcp/phase{N}*.sh` |
| Full deploy state + checklist | `GCP_DEPLOY_RUNBOOK.md` |
| Production architecture spec | `PRODUCTION_PLAN.md` |
| Codebase invariants + business rules | `MEMORY.md` |
| Phase 2 gotchas | `LEARNINGS.md` § Sprint 1–8 |
| GCP deploy gotchas | `LEARNINGS.md` § LGCP.1–LGCP.6 |
| Product features (PRD v4) | `RegPulse_PRD_v4.md` |
| Backend code | `backend/app/` (FastAPI), `backend/migrations/` (raw SQL), `backend/alembic/` (Phase D models) |
| Scraper code | `scraper/` (sync Celery + one-shot wrapper) |
| Frontend code | `frontend/src/` (Next.js 14, terminal-modern v2) |
| Cloud SQL root password (temp) | `/tmp/regpulse_db_pw` on laptop (also in Secret Manager) |
| Cloud Run logs | `gcloud logging read 'resource.type=cloud_run_revision'` |
| Cloud Run Job logs | `gcloud logging read 'resource.type=cloud_run_job'` |

---

## 🚪 To resume cold (no context from this session)

1. `git pull origin main`
2. Read `GCP_DEPLOY_RUNBOOK.md` § "Status"
3. Read this file's "First 10 minutes"
4. Read `LEARNINGS.md` § LGCP.1–LGCP.6 (deploy gotchas)
5. Skim `MEMORY.md` § "GCP Deployment State"

That's enough to be productive. The full deploy is captured in `scripts/gcp/`.
