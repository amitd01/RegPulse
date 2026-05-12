# RegPulse Onboarding and GCP Deployment Guide

## 1. Project Overview

RegPulse is an RBI (Reserve Bank of India) regulatory intelligence SaaS platform. It helps banking and compliance teams ask questions in natural language and receive AI-generated answers grounded in RBI circulars with citations.

### What the project does
- Ingests RBI circular PDFs (via scraper and workers)
- Extracts and chunks text, generates embeddings, and stores searchable vectors
- Supports hybrid retrieval (vector + text search) and answer generation
- Returns answers with citations, risk signals, and recommended actions
- Provides admin, subscription, snippet sharing, updates/news, and export features

### Main business purpose
- Reduce compliance research time
- Improve traceability via citations
- Provide a subscription-based product for teams handling RBI regulatory interpretation

### High-level architecture

```text
External Sources (RBI site, RSS feeds)
        |
        v
Scraper + Celery Worker/Beat  ---> PostgreSQL + pgvector <--- FastAPI Backend <--- Next.js Frontend
            |                           ^      ^                    |
            +---------------------------+      +---- Redis ---------+
                                                     |
                                                     v
                                               LLM Providers
                                      (Anthropic primary, OpenAI fallback)
```

### Backend stack
- Python 3.11
- FastAPI
- SQLAlchemy async (2.0 style)
- Pydantic v2
- Redis async client
- Celery (for scraper/background jobs)

### Frontend stack
- Next.js 14
- React 18
- TypeScript strict mode
- TanStack Query
- Zustand

### Database
- PostgreSQL 16 with pgvector extension
- SQL migrations in `backend/migrations`

### Queue systems
- Celery over Redis (worker + beat)
- Dedicated queue routing (`scraper` queue + default celery queue)

### Cache systems
- Redis DB0 for backend cache and token blacklist
- Redis DB1 for Celery broker/result in scraper context

### External integrations
- Anthropic (primary LLM)
- OpenAI (embedding + fallback model)
- Razorpay (payments)
- SMTP (email/OTP/notifications)
- PostHog (frontend analytics)
- RBI website and RSS sources

### Authentication mechanism
- OTP-based auth flow
- Access token: JWT RS256 bearer token
- Refresh token: HttpOnly cookie
- JTI blacklist in Redis

### Deployment architecture
- Local dev: Docker Compose (6 services)
- Target cloud: GCP hybrid
  - Cloud Run for backend + frontend
  - Cloud SQL (Postgres)
  - Memorystore (Redis)
  - GCE VM for always-on Celery worker/beat
  - Artifact Registry + Secret Manager

### Architectural classification
- **Monolith vs microservices:** modular monorepo with multiple deployable services
- **Sync vs async:** mixed (sync HTTP semantics + async internal and background jobs)
- **Event-driven components:** Celery task queues and schedules
- **API-first vs server-rendered:** API-first backend with Next.js frontend client

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | FastAPI, Uvicorn, SQLAlchemy async, Pydantic v2 | API and core business logic |
| Frontend | Next.js 14, React 18, TypeScript, Zustand, TanStack Query | Web app UI |
| Database | PostgreSQL 16 + pgvector | transactional + vector retrieval |
| Queue | Celery 5.4 over Redis | background tasks and schedules |
| Cache | Redis 7 | caching, blacklist, broker |
| Cloud | GCP (Cloud Run, Cloud SQL, Memorystore, Secret Manager, Artifact Registry, GCE) | deployment platform |
| CI/CD | GitHub Actions | lint/test/build/deploy pipeline |
| Containerization | Dockerfiles + docker-compose | local and deployment packaging |
| Monitoring | structlog JSON logs, optional Sentry, PostHog | observability and analytics |

### Exact versions (major selected)
- Backend (`backend/requirements.txt`):
  - `fastapi==0.115.6`
  - `uvicorn[standard]==0.34.0`
  - `sqlalchemy[asyncio]==2.0.36`
  - `asyncpg==0.30.0`
  - `pydantic==2.10.4`
  - `redis[hiredis]==5.2.1`
  - `anthropic==0.49.0`
  - `openai==1.58.1`
  - `sentence-transformers==3.3.1`
- Scraper (`scraper/requirements.txt`):
  - `celery[redis]==5.4.0`
  - `anthropic==0.42.0`
  - `psycopg2-binary==2.9.10`
- Frontend (`frontend/package.json`):
  - `next=14.2.21`
  - `react=18.3.1`
  - `typescript=5.7.2`

### Potentially risky or outdated areas
- Version drift: scraper Anthropic `0.42.0` vs backend Anthropic `0.49.0`
- Deploy workflow currently partial (does not cover full worker/migration automation)
- No IaC (Terraform/Kubernetes manifests absent)

---

## 3. Local Development Setup

### Prerequisites

#### Required software
- Docker Desktop with Docker Compose
- Git
- OpenSSL (for JWT key generation)

#### Optional native dev software
- Python 3.11 (if running backend/scraper outside Docker)
- Node 20 + pnpm 9 (if running frontend outside Docker)
- Tesseract and Poppler (for scraper OCR-heavy native runs)

#### OS assumptions
- Works on Windows/macOS/Linux with Docker
- Commands shown in bash style; on Windows use Git Bash/WSL or adapt syntax

#### Required accounts
- OpenAI
- Anthropic
- Razorpay (for payment flow in non-demo mode)
- SMTP provider/account
- GCP account/project for cloud deployment

### Environment Variables

Reference file: `.env.example`

#### Database and Redis
- `POSTGRES_USER` - DB user (required for local compose bootstrap)
- `POSTGRES_PASSWORD` - DB password (required, sensitive)
- `POSTGRES_DB` - DB name (required local)
- `DATABASE_URL` - backend async DB URL (required, sensitive)
- `REDIS_URL` - Redis URL (required)

#### JWT/Auth
- `JWT_PRIVATE_KEY` - RSA private key PEM (required, highly sensitive)
- `JWT_PUBLIC_KEY` - RSA public key PEM (required)
- `JWT_BLACKLIST_TTL` - revoked token TTL seconds (optional)

#### LLM and Embeddings
- `OPENAI_API_KEY` (required, sensitive)
- `ANTHROPIC_API_KEY` (required, sensitive)
- `LLM_MODEL` (optional, default set)
- `LLM_FALLBACK_MODEL` (optional, must be OpenAI-compatible)
- `LLM_SUMMARY_MODEL` (optional)
- `EMBEDDING_MODEL` (optional)
- `EMBEDDING_DIMS` (optional)

#### RAG tuning
- `RAG_COSINE_THRESHOLD`
- `RAG_TOP_K_INITIAL`
- `RAG_TOP_K_FINAL`
- `RAG_MAX_CHUNKS_PER_DOC`

#### Payments and mail
- `RAZORPAY_KEY_ID` (required in non-demo)
- `RAZORPAY_KEY_SECRET` (required in non-demo, sensitive)
- `RAZORPAY_WEBHOOK_SECRET` (required in non-demo, sensitive)
- `SMTP_HOST` (required in non-demo)
- `SMTP_PORT` (required in non-demo)
- `SMTP_USER` (required in non-demo, sensitive)
- `SMTP_PASS` (required in non-demo, sensitive)
- `SMTP_FROM` (required in non-demo)

#### Application/runtime
- `ADMIN_EMAIL_ALLOWLIST`
- `FREE_CREDIT_GRANT`
- `MAX_QUESTION_CHARS`
- `FRONTEND_URL` (required)
- `PUBLIC_BASE_URL`
- `BACKEND_PUBLIC_URL`
- `ENVIRONMENT` (`dev/staging/prod`)
- `DEMO_MODE` (must be false in prod)
- `SENTRY_DSN`

#### Feature flags/config
- `KG_EXTRACTION_ENABLED`
- `RAG_KG_EXPANSION_ENABLED`
- `RAG_KG_BOOST_WEIGHT`
- `RSS_INGEST_ENABLED`
- `RSS_SOURCES`
- `NEWS_RELEVANCE_THRESHOLD`
- `SNIPPET_RATE_LIMIT_PER_MIN`
- `SNIPPET_EXPIRY_DAYS`

#### Frontend public env
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

#### Jira script-related
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_PROJECT_KEY`

### Installation Steps (Docker-first)

```bash
cp .env.example .env
```

Generate JWT keys:

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Put key values into `.env` (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`). If multiline, use escaped `\n` style per project validator guidance.

Start all services:

```bash
docker compose up --build -d
```

### Database Setup
- Fresh docker volume: migrations `001` to `005` auto-run via `docker-entrypoint-initdb.d`.
- Existing DB: apply SQL migration files manually in order.

### Seed data / scripts
- `backend/scripts/seed_demo.py`
- `backend/scripts/backfill_embeddings.py`
- `backend/scripts/backfill_question_embeddings.py`
- KG backfill via scraper context: `/scraper/backfill_kg.py`

### Running the Project

#### Backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

#### Worker
```bash
celery -A celery_app worker --loglevel=info --concurrency=2 -Q celery,scraper
```

#### Celery beat
```bash
celery -A celery_app beat --loglevel=info
```

#### Docker startup
```bash
docker compose up --build -d
```

#### Verify app health
```bash
./scripts/launch_check.sh http://localhost:8000 http://localhost:3000
```

---

## 4. Complete Dependency Flow

```text
Frontend
  ↓
Backend API (/api/v1)
  ├─ PostgreSQL (state + vectors)
  ├─ Redis DB0 (cache + auth blacklist)
  ├─ LLM providers (Anthropic/OpenAI)
  └─ Celery-related async ecosystem

Scraper Worker + Beat
  ├─ Redis DB1 broker/backend
  ├─ PostgreSQL writes
  ├─ OpenAI/Anthropic calls
  └─ External RBI and RSS fetch
```

### Startup order
1. Postgres
2. Redis
3. Backend
4. Scraper worker and beat
5. Frontend

### What breaks if missing
- Postgres down: backend and scraper core functionality fail
- Redis down: caching, JWT blacklist checks, and Celery fail
- Worker down: scheduled ingest/notifications stop
- LLM keys invalid: answer generation degrades/fails

### Build-time dependencies
- Python/Node package installations
- Next.js standalone build
- Docker image build chain

### Runtime dependencies
- Database connectivity
- Redis availability
- External API credentials and network

### Infrastructure dependencies
- DNS/TLS
- IAM/secret access
- VPC/private networking for managed DB/Redis

---

## 5. Request Lifecycle / Data Flow

### API request flow (Q&A path)
1. Frontend sends question to `POST /api/v1/questions` (JSON or SSE accept header)
2. Backend validates auth and credits
3. Cache lookup in Redis
4. Retrieval pipeline from Postgres (`pgvector` + FTS + ranking)
5. LLM generation (Anthropic primary, OpenAI fallback)
6. Citation/safety and confidence processing
7. Persist question and deduct credit
8. Cache answer payload
9. Return streamed tokens/events or JSON response

### Authentication flow
1. Register/login starts OTP flow
2. Verify OTP completes auth
3. Access JWT returned for Authorization header
4. Refresh token maintained as HttpOnly cookie
5. On each protected request, backend checks:
   - token signature/type
   - jti blacklist
   - account status/verification/role
   - optional credits guard

### Middleware flow
- Request-ID middleware adds `X-Request-ID`
- CORS middleware with webhook exclusion
- Router dependency guards enforce auth chain

### DB interaction flow
- Async SQLAlchemy session per request
- Service methods and routers persist domain records
- Migration SQL governs schema evolution

### Queue/event flow
- Celery beat schedules tasks
- Worker consumes `celery,scraper` queues
- Tasks ingest/process content, send notifications, run clustering and subscription checks

### Response generation
- Non-streaming: full JSON payload
- Streaming: SSE `token`, `citations`, `done`, `error` events

---

## 6. Folder Structure Explanation

### Major folders
- `backend/` - API server, models, schemas, services, migrations, scripts
- `scraper/` - crawler, processors, celery app/tasks
- `frontend/` - Next.js UI
- `nginx/` - reverse proxy config
- `scripts/` - launch check and utility scripts
- `.github/workflows/` - CI/CD pipelines

### Backend key modules
- `backend/app/main.py` - app bootstrap and router mounting
- `backend/app/config.py` - env/settings loading and validation
- `backend/app/routers/` - API endpoints
- `backend/app/services/` - business logic
- `backend/app/dependencies/` - auth and service dependencies
- `backend/app/models/` - SQLAlchemy models
- `backend/app/schemas/` - Pydantic schemas

### Frontend key modules
- `frontend/src/app/` - route-based pages/layouts
- `frontend/src/lib/api.ts` - axios client + refresh interceptor
- `frontend/src/stores/authStore.ts` - in-memory auth token store

### Entry points
- Backend runtime entry: `backend/app/main.py`
- Frontend runtime entry: Next.js app root (`frontend/src/app/layout.tsx`)
- Scraper entry: `scraper/celery_app.py`

### Config loading mechanism
- Backend uses `get_settings()` from `backend/app/config.py` with `BaseSettings` and `.env` support
- Scraper has its own config module and avoids importing backend code

---

## 7. Important Services and Critical Components

### Core business logic
- `rag_service.py` - retrieval strategy and ranking
- `llm_service.py` - generation, fallback, safety
- `circular_library_service.py` - circular search/filter logic
- `subscription_service.py` - billing and plan logic
- `pdf_export_service.py` - compliance brief generation

### Critical modules
- Auth dependencies and JWT utilities
- Question lifecycle (ask/history/detail/export/feedback)
- Admin review and moderation endpoints

### Payment system
- Razorpay order, verification, webhook endpoints

### Queue processors/background tasks
- Scraping, document processing, summary/KG/news tasks
- Renewal checks and low-credit notifications
- Scheduled tasks via Celery beat

### Webhooks
- Razorpay webhook endpoint handled separately (CORS bypass route path logic)

### Risk areas
- Worker downtime leading to stale data or missed notifications
- Misconfigured env vars causing provider-specific failures
- Deployment mismatch between docs and workflow automation

---

## 8. Deployment Analysis

### Is Docker required?
- Not strictly required, but strongly preferred and primary path in repository.

### Is Kubernetes required?
- No. No Kubernetes manifests are present.

### Is VM deployable?
- Yes. Particularly required/recommended for always-on Celery workers.

### Is this serverless?
- Partially. Backend/frontend are serverless-friendly (Cloud Run), workers are not purely request-driven.

### Is this production-ready?
- Core application code appears mature, but deployment automation and IaC are not complete.

### CI/CD status
- CI exists and runs lint/test/build on pushes/PRs
- Tag-based deploy workflow exists but is not fully production-complete

### Missing deployment docs/assets
- No Terraform modules in repo
- No Kubernetes deployment manifests
- No complete scripted worker VM provisioning in repo
- Deploy workflow does not fully manage env/secrets/network/migration rollout

### Potential deployment blockers
- Secret setup incompleteness
- VPC/private networking misconfiguration
- Missing migration execution in deploy path
- Worker queue consumption misconfiguration

---

## 9. GCP Deployment Difficulty Assessment

| Area | Difficulty | Reason |
|---|---|---|
| Compute Engine | Medium | Needed for persistent Celery worker/beat |
| Cloud Run | Medium | Straightforward but needs VPC+secrets wiring |
| GKE | Hard | Unnecessary complexity for this project now |
| Networking | Medium-Hard | Private SQL/Redis access and connector setup |
| Secrets | Medium | Many env vars/secrets to map correctly |
| SSL | Easy-Medium | Managed certificates simplify setup |
| Database | Medium | Cloud SQL + pgvector + migrations |
| CI/CD | Medium-Hard | WIF + full deploy orchestration is incomplete |

### Overall Difficulty Score
- **Intermediate to Advanced**

### Why
- App architecture is well-defined, but complete production setup spans multiple GCP services and mixed runtime model (serverless + always-on workers).

---

## 10. Recommended GCP Deployment Strategy

### Recommended option
- **Hybrid deployment**
  - Cloud Run: backend + frontend
  - Cloud SQL: PostgreSQL 16 + pgvector
  - Memorystore: Redis
  - GCE VM: Celery worker + beat
  - Artifact Registry + Secret Manager

### Why this is best
- Matches existing architecture and runtime constraints
- Reduces platform complexity versus GKE
- Keeps HTTP tier autoscaled while preserving persistent worker behavior

### Estimated complexity
- Moderate implementation complexity for an experienced dev
- High for a complete GCP beginner without guidance

### Estimated monthly cost
- Project docs estimate roughly ~USD 173/month baseline in `asia-south1` (usage-dependent)

### Scalability
- Cloud Run services scale horizontally
- Worker tier can scale by adding workers/VM sizing

### Maintenance overhead
- Moderate (secrets, provider keys, DB maintenance, worker health, monitoring)

---

## 11. Step-by-Step GCP Deployment Guide

### Services required
- Cloud Run
- Cloud SQL (PostgreSQL 16)
- Memorystore Redis
- Artifact Registry
- Secret Manager
- Compute Engine
- Serverless VPC Access
- Cloud Logging/Monitoring
- Cloud DNS / domain mapping

### 11.1 Create project and enable APIs

```bash
export PROJECT_ID="your-project-id"
export REGION="asia-south1"
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  compute.googleapis.com \
  iamcredentials.googleapis.com
```

### 11.2 Create Artifact Registry

```bash
gcloud artifacts repositories create regpulse \
  --repository-format=docker \
  --location="$REGION"
gcloud auth configure-docker "$REGION-docker.pkg.dev"
```

### 11.3 Provision Cloud SQL and Redis
- Create Cloud SQL PostgreSQL 16 instance
- Create database/user
- Ensure private networking and authorized connectivity from services
- Create Memorystore Redis instance in same region/VPC

Enable pgvector and apply migrations:

```bash
psql "<sync-postgres-url>" -c "CREATE EXTENSION IF NOT EXISTS vector;"
for f in backend/migrations/*.sql; do
  psql "<sync-postgres-url>" -f "$f"
done
```

### 11.4 Secrets setup
- Store all sensitive env values in Secret Manager
- At minimum: DB URL, Redis URL, JWT keys, OpenAI/Anthropic keys, Razorpay secrets, SMTP creds, URL config

### 11.5 Build and push images

```bash
export REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/regpulse"
export TAG="$(git rev-parse --short HEAD)"

docker build -t "$REGISTRY/backend:$TAG" backend/
docker build -t "$REGISTRY/frontend:$TAG" frontend/
docker build -t "$REGISTRY/scraper:$TAG" scraper/

docker push "$REGISTRY/backend:$TAG"
docker push "$REGISTRY/frontend:$TAG"
docker push "$REGISTRY/scraper:$TAG"
```

### 11.6 Deploy backend/frontend to Cloud Run
- Deploy backend with:
  - secrets mounted as env vars
  - VPC connector for SQL/Redis private access
  - `ENVIRONMENT=prod`, `DEMO_MODE=false`
- Deploy frontend with:
  - correct `NEXT_PUBLIC_API_URL` pointing to production API
  - posthog vars if used

### 11.7 Deploy worker and beat on GCE
- Create e2-small VM (or suitable size)
- Run scraper image/processes with restart policy/systemd
- Start both:
  - worker command with `-Q celery,scraper`
  - beat scheduler command

### 11.8 DNS, SSL, and webhook setup
- Map custom domains to Cloud Run services
- Use managed TLS certificates
- Set production URLs in env:
  - `FRONTEND_URL`
  - `PUBLIC_BASE_URL`
  - `BACKEND_PUBLIC_URL`
- Update Razorpay webhook URL to production API path

### 11.9 Logs and autoscaling
- Configure Cloud Run min/max instances
- Verify logs in Cloud Logging
- Add alert policies in Cloud Monitoring

### 11.10 Post-deploy verification

```bash
./scripts/launch_check.sh https://api.example.com https://app.example.com
```

Then run smoke paths:
- register/login/verify
- ask question SSE
- payment webhook flow
- scraper ingestion
- admin features

Backfill old question embeddings:

```bash
python backend/scripts/backfill_question_embeddings.py
```

---

## 12. Production Readiness Review

### Present
- Health endpoints
- Structured logging
- Core auth and role checks
- CI checks for backend/frontend
- Dockerized services

### Missing or needs hardening
- Full deployment automation for worker tier and migrations
- IaC (Terraform) absent
- Explicit SLO/alert playbooks not fully codified
- Secrets lifecycle/rotation process should be formalized

---

## 13. Security Review

### High severity
- Risk of secret leakage if `.env` is mishandled
- Payment webhook misconfiguration can break billing integrity
- Incorrect `DEMO_MODE` handling in prod would be critical

### Medium severity
- Exposed local ports in dev compose are okay for local, unsafe if reused in prod patterns
- CORS origin misconfig can break or weaken API access constraints
- Worker and backend environment mismatch can cause hidden failures

### Lower severity / operational
- Need regular dependency audits
- Need periodic hardening review of container runtime users and permissions

---

## 14. DevOps and Infra Recommendations

### Dockerization
- Keep multi-stage images
- Add healthcheck directives where appropriate
- Ensure frontend build-time public envs are explicitly passed in CI

### CI/CD
- Extend deploy workflow to include:
  - scraper image deployment strategy
  - migration execution
  - secret/env injection and VPC settings
  - staged rollout checks

### IaC
- Add Terraform for Cloud Run, Cloud SQL, Memorystore, Secret Manager, GCE worker, IAM/WIF

### Monitoring/logging
- Add Cloud Monitoring alerts for:
  - backend 5xx rate
  - worker failures / queue lag
  - DB connection saturation
  - Redis availability

### Secrets management
- Use Secret Manager for all sensitive values
- Define rotation policy and ownership

### Deployment automation and scaling
- Create blue/green or staged rollout strategy
- Document rollback paths for backend/frontend and worker layer

---

## 15. Final Summary

### Biggest challenges
- Hybrid deployment model (serverless APIs + persistent workers)
- Secret and networking correctness across multiple services
- Partial deployment automation in current workflows

### Unknowns / missing pieces
- No Terraform/Kubernetes assets in repository
- No fully automated worker provisioning scripts in repo
- Deploy workflow still needs infrastructure/context-specific expansions

### Estimated deployment effort for a new developer
- Codebase orientation: 2-4 days
- Local setup confidence: 1-2 days
- First GCP deployment: 5-10 days
- Production hardening and repeatability: additional 1-2 weeks

### Recommended learning path
1. Docker and Compose basics
2. Cloud Run + Cloud SQL + Memorystore basics
3. Secret Manager and IAM/WIF
4. Celery worker operations
5. Monitoring and incident response basics

---

## Troubleshooting Tips

### Common failures and fixes
- **Frontend points to localhost in production**
  - Ensure `NEXT_PUBLIC_API_URL` is set correctly at build/deploy.
- **Tasks queued but not consumed**
  - Verify worker command includes `-Q celery,scraper`.
- **JWT keys fail parsing**
  - Ensure PEM values in env use escaped `\n` if single-line.
- **RAG retrieval empty unexpectedly**
  - Verify pgvector extension, migrations, and embeddings were populated.
- **Cloud Run service cannot reach DB/Redis**
  - Verify VPC connector and private network settings.
- **Webhook signature failures**
  - Verify `RAZORPAY_WEBHOOK_SECRET` and endpoint URL.

