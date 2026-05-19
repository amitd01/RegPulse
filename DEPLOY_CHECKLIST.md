# RegPulse — Deploy Checklist

> **Pick this up after ReBuild S1→S10 lands.** Two tracks remain to reach `v1.0.0`:
> 1. **S4b** — finish slice 2 (real RBI scrape + structural PDF extractor)
> 2. **GCP Phases A → B → C** — infra provisioning + CI/CD + launch
>
> Both need access not available in the rebuild's sandbox (Docker daemon, real LLM keys, GCP credentials).

---

## Track 1 — S4b: Real-data circular ingestion

### S4b.1 — Structural PDF extractor

**File:** `scraper/extractor/pdf_extractor.py` (currently flattens; rewrite to emit structure)

Use **pdfplumber's table API** plus **heading detection heuristics**:
- Font-size deltas relative to median page font (large = heading; record level by ranking)
- Position-based clues (centered + smaller = caption; left-aligned bold = section header)
- Numbered prefixes (`/^(\d+\.)+/` → ordered list; `/^[•●○▪-]/` → unordered list)

Emit two outputs from the same source:

```python
@dataclass
class ExtractionResult:
    structured_content: dict  # JSONB tree matching backend.app.schemas.circulars.StructuredContent
    retrieval_chunks: list[str]  # 512-token windows with 64-token overlap (current pipeline)
```

The `structured_content` tree shape is documented in `backend/migrations/006_structured_content.sql`.

### S4b.2 — Chunker dual-output

**File:** `scraper/processor/chunker.py`

Accept the structured tree from S4b.1 and emit:
- Existing 512-token retrieval chunks (input to embedder)
- The structured tree, persisted to `circular_documents.structured_content` in the same INSERT

### S4b.3 — Real RBI scrape

```bash
# Ensure real OPENAI_API_KEY in .env (text-embedding-3-large costs ~$0.0001/circular)
docker compose up --build -d
# Trigger the full scrape (not the priority one):
docker exec regpulse-scraper celery -A celery_app -b redis://redis:6379/1 call scraper.tasks.full_scrape
# Watch logs:
docker compose logs -f scraper
```

Acceptance: `SELECT COUNT(*) FROM circular_documents WHERE structured_content IS NOT NULL` ≥ 20.

### S4b.4 — Playwright `library.spec.ts`

Add a spec that registers a user, opens `/library`, clicks the first circular, and asserts:
- `/library/[id]` renders `data-testid="structured-content"` (not `data-testid="structured-content-unavailable"`)
- At least one heading + one paragraph + one table block visible
- "View original on rbi.org.in" external link present

### S4b.5 — Integration test for `/circulars/{id}`

Add to `backend/tests/integration/test_circulars.py` (new): seed a circular with structured content, GET it via the real router, assert the response shape matches `CircularDetailResponse`.

---

## Track 2 — GCP Phase A: Infra provisioning

Per `PRODUCTION_PLAN.md`. Summary:

```bash
gcloud projects create regpulse-prod --name="RegPulse Production"
gcloud services enable run.googleapis.com sqladmin.googleapis.com redis.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com \
  compute.googleapis.com iam.googleapis.com

# Cloud SQL with pgvector
gcloud sql instances create regpulse-db --database-version=POSTGRES_16 \
  --tier=db-custom-2-4096 --region=asia-south1 --availability-type=REGIONAL \
  --storage-size=50GB --storage-type=SSD
# Then: psql to enable `vector` extension; apply migrations 001..008.

# Memorystore Redis
gcloud redis instances create regpulse-cache --size=1 --region=asia-south1 --tier=basic

# Artifact Registry
gcloud artifacts repositories create regpulse --repository-format=docker --location=asia-south1

# Secret Manager — all REGPULSE_* secrets per PRODUCTION_PLAN.md §3.1
# Generate prod RSA keypair for JWT (NOT the dev one from make dev-env)
# Set BACKEND_PUBLIC_URL=https://api.regpulse.in (resolves TD-09)
```

Exit criteria: every box in `PRODUCTION_PLAN.md §Phase A.5` checked.

---

## Track 2 — GCP Phase B: CI/CD + security

- **Workload Identity Federation** for GitHub Actions (no service-account keys in the repo).
- First manual deploy via `gcloud run deploy`; tag `v0.1.0` to trigger the prod path.
- Staging environment: separate Cloud Run services with `-staging` suffix; `deploy.yml` already routes push-to-main → staging, `v*` tag → prod.
- Security hardening: custom domain mapping + Google-managed TLS, AUTH on Memorystore, `pip audit` + `pnpm audit` in CI, Cloud Armor (defer to post-beta if acceptable).
- **CI integration test job** — spin up `docker compose up` in the runner, export `REGPULSE_INTEGRATION_DB_URL` + `REGPULSE_INTEGRATION_REDIS_URL`, run `pytest backend/tests/integration -v` and assert `passed > 0 && skipped == 0`. This is what S5's scaffolded suite is waiting for.
- **CI E2E test job** — `make e2e` against the docker compose stack. The 10 Playwright tests across auth/ask/save-history specs already exist.

---

## Track 2 — GCP Phase C: Data migration + launch

1. Run S4b's full RBI scrape against the production Cloud SQL.
2. Run `scripts/backfill_question_embeddings.py` if any pre-Sprint-8 question rows exist with `question_embedding IS NULL` (OP-1).
3. Cloud Monitoring alert policies — Cloud Run CPU/Memory > 80%, Cloud Run 5xx > 1%, Cloud SQL connections > 80%.
4. Pre-launch smoke checklist — full pipeline + subscription + DPDP + Razorpay + LLM fallback + dark mode + load test smoke.
5. Tag `v1.0.0`. Monitor 48h. Announce beta.

---

## Reference

- **Slice tracker:** `CLAUDE.md` § Rebuild Progress
- **Architecture rules:** `MEMORY.md`
- **Audit findings the rebuild closed:** `MEMORY.md` § Status
- **Accumulated gotchas:** `LEARNINGS.md` (LR1.1 → LR10.1)
- **Original infra plan:** `PRODUCTION_PLAN.md`
- **Product/functional spec:** `RegPulse_PRD_v4.md` + `RegPulse_FSD_v4.md`
