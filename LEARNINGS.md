# LEARNINGS — RegPulse Phase 2

> Mistakes, surprises, and gotchas that cost us time during Phase 2 (Sprints 1, 2, 3). Each entry is a guard against repeating the same loss in future iterations. Read this before starting any sprint.
>
> Format per entry: **what bit us**, **root cause**, **fix or guard**, **how to prevent**.

---

## Sprint 1 — Hardening, Analytics, Embedder, Landing Page

### L1.1 — DEMO_MODE branches must be wired everywhere they matter
**What bit us:** First demo trial failed because the cross-encoder reranker hung downloading from HuggingFace inside Docker for Mac (SSL timeout), and the OTP rate limit (`OTP_MAX_SENDS_PER_HOUR=3`) was so low we couldn't iterate during testing.
**Root cause:** `DEMO_MODE` was treated as a single boolean but actually needs to gate several independent code paths (OTP, email, payment, expensive model loads, rate limits).
**Fix:** Explicit `if settings.DEMO_MODE:` branches in `main.py` (skip cross-encoder), `otp_service.py` (fixed OTP `123456`), `auth.py` (skip MX check), and per-feature documentation in `CLAUDE.md` § DEMO_MODE.
**Prevention:** When adding any feature that calls an external service, makes a slow startup decision, or charges money — add an explicit DEMO_MODE branch and document it in the DEMO_MODE table.

### L1.2 — `.env` multiline PEM keys break Docker's env parser
**What bit us:** JWT_PRIVATE_KEY pasted as a multi-line PEM into `.env` caused Docker Compose to silently truncate the value at the first newline.
**Root cause:** `.env` files are line-oriented; embedded `\n` literals are accepted but real newlines aren't.
**Fix:** `_expand_pem_newlines` field validator in `app/config.py` converts literal `\n` to real newlines on load. Document the encoding in `.env.example`.
**Prevention:** Any multi-line secret in `.env` must use `\n` literals. Add a validator at the config layer if you ever introduce another.

### L1.3 — `pydantic-settings` v2 wants JSON for list-typed env vars
**What bit us:** `ADMIN_EMAIL_ALLOWLIST=admin@x.com,foo@y.com` failed to parse because pydantic-settings v2 expects JSON array syntax.
**Root cause:** v2 dropped the implicit CSV parsing that v1 supported.
**Fix:** `_parse_admin_allowlist` field validator accepts both CSV and JSON, normalising to a list. Same pattern works for any list-typed env var.
**Prevention:** Any new `list[str]` setting needs a `mode="before"` validator that handles strings.

### L1.4 — Frontend Docker build needs `frontend/public/` to exist
**What bit us:** Next.js standalone build failed because the `public/` directory didn't exist (we hadn't checked anything in there yet).
**Root cause:** Next.js build copies `public/` and errors if it's missing, even if empty.
**Fix:** Commit an empty `public/` directory (use `.gitkeep`).
**Prevention:** When scaffolding a new Next.js project in this repo, always create `public/` even if empty.

### L1.5 — Celery scrapper task routing to a queue the worker doesn't consume
**What bit us:** Scraper tasks were enqueued to the `scraper` queue (per `task_routes` in `celery_app.py`), but the worker started with default `-Q celery`, so tasks sat unconsumed.
**Root cause:** `task_routes` is independent of which queues the worker subscribes to. Two different concepts that must agree.
**Fix:** Worker started with `-Q celery,scraper` in `docker-compose.yml`.
**Prevention:** Whenever you add a new `task_routes` entry, audit the worker command in compose/k8s to make sure it consumes that queue. Consider a startup-time assertion.

### L1.6 — `refresh_token` cookie behaviour invariants
**What bit us:** Sprint 1 refactor moved refresh tokens to HttpOnly cookies but the frontend kept reading from `document.cookie`. Middleware then redirected every protected route to `/login` because the cookie wasn't there client-side.
**Root cause:** HttpOnly cookies are deliberately invisible to JavaScript. The previous architecture relied on client-side cookie reads.
**Fix:** Frontend `axios` uses `withCredentials: true` and trusts the browser to send the cookie automatically. `authStore.setAuth(user, accessToken)` no longer accepts a refresh token. Middleware checks the cookie via `request.cookies.get`, which works server-side.
**Prevention:** When introducing HttpOnly cookies, audit every consumer for `document.cookie` reads and `localStorage` fallbacks. Codified as Rule 11/12 in `CLAUDE.md`.

### L1.7 — Scraper embedder was a stub for ages because nothing failed loudly
**What bit us:** The embedder wrote empty vectors `[]` into `document_chunks.embedding`, so RAG retrieval silently returned zero results until someone noticed in the demo.
**Root cause:** The stub was committed as a placeholder with the intent to fix in a "future prompt" — and the future prompt never came. Tests didn't cover the embedder because the rest of the pipeline tolerated empty vectors.
**Fix:** Sprint 1 replaced the stub with the real OpenAI batched call.
**Prevention:** Stubs must either (a) raise NotImplementedError, or (b) have a tracking task with a deadline. Never leave a "returns empty" stub in a code path that other components consume.

### L1.8 — `password_changed_at` ORM column was missing from the SQL schema
**What bit us:** The `User` ORM declared `password_changed_at` but the migration never created the column. SELECTs failed with "column does not exist" only at runtime.
**Root cause:** ORM and migration drifted because we don't use Alembic autogenerate. Manual SQL migration missed the field added later in the model.
**Fix:** Patched migration `001_initial_schema.sql` directly. Documented as a known issue.
**Prevention:** When you add a column to an ORM model, the same commit MUST update the migration SQL. Add a CI check that diffs `Base.metadata.create_all` against the migration if this happens twice.

---

## Sprint 2 — Anti-Hallucination, Evals, Load Tests

### L2.1 — Both `generate()` and `generate_stream()` must enforce identical safety
**What bit us:** Initial Sprint 2 patch added the insufficient-context guard only to `generate()`. The streaming path bypassed it, so live SSE answers could still hallucinate.
**Root cause:** Two near-duplicate code paths in `llm_service.py` for streaming vs non-streaming, both reachable from `/ask`.
**Fix:** Extracted the safety checks (insufficient-context guard, citation validation, confidence computation, consult-expert fallback) into shared helpers called by both paths.
**Prevention:** Any change to LLM safety logic must touch both `generate` and `generate_stream`. Codified in the eval test suite — both paths are tested.

### L2.2 — Citation validation must report a count, not just a filtered list
**What bit us:** Initial confidence formula divided `valid_citations / total_attempted`, but `total_attempted` was lost after `_validate_citations` returned only the filtered list. We were computing confidence from `valid/valid = 1.0` always.
**Root cause:** Throwing away the pre-filter count.
**Fix:** `_validate_citations` now writes `_stripped_citation_count` back into the response dict so the confidence computer can read it.
**Prevention:** When a function filters a list and a downstream caller needs to know the original size, return the count alongside the filtered result — don't make the caller re-derive it.

### L2.3 — Changing the LLM response schema breaks the frontend silently
**What bit us:** Sprint 2 added `confidence_score`, `consult_expert`, and changed `risk_level` to nullable. The frontend `/ask` page assumed `risk_level` was always a string and crashed in dev.
**Root cause:** No type contract synced between backend Pydantic schemas and frontend TypeScript types.
**Fix:** Frontend hotfix to handle null. The longer-term plan is OpenAPI codegen (TD-03).
**Prevention:** Whenever you add or nullable-ify a field in the LLM response schema, grep the frontend for every consumer of that field and update the type definitions. Codified for Sprint 4 — Confidence Meter UI is the deliberate landing zone for the new fields.

### L2.4 — < 2 chunks short-circuit saves cost AND prevents hallucination
**What bit us:** Early Sprint 2 builds called the LLM even when retrieval returned 0–1 chunks. The LLM filled the gap from training data (hallucinated).
**Root cause:** No quantitative threshold for "enough context".
**Fix:** Insufficient-context guard in `llm_service.generate` returns a `consult_expert` response immediately when `len(chunks) < 2`. No LLM call.
**Prevention:** Treat retrieval depth as a first-class safety signal. Any future RAG-style feature should have an analogous "minimum evidence" check.

---

## Sprint 3 — KG, News Ingest, Public Snippets

### L3.1 — TIMESTAMPTZ columns require `DateTime(timezone=True)` in SQLAlchemy
**What bit us:** First snippet POST returned 500. The error was `can't subtract offset-naive and offset-aware datetimes`. The migration created `expires_at TIMESTAMPTZ`, but the ORM declared `Mapped[datetime | None] = mapped_column()`, which defaults to `TIMESTAMP WITHOUT TIME ZONE`. asyncpg refused to bind a tz-aware datetime to a naive column type.
**Root cause:** SQLAlchemy's `DateTime` type defaults to `timezone=False`. The bare `mapped_column()` infers a type from the Python annotation, which is `datetime` — without timezone hints.
**Fix:** Every TIMESTAMPTZ column in the new models (`kg.py`, `news.py`, `snippet.py`) explicitly declares `mapped_column(DateTime(timezone=True), …)`. Codified as Rule 8 in `CLAUDE.md`.
**Prevention:** Any new ORM model touching a TIMESTAMPTZ Postgres column must use `DateTime(timezone=True)`. If you find yourself writing `mapped_column(server_default="now()")` for a timestamp, ask yourself whether the column is timezone-aware in the migration — it almost always is for this codebase.

### L3.2 — `Limiter` instantiated in `main.py` causes a circular import the moment a router uses it
**What bit us:** Adding `@limiter.limit("60/minute")` to the snippets router required `from app.main import limiter`. But `app/main.py` already imports the snippets router. Circular import → ImportError at startup.
**Root cause:** `main.py` is the wrong home for shared infrastructure singletons. Anything routers need must live in a module that does NOT import routers.
**Fix:** Extracted `limiter = Limiter(...)` into `app/rate_limit.py`. Both `main.py` and any router import from there.
**Prevention:** Any new singleton that routers will consume (limiters, metrics registries, feature flags) belongs in its own module under `app/`, never in `app/main.py`. The same rule applies to redis clients, anthropic clients, etc. — the lifespan context wires them up, but the *type definitions* live elsewhere.

### L3.3 — Container backend has no bind mount; `docker cp` is the only way to iterate live
**What bit us:** Edited `backend/app/models/snippet.py` on the host, restarted the backend, and the change wasn't picked up. The container has the code baked into the image.
**Root cause:** `docker-compose.yml` bind-mounts the database init SQL but not the backend source. Production parity was prioritised over dev iteration speed.
**Fix:** Use `docker cp file regpulse-backend:/app/...` after each edit, then `docker restart regpulse-backend`. For the scraper container the path is `/scraper/...`.
**Prevention:** Document the live-iteration commands at the top of any sprint that touches backend or scraper. Or — better — add an opt-in `docker-compose.dev.yml` overlay with bind mounts. Tracked as a future improvement.

### L3.4 — Sprint 1 fixed the embedder in the repo but not in the running scraper image
**What bit us:** Pillar B (RSS news ingest) failed on first run with "vector must have at least 1 dimension" because the scraper container was still running the old stub embedder image. The repo had the real embedder since `363b1ef`, but the scraper container had been built before that commit.
**Root cause:** Long-running container plus in-place edits via `docker cp` had been syncing only the files I'd touched. The unrelated `embedder.py` was stale.
**Fix:** `docker cp scraper/processor/embedder.py regpulse-scraper:...` and the bug went away.
**Prevention:** When you start work on any sprint, rebuild the relevant containers from source first: `docker compose build backend scraper && docker compose up -d backend scraper`. Don't trust that a running container reflects the current `main`.

### L3.5 — pgvector cosine query against an empty embedding vector errors hard
**What bit us:** During the first ingest_news run, the embedder returned `[[]]` (one item, empty vector) — but my check was `if not vectors: return None, None`, which only catches the outer empty list. We then formatted `'[]'` as a vector literal and pgvector raised "vector must have at least 1 dimension".
**Root cause:** Insufficient empty-check.
**Fix:** `if not vectors or not vectors[0]: return None, None`.
**Prevention:** When defending against "embedder returned nothing", check both the outer list AND the first inner element. Same pattern applies to any external service that returns nested data.

### L3.6 — psycopg2 transaction abort poisons subsequent queries in the same session
**What bit us:** Pillar B's first run inserted 0/60 news items. The first failing INSERT (caused by L3.5) aborted the transaction, then every subsequent INSERT in the same `with get_db_session():` block failed with "current transaction is aborted, commands ignored until end of transaction block".
**Root cause:** Postgres transactions are atomic — one failure aborts the whole TX until rollback. Iterating a loop inside a single TX without per-item isolation is a footgun.
**Fix:** Each loop iteration runs inside `with db.begin_nested():` (a SAVEPOINT). One failure rolls back its own savepoint without affecting siblings.
**Prevention:** Any batch loop that does multiple writes inside one outer TX should wrap each iteration in `begin_nested()`. Treat this as the default for batch ingest.

### L3.7 — Frontend uses pnpm; running `npm install` produces a stray `package-lock.json`
**What bit us:** I needed `tsc` to type-check the new frontend pages, `frontend/node_modules` didn't exist, and I ran `npm install`. That created `frontend/package-lock.json`. Almost committed it.
**Root cause:** Repo standard is pnpm (`pnpm-lock.yaml` is in git history). I didn't check before installing.
**Fix:** Removed `package-lock.json` before staging. Should have used `pnpm install` from the start.
**Prevention:** Before installing frontend deps, run `git log --all --diff-filter=A --name-only -- 'frontend/*lock*'` to check which lockfile the repo expects. Add a `frontend/.npmrc` with `package-lock=false` as a guard.

### L3.8 — Pytest inside the backend container has unrecoverable sys.path collisions
**What bit us:** Tried to run new unit tests via `pytest` inside the backend container. Pytest auto-prepends `/` to `sys.path` (because `tests/__init__.py` exists but `/app/__init__.py` doesn't), which makes Python treat `/app/` as the `app` namespace package — shadowing the real `app` package living at `/app/app/`. Every conftest import of `from app.cache import get_redis` then failed.
**Root cause:** The backend container's `WORKDIR=/app` collides with the package name `app`. Pytest's rootdir-based collection assumes the parent of the package is on sys.path, but in this layout the parent is `/`, which Python treats as a namespace package source.
**Fix:** I tried multiple workarounds (custom conftest at /app, pytest.ini with `pythonpath=.`, `--rootdir`, `--confcutdir`) — none of them worked because the conftest at `/app/tests/conftest.py` loads BEFORE my conftest's sys.path repair code, and once `app` is cached as a namespace package, deleting it from `sys.modules` mid-import breaks the loading conftest itself.
**Workaround used:** Run new unit tests as plain python scripts that import the module directly. CI runs them properly via `PYTHONPATH=backend pytest backend/tests/unit/` from the project root, where this collision doesn't exist.
**Prevention:** Never try to run pytest from `/app` inside the backend container. Always run from outside with `PYTHONPATH=backend pytest backend/tests/...`. If you absolutely need in-container pytest, the proper fix is to rename the package from `app` to `regpulse_backend` — out of scope for one sprint.

### L3.9 — Celery broker URL DB number matters
**What bit us:** First `celery call scraper.tasks.ingest_news` returned a task ID but the worker never executed it. The CLI used `-b redis://redis:6379/0` (default), but the scraper worker is configured to consume from `/1` (set via `REDIS_URL` in `.env`). Tasks landed in db 0; worker watched db 1.
**Root cause:** Redis db number is part of the broker identity. Two clients pointing at the same host but different db numbers might as well be different brokers.
**Fix:** `celery -A celery_app -b redis://redis:6379/1 call ...` matches the worker's actual broker.
**Prevention:** Always pass `-b $REDIS_URL` (or omit `-b` and let celery_app's defaults take over) when triggering tasks manually. Document the broker URL alongside the docker exec snippet in `CLAUDE.md`.

### L3.10 — Public snippet redaction must be enforced at the SERVICE layer, not the router
**What bit us (could have):** It's tempting to build the snippet payload in the router by reading fields off the question record and packing them into the response. That puts the redaction guarantee one `model_dump()` away from leaking `detailed_interpretation`.
**Root cause/risk:** Routers are easy to refactor; field expansion is a one-line accident.
**Fix:** `snippet_service._build_safe_snippet` is the ONLY function that reads from a `Question` record on the snippet path. It returns `(snippet_text, top_citation_dict, consult_expert)`. The router never sees the question. Unit test `test_detailed_interpretation_never_leaks` asserts the FULL ANSWER text never appears in the output, including in the citation dict's string repr.
**Prevention:** Any "redacted projection" of a sensitive record belongs in a service function that returns a fully-baked safe payload. Never let a router touch the source record and pick fields.

### L3.11 — News must NEVER end up in the RAG retrieval corpus
**What bit us (could have):** RSS news items contain banking-relevant text. The "obvious" optimisation would be to embed them and add them to `document_chunks` so RAG can find them. That breaks the "answers cite RBI circulars only" guarantee.
**Root cause/risk:** Loose framing of "anything regulation-relevant goes in the RAG store" would corrupt the cite-worthy corpus with un-vetted news content.
**Fix:** News lives in `news_items`, surfaced only in `/updates`. The embeddings used to LINK news to circulars (`news_relevance.py`) are computed on the fly and discarded — they never persist into `document_chunks`. Documented as Rule 12 in `CLAUDE.md`.
**Prevention:** Treat `document_chunks` as sacred. Anything that ends up there can be cited by the LLM as authoritative. If a future ingest source isn't RBI, it goes in its own table.

### L3.12 — KG-driven RAG expansion must default OFF
**What bit us (could have):** The KG expansion path in `rag_service._kg_expand` adds chunks from graph-neighbour circulars with a small RRF boost. Enabling this silently changes retrieval precision and recall in production. Without the Confidence Meter UI (Sprint 4), users have no way to see when an answer drew on expanded context.
**Root cause/risk:** "Built and merged" easily becomes "rolled out" if the rollout gate isn't explicit.
**Fix:** `RAG_KG_EXPANSION_ENABLED` defaults to `false` in both `app/config.py` and `.env.example`. The check is at the top of `_kg_expand`; the function is a no-op when the flag is off.
**Prevention:** Any new optional retrieval / scoring tweak ships as `_ENABLED=false`. Operators flip it deliberately AFTER (a) the golden dataset eval still passes with the flag on, and (b) the UI surfaces the new signal.

### L3.13 — OG image URL must point at the backend host, not the frontend
**What bit us:** First implementation generated `og_image_url = f"{FRONTEND_URL}/api/v1/snippets/{slug}/og"`, which was wrong on two counts: (a) LinkedIn/X fetch the OG image from whatever URL we emit, and the frontend doesn't proxy `/api/v1/*` to the backend; (b) in production these are different domains entirely.
**Root cause:** Conflating "where the user lands" (`FRONTEND_URL`) with "where the public API lives" (`BACKEND_PUBLIC_URL`).
**Fix:** Added `BACKEND_PUBLIC_URL` config. `_og_image_url` uses it (falls back to `localhost:8000` for demo).
**Prevention:** Any URL that a third-party crawler must fetch directly should be built from `BACKEND_PUBLIC_URL`, not `FRONTEND_URL`. Webhooks and OG images are the obvious cases; auth callbacks are another.

---

## Cross-Sprint Patterns

### LX.1 — Memory drift between point-in-time notes and live state
**What bit us:** Started a session believing the demo was "awaiting feedback before next dev cycle" (per a 15-day-old memory entry). Reality: Sprint 1 had landed earlier the same day and Sprint 2 was already partly committed. Built a working theory off stale data.
**Fix:** Always run `git log --oneline -10` and `git status` at the start of any session before consulting memory. Treat memory as a starting hypothesis, not ground truth.
**Prevention:** Codified in the memory system rules — "Before recommending from memory, verify against current code." Already documented; this entry is a reminder that the rule is load-bearing.

### LX.2 — Stub fixtures and "future prompt" placeholders accumulate silently
**What bit us:** L1.7 (embedder stub) is the headline example. Other examples: `process_document` Step 6 INSERT discards `_embeddings` (TD-08, found during Sprint 3 backfill); `admin_audit_log.actor_id NOT NULL` blocks scraper writes (TD-04, still open).
**Root cause:** "Done for now, will fix in the next prompt" without a tracking artifact.
**Fix:** Tracked as TD-NN entries in `MEMORY.md` Technical Debt table.
**Prevention:** Every stub or placeholder gets a TD-NN entry with a one-line plan AT THE TIME OF COMMIT. No exceptions.

### LX.3 — Container parity vs dev iteration is a real tradeoff
**What bit us:** L3.3 (no bind mount) and L3.4 (stale baked-in code) both stem from prioritising prod parity in `docker-compose.yml`. The cost is friction every time we touch backend or scraper code mid-session.
**Root cause:** `docker-compose.yml` is doing double duty as a prod-like config and a dev environment.
**Fix:** None yet — just documenting the friction.
**Prevention:** Future work — split into `docker-compose.yml` (prod-parity baseline) and `docker-compose.dev.yml` (overlay with bind mounts and `--reload`). Until then, plan sprint work assuming you'll need `docker cp` + restart for every backend/scraper edit.

### LX.4 — Document changes invalidate the test count in the docs
**What bit us:** Spec said "30 anti-hallucination test cases" but the actual dataset has 28. Both numbers lived in `CLAUDE.md`, `MEMORY.md`, and `spec.md`. None matched the truth.
**Root cause:** Counts duplicated across multiple docs without a single source.
**Fix:** Treat `golden_dataset.json`'s `test_cases` length as the authoritative count. Don't repeat the number in prose.
**Prevention:** Any number that comes from data (test counts, table counts, route counts) should appear in at most one doc, and ideally be derivable from the data itself. When you can't avoid duplicating it, audit all copies in the same commit.

---

## Process Learnings

### LP.1 — `git push` is not implicit
**What bit us:** Sprint 3 landed locally on `main` with 5 commits. I called the sprint "complete" before pushing. The user had to ask explicitly.
**Fix:** Always confirm push status when wrapping a sprint.
**Prevention:** Per the standing rule, I won't push without authorization, but I should always SURFACE the local-vs-remote gap at sprint completion so the user knows it's the next step.

### LP.2 — "Verified manually" isn't the same as "tests pass"
**What bit us:** I called Pillar C complete after verifying the snippet flow end-to-end with curl, but I never re-ran the existing 28 anti-hallucination tests against the post-Sprint-3 backend. The user asked "all evals tested?" and I had to answer no.
**Fix:** A sprint that touches `rag_service.py`, `llm_service.py`, or any retrieval/answer code MUST end with the golden dataset eval re-run.
**Prevention:** Add an "evals re-run" step to every sprint's exit checklist. Treat it as non-negotiable for any change to retrieval or answer logic.

### LP.3 — Frontend tests need installed deps; the CI environment isn't free
**What bit us:** First attempt to type-check the frontend failed because `frontend/node_modules` didn't exist locally. Had to install everything before I could verify a 5-line change.
**Fix:** Run `pnpm install` once at the start of any session that will touch the frontend.
**Prevention:** Frontend session warmup: `cd frontend && pnpm install` before any TypeScript edits. Shouldn't be necessary for backend-only work.
