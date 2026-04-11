# RegPulse — Production Deployment Plan

## Current State

| Area | Status |
|------|--------|
| **Codebase** | 50/50 prompts complete on remote `main` (local is behind at prompt 36) |
| **CI** | GitHub Actions passing (lint + test + build) |
| **Deploy pipeline** | Stub only — ECR push works, ECS deploy commented out |
| **Nginx** | Missing from remote (no `nginx.conf` found) |
| **Infra** | No AWS resources provisioned, no GitHub environments configured |
| **Branch protection** | Not possible (private repo, free GitHub plan) |
| **Tests** | 75 unit tests, no integration/load tests against real services |
| **Secrets management** | `.env` file only, no vault/SSM |

---

## Phase 1: Pre-Flight (Local Prep)

### 1.1 Sync local with remote
```
git pull origin main
```
This brings in prompts 37-50 (CI/CD, deploy workflow, final docs).

### 1.2 Close stale PR #4
`sprint-3/authentication` — auth was merged via later PRs. Close it.

### 1.3 Resolve known tech debt before deploy

| ID | Issue | Action |
|----|-------|--------|
| TD-02 | No graceful shutdown | Add SIGTERM handlers to uvicorn + celery workers |
| TD-04 | `admin_audit_log.actor_id` NOT NULL | Seed a `system` user for scraper operations |
| TD-01 | Scraper writes directly to backend DB | Acceptable for v1, document as known risk |

---

## Phase 2: Infrastructure Provisioning (AWS ap-south-1)

### 2.1 Networking
- VPC with 2 public + 2 private subnets (ap-south-1a, ap-south-1b)
- NAT Gateway for private subnet egress
- Security groups: ALB (80/443), backend (8000), frontend (3000), DB (5432), Redis (6379)

### 2.2 Database
- **RDS PostgreSQL 16** with `pgvector` extension
  - Instance: `db.t3.medium` (2 vCPU, 4GB) — start small, scale on load
  - Multi-AZ: **Yes** (financial/compliance data)
  - Storage: 50GB gp3, auto-scaling enabled
  - Automated backups: 7-day retention, point-in-time recovery
  - Run initial migration: `alembic upgrade head`
  - Enable `pgvector` extension: `CREATE EXTENSION vector;`

### 2.3 Cache
- **ElastiCache Redis 7** (single node `cache.t3.micro` for testing)
- Same VPC, private subnet

### 2.4 Container Registry
- **ECR** — 2 repos: `regpulse-backend`, `regpulse-frontend`
- Lifecycle policy: keep last 10 images

### 2.5 Compute (ECS Fargate)
- **Cluster:** `regpulse`
- **Services:**

| Service | Task CPU | Task Memory | Desired Count | Port |
|---------|----------|-------------|---------------|------|
| backend | 512 | 1024 MB | 2 | 8000 |
| frontend | 256 | 512 MB | 2 | 3000 |
| scraper-worker | 512 | 1024 MB | 1 | — |
| celery-beat | 256 | 512 MB | 1 | — |

### 2.6 Load Balancer
- **ALB** with two target groups (backend, frontend)
- Listener rules:
  - `/api/*` → backend target group
  - `/*` → frontend target group
- Health checks: `/api/v1/health` (backend), `/` (frontend)
- ACM certificate for `regpulse.in` (or your chosen domain)

### 2.7 DNS
- Route 53 hosted zone for domain
- A record → ALB alias

---

## Phase 3: Secrets & Configuration

### 3.1 AWS Systems Manager Parameter Store (or Secrets Manager)
Move all `.env` values to SSM SecureString parameters:

```
/regpulse/prod/DATABASE_URL
/regpulse/prod/REDIS_URL
/regpulse/prod/JWT_PRIVATE_KEY
/regpulse/prod/JWT_PUBLIC_KEY
/regpulse/prod/OPENAI_API_KEY
/regpulse/prod/ANTHROPIC_API_KEY
/regpulse/prod/RAZORPAY_KEY_ID
/regpulse/prod/RAZORPAY_KEY_SECRET
/regpulse/prod/RAZORPAY_WEBHOOK_SECRET
/regpulse/prod/SMTP_USER
/regpulse/prod/SMTP_PASS
```

### 3.2 GitHub Secrets (for deploy workflow)
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

### 3.3 Generate production RSA keypair for JWT
```bash
openssl genrsa -out jwt_private.pem 2048
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
```

### 3.4 Production env values
```
ENVIRONMENT=prod
DEMO_MODE=false
FRONTEND_URL=https://regpulse.in
ADMIN_EMAIL_ALLOWLIST=amit@yourcompany.com
FREE_CREDIT_GRANT=5
```

---

## Phase 4: CI/CD Hardening

### 4.1 Complete the deploy workflow
Uncomment the ECS deploy commands in `.github/workflows/deploy.yml` and add:
- ECS task definition updates (inject new image tag)
- Wait for service stability (`aws ecs wait services-stable`)
- Rollback on failure

### 4.2 Add staging environment
- Duplicate ECS services with `-staging` suffix
- Deploy on push to `main` (auto), prod only on `v*` tags (manual)
- Separate SSM parameter paths: `/regpulse/staging/*`

### 4.3 Add integration test job to CI
- Spin up docker-compose in GitHub Actions
- Run tests against real Postgres + Redis (not SQLite mocks)
- This catches issues the SQLite-based unit tests miss

### 4.4 Upgrade GitHub plan (recommended)
- Enables branch protection on `main` (require PR reviews, passing CI)
- Enables required status checks

---

## Phase 5: Security Hardening

| Item | Action | Priority |
|------|--------|----------|
| HTTPS everywhere | ACM cert + ALB HTTPS listener, redirect HTTP→HTTPS | **Critical** |
| CORS | Set `FRONTEND_URL=https://regpulse.in` (exact origin) | **Critical** |
| Rate limiting | Confirm slowapi works behind ALB (use `X-Forwarded-For`) | **High** |
| WAF | AWS WAF on ALB — block common attacks, geo-restrict if needed | **High** |
| Razorpay webhook | Whitelist Razorpay IPs at security group level | **Medium** |
| DB encryption | Enable RDS encryption at rest (default with gp3) | **Medium** |
| Redis AUTH | Enable auth token on ElastiCache | **Medium** |
| Dependency audit | `pip audit` + `pnpm audit` in CI | **Medium** |
| CSP headers | Add `Content-Security-Policy` in Next.js config | **Medium** |

---

## Phase 6: Observability

### 6.1 Logging
- Backend already uses `structlog` (JSON) — route container stdout to **CloudWatch Logs**
- Create log groups: `/ecs/regpulse-backend`, `/ecs/regpulse-frontend`, `/ecs/regpulse-scraper`

### 6.2 Monitoring
- **CloudWatch Alarms:**
  - ECS CPU/Memory > 80%
  - ALB 5xx rate > 1%
  - RDS connections > 80% of max
  - Healthy host count < desired count
- **Custom metrics** (via CloudWatch embedded metrics or Prometheus):
  - LLM latency (p50, p95, p99)
  - RAG retrieval quality (empty results rate)
  - Credit deductions/hour
  - Scraper success/failure rate

### 6.3 Alerting
- SNS topic → email/Slack for critical alarms
- PagerDuty or Opsgenie for on-call (later)

---

## Phase 7: Data & Compliance

| Item | Action |
|------|--------|
| **Backups** | RDS automated backups (7-day), test restore procedure |
| **Migration plan** | Script to seed initial circulars — run scraper against RBI once infra is up |
| **DPDPA readiness** | Add consent tracking for email collection (Indian data protection law) |
| **Data retention** | Define policy: how long to keep questions, analytics events, audit logs |
| **Audit trail** | `admin_audit_log` already exists — verify it covers all admin mutations |

---

## Phase 8: Testing Checklist (Pre-Launch)

- [ ] Full pipeline: register → verify OTP → ask question → get cited answer → action items
- [ ] Subscription: create order → Razorpay payment → webhook → credits added
- [ ] Scraper: manual run → circulars indexed → searchable in library
- [ ] Admin: login → dashboard → review queue → approve summary
- [ ] Auth edge cases: expired token refresh, concurrent sessions, logout
- [ ] Rate limiting: verify 429 responses under load
- [ ] LLM fallback: disable Anthropic key → verify GPT-4o fallback fires
- [ ] Empty state: new user with no circulars indexed
- [ ] Load test: 50 concurrent users (Locust or k6)

---

## Recommended Deployment Order

```
1. Provision AWS infra (VPC, RDS, Redis, ECR, ECS cluster, ALB)
2. Store secrets in SSM Parameter Store
3. Push Docker images to ECR (manual first deploy)
4. Deploy ECS services (backend + frontend + scraper + beat)
5. Run alembic migrations
6. Run initial scraper crawl to seed circulars
7. Smoke test all endpoints
8. Point domain DNS to ALB
9. Enable HTTPS (ACM cert)
10. Complete deploy workflow, tag v0.1.0 for first automated deploy
```

---

## Cost Estimate (Monthly, ap-south-1)

| Resource | Spec | ~Cost |
|----------|------|-------|
| RDS PostgreSQL | db.t3.medium, Multi-AZ, 50GB | $70 |
| ElastiCache Redis | cache.t3.micro | $15 |
| ECS Fargate (4 tasks) | ~1.5 vCPU, 3GB total | $45 |
| ALB | 1 ALB + data transfer | $25 |
| ECR | Storage + transfer | $5 |
| NAT Gateway | 1 AZ | $35 |
| CloudWatch | Logs + metrics | $10 |
| **Total** | | **~$205/mo** |

Plus variable costs: OpenAI embeddings (~$0.13/1M tokens), Anthropic LLM calls (~$3/1M input tokens), SMTP (free tier for low volume).
