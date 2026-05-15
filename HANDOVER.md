# RegPulse — Session Handover

> **From:** Wrap-up session 2026-05-15 (mixed Claude Code + Antigravity work)
> **To:** Next session
> **Branch:** `main` — pushed to `origin/main`
> **Live URLs:** [Frontend](https://regpulse-frontend-yvigu4ssea-el.a.run.app) · [Backend](https://regpulse-backend-yvigu4ssea-el.a.run.app) · [API docs](https://regpulse-backend-yvigu4ssea-el.a.run.app/api/v1/docs)

---

## 🟢 Open this file first when you sit down

Two things to know upfront:

1. **The demo is live and serving real RBI data.** GCP backend + frontend serve cleanly. The scraper container fix landed in `aed8425` and the daily job runs. The PDF extraction block (SCR-1) was resolved in `16ba70c` — we now have 93 circulars and 1,208 chunks embedded. There is one remaining gap: ~373 PDFs are blocked by the RBI WAF ("Request Rejected"), but the pipeline is healthy for the rest.
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

**Expected:** You should see successful extraction logs and a growing `circulars` count. WAF rejections will appear as warnings for `rbidocs.rbi.org.in`.

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
| **Artifact Registry** | `asia-south1-docker.pkg.dev/regpulse-495309/regpulse` | `backend:rc2`, `frontend:rc1`, `scraper:rc3` (PDF extraction + crawler fix) |
| **Secret Manager** | 13 × `REGPULSE_*` | API keys + DB/Redis creds + JWT pem files |
| **Runtime SA** | `regpulse-runtime@regpulse-495309.iam.gserviceaccount.com` | secretAccessor, cloudsql.client, run.invoker, logWriter, metricWriter |
| **Backend** | Cloud Run `regpulse-backend` rev 00004 | live |
| **Frontend** | Cloud Run `regpulse-frontend` rev 00001 | live |
| **Scraper Job** | Cloud Run Job `regpulse-scraper` | 2 vCPU, 2Gi, 1h timeout, `scraper:rc3` |
| **Scheduler** | `regpulse-scraper-daily` | `30 20 * * *` UTC (= 02:00 IST) |
| **Observability** | Cloud Monitoring "RegPulse Scraper Observability" | log-based metrics for documents/errors/success |

**Mode:** `ENVIRONMENT=staging, DEMO_MODE=true, FREE_CREDIT_GRANT=999999`. OTP fixed `123456`. Payments/SMTP disabled.

---

## ⚠️  Open items going into the next session

| # | What | Severity | Where |
|---|---|---|---|
| **0** | **Phase 5 — Custom domain + TLS** | 🔥 **Top priority** | Map `regpulse.in` and `api.regpulse.in` to the Cloud Run services. |
| 1 | Scraper WAF block (`OP-3`) | **High** | ~373 PDFs from `rbidocs` get "Request Rejected" (WAF). Add User-Agent/delay or proxy. |
| 2 | Rotate OpenAI + Anthropic API keys (transcript-exposed during Phase 3B) | **High** | 🗓️  Scheduled 2026-05-16. Revoke at console.anthropic.com + platform.openai.com → `export OPENAI_KEY=… ANTHROPIC_KEY=… && bash scripts/gcp/phase3b_external_secrets.sh`. |
| 3 | Confirm / revoke `shubhamkadam1802@gmail.com` Editor+DevOps access | **Medium** | 🗓️  Scheduled 2026-05-16. Ask IT; if not Think360 → `gcloud projects remove-iam-policy-binding regpulse-495309 --member="user:shubhamkadam1802@gmail.com" --role="roles/editor"` (and `roles/iam.devOps`). |
| 4 | UAT audit blocker: headless agent fails OTP flow with 422/400 | Medium | Investigate `auth/otp` strict session/validation that blocks headless browsers. May need a "service test account" path that bypasses the strict checks in `DEMO_MODE`. |

---

## 🛠️  Suggested next dev activities (ranked)

### A. Phase 5 — Custom domain + TLS *(do this first)*
- `gcloud beta run domain-mappings create --service=regpulse-frontend --domain=regpulse.in --region=asia-south1` + `--service=regpulse-backend --domain=api.regpulse.in`
- Update DNS at registrar with CNAME/A records GCP returns.
- Wait ~15–60 min for Google-managed SSL.
- Update `FRONTEND_URL` + `BACKEND_PUBLIC_URL` envs, rebuild frontend with new `NEXT_PUBLIC_API_URL`.
- Estimated time: 30 min + provisioning wait.

### B. Scraper WAF block (`OP-3`)
- Crawler is correctly identifying ~373 valid `rbidocs.rbi.org.in` PDFs, but RBI's WAF ("Request Rejected") blocks the Cloud Run IP or default Python User-Agent.
- Try setting standard browser User-Agents, or proxying through a residential pool if the block is IP-based.

### C. Phase 6 — GitHub Actions auto-deploy via WIF
- Configure WIF pool + provider on the project.
- Bind GitHub repo identity (`amitd01/RegPulse`) to impersonate a deploy SA (`run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`).
- Wire `.github/workflows/deploy.yml` (stubbed) to fire on `v*` tags.
- Estimated time: 1.5–2 hr.

### D. ANN-index recovery for vector search
- Symptoms today: every RAG question does a seq-scan over `document_chunks.embedding` — fine for <500 chunks, slow at 5000+. Currently irrelevant because SCR-1 keeps the corpus small.
- Options when needed: (1) `halfvec(3072)` migration for ivfflat up to 4000 dims; (2) wait for Cloud SQL pgvector 0.7+; (3) downgrade to `text-embedding-3-small` (quality regression, not recommended).

### E. Phase 7 — Final smoke tests + v1.0.0 tag
- Only after Phase 5 domain mapping.
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
5. Start on Phase 5 (domain mapping) or investigate OP-3 (WAF blocking).

That's enough to be productive.

---

## ✅ This session's deliverables

- SCR-1 (scraper PDF extraction) fixed: 93 circulars, 1,208 chunks now ingested
- MEMORY.md, HANDOVER.md, and LEARNINGS.md updated with Phase C / SCR-1 learnings
- WAF block on ~373 PDFs identified as `OP-3`
