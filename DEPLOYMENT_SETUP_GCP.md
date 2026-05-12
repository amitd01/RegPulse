# RegPulse Deployment & Setup Guide

## Stack Information

- Backend: Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0 async, Pydantic v2.
- Frontend: Next.js 14 standalone output, React 18, TypeScript strict, Tailwind CSS, TanStack Query, Zustand.
- Scraper/Workers: Python 3.11, Celery, BeautifulSoup/lxml, pdfplumber, Tesseract, Poppler, NLTK.
- Database: PostgreSQL 16 with `pgvector`; SQL migrations in `backend/migrations/*.sql`.
- Queue: Celery over Redis DB 1 for scraper/worker tasks.
- Cache: Redis DB 0 for backend cache/JWT blacklist/embedding cache.
- Auth: OTP login, RS256 JWT access tokens, HttpOnly refresh cookie, Redis-backed JWT blacklist.
- Payments: Razorpay orders, verification, and webhook.
- LLM/APIs: Anthropic primary (`claude-sonnet-4-20250514`), OpenAI fallback (`gpt-4o`), OpenAI embeddings (`text-embedding-3-large`), PostHog analytics, SMTP email, RSS feeds.
- Storage: No persistent app object storage detected; manual PDF upload bytes are temporarily held in Redis.
- Deployment: Dockerfiles for backend/frontend/scraper, `docker-compose.yml`, GitHub Actions CI and tag-triggered deploy stub, Nginx reverse proxy config.
- Runtime: Python `>=3.11`, Node 20, pnpm 9, Docker/Compose, PostgreSQL+pgvector, Redis.
- Package Manager: `pip` for Python, `pnpm` for frontend.

## Local Setup Requirements

### Required Software

- Docker Desktop with Compose plugin.
- Python 3.11 if running backend/scraper commands outside Docker.
- Node 20 + Corepack/pnpm 9 if running frontend outside Docker.
- OpenSSL for generating RS256 JWT keys.
- Optional for native scraper work: Tesseract OCR and Poppler.

### Environment Variables

Copy `.env.example` to `.env`. Required means required for the relevant service to boot outside test/demo stubs.

| Variable | Required | Description |
|---|---:|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Local Docker | Compose Postgres credentials. |
| `DATABASE_URL` | Yes | Backend async URL: `postgresql+asyncpg://...`; scraper sync URL in Compose is overridden to `postgresql://...`. |
| `REDIS_URL` | Yes | Backend cache/broker URL; Compose uses DB 0 for backend and DB 1 for scraper/beat. |
| `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` | Yes | RS256 PEM keys; in `.env`, encode newlines as literal `\n`. |
| `OPENAI_API_KEY` | Yes | Embeddings and fallback client. |
| `ANTHROPIC_API_KEY` | Yes | Primary LLM and summary/KG extraction. |
| `LLM_MODEL`, `LLM_FALLBACK_MODEL`, `LLM_SUMMARY_MODEL` | No | Defaults in `.env.example`; fallback must be OpenAI-compatible. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Yes | Payments and webhook HMAC. Use dummy values only with `DEMO_MODE=true`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Yes | OTP/admin email. Use dummy values only with `DEMO_MODE=true`. |
| `ADMIN_EMAIL_ALLOWLIST` | No | CSV admin emails. |
| `FRONTEND_URL`, `PUBLIC_BASE_URL`, `BACKEND_PUBLIC_URL` | Yes | CORS, share links, OG image URLs. |
| `ENVIRONMENT`, `DEMO_MODE` | Yes | `DEMO_MODE=true` is blocked when `ENVIRONMENT=prod`. |
| `KG_EXTRACTION_ENABLED`, `RAG_KG_EXPANSION_ENABLED` | No | Knowledge graph extraction/retrieval flags; default true. |
| `RSS_INGEST_ENABLED`, `RSS_SOURCES`, `NEWS_RELEVANCE_THRESHOLD` | No | RSS/news ingest config. |
| `SENTRY_DSN` | No | Optional error reporting. |
| `NEXT_PUBLIC_API_URL` | Frontend | Browser API base, e.g. `https://api.example.com/api/v1`. Build-time/public env. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | No | Frontend analytics/feature flags. |

### Installation Steps

1. Create `.env` and fill required secrets:

```bash
cp .env.example .env
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
```

2. For local demo, set:

```bash
ENVIRONMENT=dev
DEMO_MODE=true
FRONTEND_URL=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:8000
```

3. Start all local services:

```bash
docker compose up --build -d
```

### Run Commands

```bash
make up              # docker compose up -d
make down            # stop compose services
make logs            # follow all logs
make build           # build all images
make test-backend    # PYTHONPATH=backend pytest backend/tests/unit/ -v
make test-frontend   # tsc + eslint + next build
make test            # backend + frontend
make eval            # evals in backend dev image
```

Native frontend:

```bash
cd frontend
corepack enable
corepack prepare pnpm@9 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Native backend requires Postgres+pgvector and Redis already running:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Seed/Migration Commands

Docker Compose applies `backend/migrations/001` through `005` on a fresh Postgres volume via `docker-entrypoint-initdb.d`.

For an existing database, apply SQL migrations manually in order:

```bash
for f in backend/migrations/*.sql; do psql "$DATABASE_URL_SYNC" -f "$f"; done
```

Useful one-off scripts:

```bash
docker exec regpulse-backend python scripts/seed_demo.py
docker exec regpulse-backend python scripts/backfill_embeddings.py
docker exec regpulse-backend python scripts/backfill_question_embeddings.py
docker exec regpulse-scraper python /scraper/backfill_kg.py
```

Trigger scraper manually:

```bash
docker exec regpulse-scraper celery -A celery_app -b redis://redis:6379/1 call scraper.tasks.daily_scrape
```

### Start Application

```bash
docker compose up --build -d
./scripts/launch_check.sh http://localhost:8000 http://localhost:3000
```

- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/api/v1/docs`
- Health: `http://localhost:8000/api/v1/health`
- Demo OTP: `123456` when `DEMO_MODE=true`

Common repo-visible issue: Compose containers do not bind-mount backend/scraper source; rebuild images after code changes instead of relying on `docker cp`.

## Recommended GCP Architecture

Use Cloud Run for request-serving containers, Cloud SQL for Postgres+pgvector, Memorystore for Redis, Artifact Registry for images, Secret Manager for config, and a small GCE VM for always-on Celery worker/beat. This matches the repo’s Docker setup and avoids forcing long-running Celery consumers into request-driven Cloud Run.

Recommended services:

- `regpulse-backend`: Cloud Run, port 8000, min 1 instance, max 10, private access to Cloud SQL and Redis.
- `regpulse-frontend`: Cloud Run, port 3000, min 1 instance, max 10.
- Celery worker + beat: Compute Engine `e2-small` in same VPC, running scraper image command `celery -A celery_app worker ...` and `celery -A celery_app beat ...`.
- Database: Cloud SQL PostgreSQL 16, private IP, `pgvector` extension, HA for production.
- Cache/Queue: Memorystore Redis 7, private IP, AUTH enabled where available.
- Scraper batch option: Cloud Scheduler can enqueue Celery tasks through the worker/beat, or run a Cloud Run Job for one-off/manual scrape operations.

## GCP Services Required

- Cloud Run, Cloud SQL Admin, Memorystore, Artifact Registry, Secret Manager.
- Serverless VPC Access, Service Networking, Compute Engine.
- Cloud Scheduler if not relying only on Celery beat.
- Cloud Logging/Monitoring; Cloud DNS or external DNS for domains.
- Optional: Cloud Armor behind external HTTPS load balancer for WAF/webhook restrictions.

## Deployment Steps

### Step 1 - Create GCP Project

```bash
export PROJECT_ID=regpulse-prod
export REGION=asia-south1
export REPO=regpulse

gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account BILLING_ACCOUNT_ID
```

### Step 2 - Enable APIs

```bash
gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com redis.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  vpcaccess.googleapis.com servicenetworking.googleapis.com \
  compute.googleapis.com cloudscheduler.googleapis.com iamcredentials.googleapis.com
```

### Step 3 - Configure Network, Database, Redis

```bash
gcloud compute addresses create google-managed-services-default \
  --global --purpose=VPC_PEERING --prefix-length=16 --network=default

gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default

gcloud compute networks vpc-access connectors create regpulse-connector \
  --region="$REGION" --network=default --range=10.8.0.0/28

gcloud sql instances create regpulse-postgres \
  --database-version=POSTGRES_16 --region="$REGION" \
  --tier=db-custom-2-4096 --storage-type=SSD --storage-size=50 \
  --availability-type=REGIONAL --network=default --no-assign-ip

gcloud sql databases create regpulse --instance=regpulse-postgres
gcloud sql users create regpulse --instance=regpulse-postgres --password='CHANGE_ME'

gcloud redis instances create regpulse-redis \
  --region="$REGION" --size=1 --redis-version=redis_7_0 --network=default
```

Enable `pgvector` and apply migrations from a trusted machine or Cloud SQL-connected runner:

```bash
psql "$DATABASE_URL_SYNC" -c "CREATE EXTENSION IF NOT EXISTS vector;"
for f in backend/migrations/*.sql; do psql "$DATABASE_URL_SYNC" -f "$f"; done
```

`DATABASE_URL_SYNC` should be a sync Postgres URL for `psql`; app `DATABASE_URL` should be `postgresql+asyncpg://...`.

### Step 4 - Configure Secrets

Store production values in Secret Manager. At minimum:

```bash
for name in DATABASE_URL REDIS_URL JWT_PRIVATE_KEY JWT_PUBLIC_KEY \
  OPENAI_API_KEY ANTHROPIC_API_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET \
  RAZORPAY_WEBHOOK_SECRET SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM \
  FRONTEND_URL PUBLIC_BASE_URL BACKEND_PUBLIC_URL ADMIN_EMAIL_ALLOWLIST; do
  gcloud secrets create "$name" --replication-policy=automatic
done
```

Add actual values:

```bash
printf '%s' 'actual-value' | gcloud secrets versions add SECRET_NAME --data-file=-
```

Set non-secret env directly on services: `ENVIRONMENT=prod`, `DEMO_MODE=false`, model names, RAG flags, RSS flags, and public `NEXT_PUBLIC_*` frontend vars.

### Step 5 - Build Docker Images

```bash
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker --location="$REGION"

gcloud auth configure-docker "$REGION-docker.pkg.dev"

export REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO"
export IMAGE_TAG="$(git rev-parse --short HEAD)"

docker build -t "$REGISTRY/backend:$IMAGE_TAG" backend/
docker build -t "$REGISTRY/frontend:$IMAGE_TAG" frontend/
docker build -t "$REGISTRY/scraper:$IMAGE_TAG" scraper/
```

Note: the current `frontend/Dockerfile` does not declare build args. For production, update it to accept `ARG NEXT_PUBLIC_API_URL`/`ARG NEXT_PUBLIC_POSTHOG_*` before `pnpm build`, or build in an environment where those variables are present; otherwise the frontend may bake the localhost API fallback.

### Step 6 - Push Images

```bash
docker push "$REGISTRY/backend:$IMAGE_TAG"
docker push "$REGISTRY/frontend:$IMAGE_TAG"
docker push "$REGISTRY/scraper:$IMAGE_TAG"
```

### Step 7 - Deploy Backend and Frontend

```bash
gcloud run deploy regpulse-backend \
  --image="$REGISTRY/backend:$IMAGE_TAG" \
  --region="$REGION" --platform=managed --port=8000 \
  --min-instances=1 --max-instances=10 --cpu=1 --memory=1Gi \
  --vpc-connector=regpulse-connector --vpc-egress=private-ranges-only \
  --set-env-vars=ENVIRONMENT=prod,DEMO_MODE=false \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,JWT_PRIVATE_KEY=JWT_PRIVATE_KEY:latest,JWT_PUBLIC_KEY=JWT_PUBLIC_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest,SMTP_HOST=SMTP_HOST:latest,SMTP_PORT=SMTP_PORT:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest,SMTP_FROM=SMTP_FROM:latest,FRONTEND_URL=FRONTEND_URL:latest,PUBLIC_BASE_URL=PUBLIC_BASE_URL:latest,BACKEND_PUBLIC_URL=BACKEND_PUBLIC_URL:latest

gcloud run deploy regpulse-frontend \
  --image="$REGISTRY/frontend:$IMAGE_TAG" \
  --region="$REGION" --platform=managed --port=3000 \
  --min-instances=1 --max-instances=10 --cpu=1 --memory=512Mi \
  --set-env-vars=NEXT_PUBLIC_API_URL=https://api.example.com/api/v1,NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Step 8 - Deploy Celery Worker/Beat

Create one `e2-small` VM in the VPC and run the scraper image with access to the same `DATABASE_URL`, Redis DB 1, SMTP, OpenAI, and Anthropic secrets.

Worker command:

```bash
celery -A celery_app worker --loglevel=info --concurrency=2 -Q celery,scraper
```

Beat command:

```bash
celery -A celery_app beat --loglevel=info
```

Production note: use systemd or Docker Compose on the VM to keep both processes restarted. The repo does not include Terraform, startup scripts, or systemd units for this yet.

### Step 9 - Configure Domain & SSL

Use Cloud Run domain mappings or an external HTTPS load balancer:

- Frontend domain: `https://regpulse.in` or equivalent.
- Backend/API domain: `https://api.regpulse.in` or equivalent.
- Set backend `FRONTEND_URL`, `PUBLIC_BASE_URL`, `BACKEND_PUBLIC_URL` to final HTTPS URLs.
- Set Razorpay webhook URL to `https://api.example.com/api/v1/subscriptions/webhook`.
- If using direct Cloud Run domain mapping, Google-managed TLS is automatic.
- If using load balancer + Cloud Armor, preserve SSE settings: no response buffering and long read timeout for `/api/v1/questions`.

### Step 10 - Configure CI/CD

Detected workflow: `.github/workflows/deploy.yml` builds backend/frontend and deploys on `v*` tags via Workload Identity Federation.

Required GitHub secrets:

```bash
GCP_PROJECT_ID
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
```

Current gaps in the workflow:

- Does not build/push/deploy the scraper image.
- Does not set Cloud Run env vars, secrets, VPC connector, scaling, or service account.
- Does not run migrations.
- Does not provision GCE worker/beat or Cloud Scheduler.
- No Terraform/Helm/Kubernetes manifests detected.

### Step 11 - Verify Deployment

```bash
./scripts/launch_check.sh https://api.example.com https://app.example.com
```

Then run:

```bash
docker run --rm --env-file prod.env "$REGISTRY/backend:$IMAGE_TAG" \
  python scripts/backfill_question_embeddings.py
```

Also verify:

- Register/login/OTP and refresh cookie flow.
- Ask endpoint with SSE and cited answer.
- Razorpay order + webhook.
- Scraper crawl indexes circulars and embeddings.
- Admin review and PDF export.
- `DEMO_MODE=false` in production.

## Infrastructure Detection

Detected:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `scraper/Dockerfile`
- `docker-compose.yml`
- `.dockerignore`, `frontend/.dockerignore`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `nginx/nginx.conf`
- `Makefile`
- `.pre-commit-config.yaml`
- `scripts/launch_check.sh`
- `scripts/jira.sh`
- `backend/migrations/001_initial_schema.sql`
- `backend/migrations/002_sprint3_knowledge_graph.sql`
- `backend/migrations/003_sprint4_confidence.sql`
- `backend/migrations/004_sprint5.sql`
- `backend/migrations/005_sprint6_system_user.sql`
- `backend/scripts/backfill_embeddings.py`
- `backend/scripts/backfill_question_embeddings.py`
- `backend/scripts/backfill_kg.py`
- `backend/scripts/seed_demo.py`

Not detected:

- Kubernetes manifests, Helm charts, Terraform, GitLab CI, Jenkins, PM2, Procfile, Supervisor config.
- Alembic revision files under `backend/alembic/versions`; SQL migrations appear to be the ground truth.
- GCP resource provisioning code; deployment plan exists but infra is not provisioned from repo.

## Quick Start Summary

Local minimum:

```bash
cp .env.example .env
# fill OPENAI_API_KEY, ANTHROPIC_API_KEY, JWT keys, SMTP/Razorpay or set DEMO_MODE=true with dummy values
docker compose up --build -d
./scripts/launch_check.sh http://localhost:8000 http://localhost:3000
```

GCP minimum:

```bash
# Provision Cloud SQL Postgres 16 + pgvector, Memorystore Redis, VPC connector, Artifact Registry, Secret Manager.
# Build/push backend, frontend, scraper images.
# Deploy backend/frontend to Cloud Run.
# Run Celery worker + beat on a small GCE VM.
# Apply SQL migrations, run initial scraper crawl, run launch_check.sh.
```

Most important production variables:

- `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `RAZORPAY_*`, `SMTP_*`
- `FRONTEND_URL`, `PUBLIC_BASE_URL`, `BACKEND_PUBLIC_URL`
- `ENVIRONMENT=prod`, `DEMO_MODE=false`, `NEXT_PUBLIC_API_URL`

Major deployment risks:

- Frontend public env vars are build-time; avoid baking `localhost` into the production image.
- Current deploy workflow is incomplete for secrets, VPC, scraper image, migrations, and workers.
- Celery worker/beat must be always-on and must consume `-Q celery,scraper`.
- Production DB needs `pgvector` before migrations.
- Scraper writes directly to the backend DB; keep it in the private VPC.
- Run `backfill_question_embeddings.py` once after deploying existing data.
