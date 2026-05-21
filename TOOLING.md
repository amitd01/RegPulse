# TOOLING — RegPulse

> Environment, dependency pins, and resolved troubleshooting. Read this when
> something fails to install or run. Per global CLAUDE.md size cap: ≤100 lines.

## Versions

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | `uv` manages venv; `requirements.txt` + `requirements-dev.txt` |
| Node | 20.x | pnpm 9.x; `frontend/package.json` |
| Postgres | 16 + pgvector | `pgvector/pgvector:pg16` docker image |
| Redis | 7-alpine | Two DBs: 0 = backend cache, 1 = celery broker, 15 = test |
| Docker Compose | v2 | `version:` key in compose file is obsolete (warning only) |
| Playwright | bundled | `frontend/node_modules/@playwright/test` |

## API keys / models

- `text-embedding-3-large` (3072 dims) — embeddings. **Cloud SQL pgvector caps at 2000 dims for ANN indexes**, so production runs sequential-scan only on `document_chunks.embedding`. Don't try to add ivfflat there; see LEARNINGS § LGCP.5.
- `claude-sonnet-4-20250514` primary, `gpt-4o` fallback. Both keys required for prod; tests stub via `sk-test-fake` defaults in conftest.
- `cross-encoder/ms-marco-MiniLM-L-6-v2` (90 MB) — pre-baked into `backend/Dockerfile` at image-build time so DEMO_MODE doesn't have to skip it.

## Resolved troubleshooting

| Symptom | Fix | Reference |
|---|---|---|
| `ModuleNotFoundError: fakeredis` / `aiosqlite` on fresh `pytest` run | `requirements-dev.txt` pins both; CI installs that file in a clean container | LEARNINGS LR1.1 |
| `pybreaker` 1.2.0's `call_async` raises `NameError: name 'gen' is not defined` | Use synchronous `.call(_helper)` wrapper + manual `await` outside the breaker; don't use the async API | LEARNINGS LR10.1 |
| Local `pytest` works but `docker exec backend python -m pytest` fails with `No module named 'app.cache'` | Container is missing `/app/pyproject.toml`. Either mount it, set `PYTHONPATH=/app` + write `/app/pytest.ini` with `pythonpath = .`, OR run integration tests against `postgres:5432` (docker network DNS) from a backend container that has access to the source tree | This session |
| Docker compose's `scraper` service restart-loops with `The module celery_app was not found` | `docker-compose.yml` command must be `celery -A scraper.celery_app worker` (not `celery_app`); `PYTHONPATH=/app` (not `/`). GCP Cloud Run Job uses the Dockerfile CMD directly so this was latent | LEARNINGS L-S4b.2 (c) |
| `pytest` from host can't reach `localhost:5432` Postgres | Host already runs a postgres on 5432; docker compose's published port collides. Either stop the host service, set `POSTGRES_HOST_PORT=5433` in compose, or run tests inside the backend container against `postgres:5432` over the docker network | This session |
| Real RBI scrape produces 100% PDF-magic-byte failures | Crawler URL filter was too permissive — accepted any `rbi.org.in` anchor with text. Fixed: only `.pdf` extension OR `NotificationUser.aspx?Id=NNNN` OR `BS_ViewMasdirections.aspx?Id=NNNN`. SCR-1's graceful failure was masking the upstream issue | LEARNINGS L-S4b.2 (b) |
| Scraper indexes circulars but `structured_content` stays NULL | `scraper/tasks.py:304` INSERT must include the `structured_content` column with `json.dumps(extracted.structured_content)`. The extractor (S4b.1) emits the tree; persistence wiring was a separate fix (S4b.2) | LEARNINGS L-S4b.2 (a) |
| Playwright ask / save-history tests time out at 30s | Real RAG+LLM streams take 30–60s. `playwright.config.ts` now sets `timeout: 90_000` globally | This session |
| Playwright assertion sees stale text mid-stream | Use `expect(locator).toContainText(...)` not `await locator.textContent()` + `expect(...).toMatch(...)`; the former auto-retries | This session |
| Playwright count assertion races mock-fallback hydration | `expect.poll(async () => cards.count(), { timeout }).toBe(20)` — count snapshots before live data swap-in are unreliable | This session |
| `make e2e` against fresh stack: every page hangs in "streaming" | `(app)/layout.tsx` must gate children render on `authReady` (a state flipped after `silentRefresh()` settles), not just fire-and-forget `useEffect(silentRefresh)`. Otherwise the initial fetch races the cookie bootstrap, hits 403, React Query latches into error | LEARNINGS L-Merge.1 |
| Backend hangs in /questions SSE branch on a warm cache | Answer-cache hit must (a) persist a per-user Question row, (b) frame the cached payload as SSE events when `Accept: text/event-stream`. Otherwise the v2 Ask page hangs waiting for a `citations` event | LEARNINGS L-S4b.2 (5) |

## Local-stack quickstart

```bash
# Bring up the full stack
cp .env.example .env
docker compose up --build -d   # postgres, redis, backend, scraper, celery-beat, frontend

# Apply migrations 006-009 if the volume was wiped (initdb only mounts 001-005)
for f in 006_structured_content 007_v4_modules 008_annotations 009_scraper_failed_extractions; do
  docker exec -i regpulse-postgres psql -U regpulse -d regpulse < backend/migrations/${f}.sql
done

# Seed demo corpus (10 synthetic circulars with structured_content)
docker exec regpulse-backend python scripts/seed_demo.py

# OR run the real scrape (~10 min for ~150 circulars; needs real OPENAI_API_KEY)
docker exec -d regpulse-scraper sh -c 'python -m scraper.run_oneshot priority > /tmp/scrape.log 2>&1'
docker exec regpulse-scraper tail -f /tmp/scrape.log

# Run the Playwright suite against the running stack
make e2e
```
