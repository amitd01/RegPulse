# RegPulse — Session Handover

> **From:** GCP first-deploy session (2026-05-14)
> **To:** Next session
> **Branch:** `main` @ `83b10a9`
> **Live URLs:** [Frontend](https://regpulse-frontend-yvigu4ssea-el.a.run.app) · [Backend](https://regpulse-backend-yvigu4ssea-el.a.run.app) · [API docs](https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/docs)

---

## 🟢 Open this file first when you sit down

The MVP is live on GCP in DEMO_MODE. A scraper Cloud Run Job was kicked off at the end of last session and is still running (or finished by now). **First thing to do: check whether the scrape finished and whether circulars landed in Cloud SQL.** Commands in the next section.

If the scrape succeeded, the demo has real RBI circulars and you can ask questions end-to-end. If it failed, we'll have to read logs and decide whether to retry or shorten scope.

---

## 📋 First 10 minutes — status checks

Paste these into a terminal at the repo root. Each is read-only.

### 1. Scraper job — did the first scrape finish?

```bash
# Most recent execution + state
gcloud run jobs executions list --job=regpulse-scraper --region=asia-south1 --limit=3 --format='table(name,status.startTime,status.completionTime,status.runningCount,status.succeededCount,status.failedCount)'

# Live tail of scraper logs (last 50 events, last 2h)
gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=regpulse-scraper' --limit=50 --freshness=2h --format='value(timestamp,severity,jsonPayload.event,jsonPayload.message,textPayload)'
```

**Expected good state**: latest execution `succeededCount=1, failedCount=0`. Logs end with `oneshot_done mode=daily` and a `daily_scrape_completed new_documents=N` event.
**If still running**: leave it. Daily scrape can take 30–90 min for the full RBI crawl.
**If failed**: read the last 100 log lines, look for stack traces. Most likely failure modes: (a) Cloud SQL connection (verify VPC connector still attached), (b) OpenAI rate limit on embeddings (~3072-dim × hundreds of chunks), (c) Anthropic rate limit on summaries.

### 2. Cloud SQL — did circulars actually land?

```bash
# Public API hit (no auth needed for list)
curl -s https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/circulars | python3 -m json.tool | head -30

# OR via Cloud SQL Auth Proxy (more direct)
cloud-sql-proxy --port=5433 regpulse-495309:asia-south1:regpulse-db &
PROXY=$!
sleep 5
PGPASSWORD=$(cat /tmp/regpulse_db_pw) psql -h localhost -p 5433 -U postgres -d regpulse -c "SELECT count(*) AS circulars, max(indexed_at) AS latest FROM circular_documents;"
PGPASSWORD=$(cat /tmp/regpulse_db_pw) psql -h localhost -p 5433 -U postgres -d regpulse -c "SELECT count(*) AS chunks FROM document_chunks;"
kill $PROXY
```

**Expected**: count > 0, chunks > 0, `latest` recent. If empty even though the scraper succeeded, the eager-mode pipeline may not have committed — check `scraper_runs` table for the run's final status.

### 3. Backend health + live error rate

```bash
curl -s -o /dev/null -w "Health: HTTP %{http_code} in %{time_total}s\n" https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/health

# Last 50 backend errors (filtered)
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=regpulse-backend AND severity>=ERROR' --limit=50 --freshness=6h --format='value(timestamp,jsonPayload.event,jsonPayload.message,textPayload)'

# Backend revision currently serving traffic
gcloud run services describe regpulse-backend --region=asia-south1 --format='value(status.url,status.traffic[].revisionName,status.traffic[].percent)'
```

### 4. Frontend serving check

```bash
curl -s -o /dev/null -w "Frontend: HTTP %{http_code} in %{time_total}s\n" https://regpulse-frontend-yvigu4ssea-el.a.run.app/

# Confirm Next.js bundle baked the right API URL
curl -s https://regpulse-frontend-yvigu4ssea-el.a.run.app/ | grep -oE 'regpulse-backend-[a-z0-9-]+\.run\.app' | head -1
```

Should match the backend URL exactly. If it shows `localhost:8000` or a placeholder, the frontend was built against the wrong env — rebuild with `bash scripts/gcp/phase4f_build_frontend.sh` and redeploy.

### 5. Scheduler — daily trigger configured?

```bash
gcloud scheduler jobs describe regpulse-scraper-daily --location=asia-south1 --format='table(state,schedule,timeZone,scheduleTime,lastAttemptTime)'
```

`state=ENABLED`, next `scheduleTime` is upcoming. If `state=DISABLED`, re-enable: `gcloud scheduler jobs resume regpulse-scraper-daily --location=asia-south1`.

### 6. Budget — anything anomalous?

```bash
gcloud billing budgets list --billing-account=0130B1-10E7BB-34EF9C --filter='displayName:"RegPulse monthly cap"' --format='value(displayName,amount.specifiedAmount.units,thresholdRules[].thresholdPercent)'
```

---

## 🌐 What's live (one-screen summary)

| Resource | Identifier | Notes |
|---|---|---|
| **Project** | `regpulse-495309` | asia-south1, billing `0130B1-10E7BB-34EF9C` |
| **Cloud SQL** | `regpulse-db` | Postgres 16 Enterprise, HA, public IP `34.100.234.6` + private `10.81.0.2`, db `regpulse`, 19 tables, no ANN indexes (pgvector 2000-dim cap) |
| **Memorystore Redis** | `regpulse-redis` | Basic 1GB, private `10.45.36.187:6379`, AUTH enabled |
| **VPC Connector** | `regpulse-connector` | /28 at `10.8.0.0/28`, attached to default VPC |
| **Artifact Registry** | `asia-south1-docker.pkg.dev/regpulse-495309/regpulse` | Repo holding `backend:rc2`, `frontend:rc1`, `scraper:rc1` |
| **Secret Manager** | 13 × `REGPULSE_*` | API keys + DB/Redis creds + JWT pem files |
| **Runtime SA** | `regpulse-runtime@regpulse-495309.iam.gserviceaccount.com` | secretAccessor, cloudsql.client, run.invoker, logWriter, metricWriter |
| **Backend** | Cloud Run `regpulse-backend` rev 00004 | `https://regpulse-backend-yvigu4ssea-el.a.run.app` |
| **Frontend** | Cloud Run `regpulse-frontend` rev 00001 | `https://regpulse-frontend-yvigu4ssea-el.a.run.app` |
| **Scraper Job** | Cloud Run Job `regpulse-scraper` | 2 vCPU, 2Gi, 1h timeout, eager-mode one-shot |
| **Scheduler** | `regpulse-scraper-daily` | `30 20 * * *` UTC (= 02:00 IST) |

**Mode**: `ENVIRONMENT=staging, DEMO_MODE=true, FREE_CREDIT_GRANT=999999`. OTP fixed `123456`. Payments/SMTP disabled (placeholders).

**Resource labels on every service**: `app=regpulse,env=production,owner=amit,managed-by=manual`.

---

## ⚠️ Three things still pending from last session

| # | What | Severity | How to do it |
|---|---|---|---|
| **1** | Rotate OpenAI + Anthropic API keys (they were pasted into chat — transcript-exposed) | **High** | 🗓️ **Deferred to 2026-05-16**: Revoke at console.anthropic.com and platform.openai.com → generate fresh → `export OPENAI_KEY=… ANTHROPIC_KEY=… && bash scripts/gcp/phase3b_external_secrets.sh`. Cloud Run picks up new versions automatically. |
| **2** | Confirm or revoke `shubhamkadam1802@gmail.com` Editor+DevOps access | **Medium** | 🗓️ **Deferred to 2026-05-16**: Ask IT who they are. If not Think360 → `gcloud projects remove-iam-policy-binding regpulse-495309 --member="user:shubhamkadam1802@gmail.com" --role="roles/editor"` (and same for `roles/iam.devOps`). |
| **3** | Check the in-flight scraper execution finished cleanly | ✅ **Done** | The initial scraper run failed with a `ModuleNotFoundError`. This was fixed by updating `WORKDIR /app` in `scraper/Dockerfile`. The scraper is now successfully running, and a real-time Cloud Monitoring Dashboard ("RegPulse Scraper Observability") was deployed. |
| **4** | Phase D (V2 Frontend Integration) Backend completion | 🔄 **In Progress** | Completed Phase D.1 (Dashboard API) and Phase D.2 (Team Learnings API) backend logic, Alembic migrations, and frontend TanStack Query wiring. Next up: Phase D.3 (Debates API). |

---

## 🛠️ Suggested next dev activities (ranked)

Pick one to start the session — don't multi-task.

### A. Phase 4H — Celery worker on GCE *(only if leaving DEMO_MODE)*
- Provision an `e2-small` instance in the default VPC (asia-south1-a).
- Install Docker + pull `regpulse/scraper:rc1`.
- Run `celery -A celery_app worker -B --loglevel=info --concurrency=2 -Q celery,scraper` as a systemd service.
- Inject the same 6 secrets as the scraper job (DATABASE_URL, REDIS_URL, OPENAI_KEY, ANTHROPIC_KEY, SMTP_USER, SMTP_PASS) via Secret Manager.
- **Why**: enables auto-renewal reminders, low-credit notifications, RSS news ingest (every 30 min), question clustering. None of these matter while `DEMO_MODE=true`, so this is a real-launch prerequisite, not an R&D one.
- Estimated time: 1–1.5 hr.

### B. Phase 5 — Custom domain + TLS
- Requires: a domain you own (e.g. `regpulse.in`) and access to its DNS.
- Steps:
  1. `gcloud beta run domain-mappings create --service=regpulse-frontend --domain=regpulse.in --region=asia-south1`
  2. `gcloud beta run domain-mappings create --service=regpulse-backend --domain=api.regpulse.in --region=asia-south1`
  3. Update DNS at registrar with the CNAME/A records GCP returns
  4. Wait ~15–60 min for Google-managed SSL provisioning
  5. Update backend env: `gcloud run services update regpulse-backend --update-env-vars="FRONTEND_URL=https://regpulse.in,BACKEND_PUBLIC_URL=https://api.regpulse.in"`
  6. Rebuild + redeploy frontend with `NEXT_PUBLIC_API_URL=https://api.regpulse.in/api/v1` baked in
- Estimated time: 30 min active work + provisioning wait.

### C. Phase 6 — GitHub Actions auto-deploy via Workload Identity Federation
- Configure WIF pool + provider on the project: `gcloud iam workload-identity-pools create github --location=global` etc.
- Bind the existing GitHub repo identity (`amitd01/RegPulse`) so it can impersonate a deploy SA.
- Create a `regpulse-deploy` SA with `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`.
- Wire `.github/workflows/deploy.yml` (already stubbed) to fire on `v*` tags. Use `google-github-actions/auth@v2` with `workload_identity_provider` input.
- **Why**: today every deploy requires you to `gcloud builds submit` from your laptop. WIF makes it `git tag v0.1.0 && git push --tags` → CI builds + deploys automatically. No long-lived service-account keys to leak.
- Estimated time: 1.5–2 hr.

### D. ANN-index recovery for vector search
- Symptoms today: every RAG question does a sequential scan over `document_chunks.embedding` — fine for <500 chunks, slow at 5000+.
- Options (pick one):
  1. **`halfvec(3072)` migration** — pgvector supports half-precision vectors with ivfflat up to 4000 dims. Cleanest forward path. Requires an `ALTER COLUMN` + new index migration.
  2. **Wait for Cloud SQL pgvector upgrade** to 0.7+, which lifts the HNSW limit. No code change but no ETA.
  3. **Downgrade to `text-embedding-3-small`** (1536-dim). Quality regression; not recommended.
- Decide once `circular_documents` row count exceeds ~1000 and you can measure end-to-end latency.

### E. Snapshot + monitoring dashboard
- ✅ **Completed**: A Cloud Monitoring dashboard for the Scraper has been deployed via `scripts/gcp/phase6_setup_observability.sh`. It includes log-based metrics for processed documents, execution errors, and job success.

---

## 🗺️ Where things live

| Need | Path |
|---|---|
| Run any GCP-deploy step | `scripts/gcp/phase{N}*.sh` (10 scripts, named per phase) |
| Full deploy state + checklist | `GCP_DEPLOY_RUNBOOK.md` |
| Production architecture spec | `PRODUCTION_PLAN.md` |
| Codebase invariants + business rules | `MEMORY.md` |
| Phase 2 gotchas (Phase 1 of project) | `LEARNINGS.md` § Sprint 1–8 |
| GCP deploy gotchas | `LEARNINGS.md` § LGCP.1–LGCP.6 |
| What product features exist (PRD v4) | `RegPulse_PRD_v4.md` |
| Backend code | `backend/app/` (FastAPI), `backend/migrations/` (SQL) |
| Scraper code | `scraper/` (sync Celery + one-shot wrapper) |
| Frontend code | `frontend/src/` (Next.js 14, terminal-modern v2) |
| Cloud SQL root password (temp) | `/tmp/regpulse_db_pw` on your laptop (also versioned in Secret Manager) |
| Cloud Run logs | `gcloud logging read 'resource.type=cloud_run_revision'` |
| Cloud Run Job logs | `gcloud logging read 'resource.type=cloud_run_job'` |

---

## 🚪 To resume cold (no context from this session)

If a different person (or a fresh Claude session) is picking this up:

1. `git pull origin main`
2. Read `GCP_DEPLOY_RUNBOOK.md` § "Status" — shows which phases are done
3. Read this file's "First 10 minutes" — run the diagnostic commands
4. Read `LEARNINGS.md` § LGCP.1–LGCP.6 — the deploy gotchas you'll repeat without these
5. Skim `MEMORY.md` § "GCP Deployment State" — live URLs and current mode

That's enough context to be productive. The full deploy is captured in scripts/gcp/, so nothing requires reverse-engineering.
