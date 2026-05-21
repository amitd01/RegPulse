# HANDOVER — Next Session

> **Read this first** when picking up RegPulse. Captures session-of-record state
> (2026-05-21), the active branch landscape, what blocks PR #16, and quick
> resumption commands. Distinct from `TEAM_HANDOVER.md` (external-team
> onboarding), which is stale (last updated 2026-05-19, pre-rebuild merge).

---

## 1. Where things stand

PR #16 (`merge/rebuild-into-main` → `main`) is open and **38 commits ahead of `main`**. It carries the full rebuild S1→S10 + S4b.1 + S4b.2 + L-Merge.1 fix + the GCP Phase A deploy work, plus session-close hygiene (TOOLING.md, README refresh, MEMORY trim, .gitignore expansion). Local test gates all green:

| Gate | Count | Notes |
|---|---|---|
| pytest unit | 155 / 155 | SQLite + fakeredis |
| Playwright E2E | 14 / 14 | Against `docker compose up` stack |
| pytest integration | 25 authored | Skip-loudly without `REGPULSE_INTEGRATION_DB_URL` |
| `tsc --noEmit` | green | Strict mode |
| Design-system grep | 0 hits | `frontend/src/app/` |
| Local RBI corpus | 150 circulars | All with `structured_content IS NOT NULL` |

---

## 2. Branch landscape — DO NOT DELETE WITHOUT OWNER CONFIRMATION

Multiple teams have work in flight. Per session policy, no destructive branch operations.

| Branch | Tip | Owner | Status | Last activity | Recommendation |
|---|---|---|---|---|---|
| `main` | `538f79b` | amitd01 | **Behind** — only carries the "Add files via upload" baseline | 2026-05-19 | Wait for PR #16 review |
| `merge/rebuild-into-main` | `51c8c36` | amitd01 (this session) | **Active — PR #16 open**, 38 ahead of main, gates green | 2026-05-21 | Merge into main once side-experiment reconciliation is decided |
| `claude/assess-repo-tasks-MwGFU` | `d668cda` | Claude (PR #14) | **Fully forwarded** — 0 commits unique vs `merge/rebuild-into-main`; PR #14 is open but superseded by PR #16 | 2026-05-19 | Close PR #14 once PR #16 merges; branch is safe to delete |
| `dev` ≡ `feature/new-regpulse` | `d931fb6` | **Mayur Talreja (Think360)** | **Active side experiment** — 20 commits unique vs `merge/rebuild-into-main`; both branches share the same tip. Last touch was a "resolved conflicts" merge on `(app)/layout.tsx` removing our auth-bootstrap gate | 2026-05-20 | **Do not delete.** Reconciliation conversation needed before PR #16 merges — see § 3 |
| `fix/access-token` | `bc53055` | **Akshay Rathod** | **In-flight feature branch** — 16 commits unique vs `merge/rebuild-into-main`; was merged into Mayur's `dev` via PR #13 but exists separately. Akshay's last commit fixed a refresh-token bug | 2026-05-19 | Keep until Akshay confirms the work is folded; PR #13 already merged into dev |

### Verification commands

```bash
git fetch --all --prune
git log --oneline origin/merge/rebuild-into-main..origin/dev | head -20         # what Mayur has that we don't
git log --oneline origin/merge/rebuild-into-main..origin/fix/access-token       # what Akshay has that we don't
git rev-list --left-right --count origin/main...origin/merge/rebuild-into-main  # 0   38
git rev-list --left-right --count origin/merge/rebuild-into-main...origin/dev   # 49  20
```

---

## 3. The Mayur reconciliation — must resolve before PR #16 merges

**The conflict surface is real, not cosmetic.** Mayur's `dev` branch carries a parallel UI architecture that diverges from the rebuild's design system in three specific ways:

1. **Custom Tailwind config** (`frontend/tailwind.config.ts` +59 lines). The rebuild's rule 15 explicitly forbids `bg-navy-*` / `text-navy-*` Tailwind utilities — design tokens live in `globals.css` as CSS custom properties. Mayur's tailwind config additions may reintroduce the navy palette as a Tailwind layer.
2. **New landing page architecture** — `landing.css` (1010 lines), `LandingNavbar.tsx`, `LandingScrollHint.tsx`, `landingData.tsx`, `RegPulseLogo.tsx`. The rebuild's `/page.tsx` is the v2 paper hero with 3 numbered feature panels. These are competing landings.
3. **Different `(app)/layout.tsx` architecture** — Mayur removes our `AppShell` + `useAuthStore` direct usage, replaces with `AppSidebar` + `TopBar` + `AuthProvider` (provider pattern). The "resolved conflicts" commit on 2026-05-20 explicitly removed our auth-bootstrap gate (L-Merge.1 fix). If their `AuthProvider` solves the bootstrap race differently, fine — but **the race must still be guarded**, otherwise every authenticated page goes back to the 403/mock-fallback bug.

### Other substantive changes on Mayur's branch (likely good)

- `fix: getting html document instead of pdf` — scraper crawler fix; **probably overlaps with our S4b.2 URL filter fix**. Check if Mayur's approach is different/better.
- `Update: fixed the vector pg column data type to 1536` — **conflicts** with rebuild's 3072-dim choice (rule: don't downgrade embeddings). Likely a Cloud SQL ANN-cap workaround. Cloud SQL pgvector caps at 2000 dims for ANN indexes — see `TOOLING.md`; the rebuild's stance is "sequential scan only, 3072 dims stays."
- `add backfill_chunks script to regenerate missing document_chunks` — useful, probably orthogonal.
- `Update: added cors` — overlaps with `fix(backend): cross-site cookie support` in our branch.
- `Update: Fixed the stream cache response` (PR #12 — merged to dev) — likely overlaps with our `_stream_cached_response` SSE work in S4b.2.

### Recommended next-session action

Before doing anything else, **fetch and read Mayur's last 5 commits in detail** (`git log -p origin/dev --since=2026-05-15`), then have a written reconciliation note that pairs each of their commits to either:
- (a) Already covered by our rebuild — close as duplicate
- (b) New value — port forward to our branch
- (c) Conflicts with the rebuild's quality bar — discuss/reject

Until that reconciliation lands, **merging PR #16 will silently overwrite Mayur's work** on every file in the conflict set (auth layout, landing page, library page, ask page, history page, etc.). The merge needs to be deliberate.

---

## 4. Outstanding work after PR #16

Listed in suggested priority order:

1. **CI E2E gate** (per L-Merge.1 prevention rule #1) — wire `make e2e` into pre-merge CI. The L-Merge.1 / L-S4b.2 defects were both caught by Playwright running against a real stack, *not* by unit tests. Without this gate, the next slice can ship green-unit-but-red-Playwright again.
2. **GCP Phase B** — Workload Identity Federation, staging environment, CI image build & push, deploy script that reads FRONTEND_URL from `gcloud run services describe` (per LEARNINGS L9.8).
3. **GCP Phase C** — Real RBI scrape against prod Cloud SQL, observability alerts, smoke checklist, `v1.0.0` tag.
4. **TD-AUTH** — Backend auth chain returns 403 for missing tokens; axios interceptor only retries 401. The layout-gate fix from L-Merge.1 masks the symptom but the underlying mismatch is a latent footgun. See `MEMORY.md § Technical Debt`.
5. **TD-ASK-JSON** — `/ask` page renders raw LLM JSON envelope as markdown for non-consult-expert answers (surfaced by S4b.2's off-domain Playwright test). Frontend should parse the JSON and render `detailed_interpretation`, or backend should stream parsed prose tokens only.
6. **TD-LIB-FALLBACK** — `/library` + `/saved` collapse `isLoading` / `isError` / `data === []` into one mock-fallback branch. Should distinguish; mocks are only for the genuinely-empty case (L-Merge.1 prevention rule #3).
7. **CORS-DEMO-1** (LEARNINGS L9.6) — cross-site cookie + Next.js middleware mismatch on `*.run.app`. Durable fix is custom-domain wiring (`regpulse.in` + `api.regpulse.in` with `Domain=.regpulse.in` cookie). Phase B/C work.

---

## 5. Session-resumption quickstart

```bash
# 0. Pull latest
cd /Users/amitdas/claude/Repos/RegPulse
git fetch --all --prune
git status
git log --oneline -5

# 1. Bring up the local stack (if not running). Postgres volume persists, so
#    the 150-circular corpus from this session should still be there. If not:
docker compose up -d postgres redis backend scraper
docker exec regpulse-postgres psql -U regpulse -d regpulse -c \
  "SELECT COUNT(*) FROM circular_documents WHERE structured_content IS NOT NULL;"
# Expect: 150+ if volume persisted; 0 if wiped.

# 2. Re-trigger the scrape if needed
docker exec -d regpulse-scraper sh -c \
  'python -m scraper.run_oneshot priority > /tmp/scrape.log 2>&1'
docker exec regpulse-scraper tail -f /tmp/scrape.log

# 3. Boot frontend prod server (Playwright targets :3000)
cd frontend && node_modules/.bin/next build && \
  node_modules/.bin/next start -p 3000 > /tmp/next-start.log 2>&1 &

# 4. Run the gate
node_modules/.bin/playwright test                                  # 14/14 expected
cd ../backend && ../.venv/bin/python -m pytest tests/unit -q       # 155/155 expected
```

---

## 6. Things to be careful about (gotchas the session uncovered)

- **Host postgres on port 5432 collides with docker postgres.** Pytest from the host hits the host postgres, not the container. Either stop the host service, set `POSTGRES_HOST_PORT=5433` in compose, or run integration tests inside the backend container against `postgres:5432` over the docker network. See `TOOLING.md`.
- **Container has `/app/__init__.py` which breaks pytest rootdir detection.** Pytest walks up looking for the first dir without `__init__.py`; with that file present, rootdir becomes `/` and `app.cache` can't be imported. Workaround: drop a `/app/pytest.ini` with `pythonpath = .`. Better fix: delete `backend/__init__.py` on host (also exists there — also confusing).
- **Answer cache hits are tricky.** A warm cache returns the original asker's `Question.id` to every subsequent user. The S4b.2 fix inserts a fresh per-user row on cache hit (no credit deduction), and frames SSE events. If you touch the cache code path, preserve this — the Save → /saved → /history loop depends on the per-user row existing.
- **Real RBI scrape: don't trust the GCP Cloud Run Job's success as proof the local docker compose scraper works.** Their CMDs were latently divergent. The S4b.2 fix aligned both.
- **Don't run `git push --force` on `main` or `merge/rebuild-into-main`** — these are the integration trunks. Side-experiment branches (`dev`, `feature/new-regpulse`, `fix/access-token`) are owned by Mayur/Akshay; don't push to them at all.

---

## 7. Pointers

- `MEMORY.md` § Status — current rebuild state, GCP snapshot, ADRs, tech debt
- `LEARNINGS.md` § L-Merge.1, § L-S4b.2 — the two big lessons from this session
- `TOOLING.md` — env pins + resolved troubleshooting (new this session)
- `CLAUDE.md` § Rebuild Progress — slice-by-slice tracker
- `PRODUCTION_PLAN.md` — GCP Phases A → C roadmap
- PR #16: https://github.com/amitd01/RegPulse/pull/16

---

*Generated at session close. If this file is more than a week old, regenerate
from current branch state — `git log --since="7 days ago"`, branch tips, open
PRs, test counts.*
