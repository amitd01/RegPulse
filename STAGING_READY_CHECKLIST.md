# RegPulse Staging Ready Checklist

Use this checklist to stand up and validate a staging environment before production deployment.

## 1) Access and Accounts

- [ ] GCP project created for staging
- [ ] Billing enabled
- [ ] Access to OpenAI, Anthropic, Razorpay (test mode), SMTP staging account
- [ ] GitHub repo admin access for Actions secrets and environments

## 2) Source and Branch Hygiene

- [ ] Pull latest `main`
- [ ] CI is green on current commit
- [ ] No local-only config assumptions

## 3) Staging Infrastructure (GCP)

- [ ] Cloud SQL PostgreSQL 16 instance created
- [ ] `pgvector` extension enabled
- [ ] Memorystore Redis instance created
- [ ] Artifact Registry docker repo created
- [ ] Secret Manager secrets created
- [ ] Serverless VPC connector created
- [ ] Service accounts and IAM bindings configured

## 4) Secrets and Config

- [ ] All required sensitive env vars loaded into Secret Manager
- [ ] `ENVIRONMENT=staging`
- [ ] `DEMO_MODE=false`
- [ ] Staging URLs configured:
  - [ ] `FRONTEND_URL`
  - [ ] `PUBLIC_BASE_URL`
  - [ ] `BACKEND_PUBLIC_URL`
- [ ] Frontend public vars configured:
  - [ ] `NEXT_PUBLIC_API_URL`
  - [ ] `NEXT_PUBLIC_POSTHOG_KEY` (if enabled)
  - [ ] `NEXT_PUBLIC_POSTHOG_HOST` (if enabled)

## 5) Build and Image Push

- [ ] Backend image built and pushed
- [ ] Frontend image built and pushed
- [ ] Scraper image built and pushed
- [ ] Image tags recorded for rollback

## 6) Deploy Services

### Cloud Run
- [ ] `regpulse-backend-staging` deployed
- [ ] `regpulse-frontend-staging` deployed
- [ ] Backend has DB/Redis/secret access
- [ ] Backend attached to VPC connector for private service access

### Worker and Scheduler
- [ ] Staging worker runtime deployed (GCE or equivalent always-on process)
- [ ] Celery worker command consumes `celery,scraper` queues
- [ ] Celery beat running

## 7) Database and Data Preparation

- [ ] SQL migrations `001` to `005` applied in order
- [ ] Initial crawl task triggered successfully
- [ ] Circulars and embeddings verified in DB
- [ ] Run `backfill_question_embeddings.py` if needed

## 8) Functional Verification

- [ ] Health endpoints pass:
  - [ ] `/api/v1/health`
  - [ ] `/api/v1/health/ready`
- [ ] Registration/login/OTP works
- [ ] Ask flow works (SSE and non-SSE)
- [ ] Citations returned for valid queries
- [ ] Credits deduct only on successful answer flow
- [ ] Payment order + webhook test flow works
- [ ] Admin routes accessible for admin users only
- [ ] Updates/news endpoints functioning

## 9) Operational Verification

- [ ] Cloud Logging receiving structured backend logs
- [ ] Error reporting path validated (Sentry optional)
- [ ] Queue/task execution logs visible
- [ ] Basic alert policies configured (5xx, instance health, DB pressure)

## 10) Security Validation

- [ ] HTTPS enabled on staging domains
- [ ] CORS origin restricted to staging frontend origin
- [ ] No hardcoded secrets in images or repository
- [ ] Razorpay webhook signature validation confirmed
- [ ] `DEMO_MODE` disabled in staging

## 11) CI/CD Readiness

- [ ] GitHub Actions deploy workflow runs on staging trigger
- [ ] WIF authentication works
- [ ] Rollback procedure documented and tested once
- [ ] Deployment notes captured in team handover docs

## 12) Exit Criteria (Staging Complete)

- [ ] All critical smoke tests passed
- [ ] No blocking errors in logs for 24h window
- [ ] Worker schedules execute at least one successful cycle
- [ ] Team sign-off recorded
- [ ] Approved to proceed to production rollout

---

## Fast Run Commands (Reference)

```bash
# Local confidence check before staging push
make test
./scripts/launch_check.sh http://localhost:8000 http://localhost:3000

# Manual scraper trigger (environment-specific endpoint/broker)
celery -A celery_app -b redis://<redis-host>:6379/1 call scraper.tasks.daily_scrape
```

