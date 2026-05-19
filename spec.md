# RegPulse — Technical Specification

> **Living spec.** Reflects current rebuild state, not the pre-rebuild "v1.0.0-rc" framing. For architecture rules see `MEMORY.md`. For build progress see `CLAUDE.md`. For PRD/FSD see `RegPulse_PRD_v4.md` / `RegPulse_FSD_v4.md`.

---

## 1. System Overview

RegPulse is a B2B SaaS platform delivering RAG-powered Q&A over RBI Circulars for Indian banking compliance professionals. Two modules: a Celery scraper that indexes RBI documents into pgvector with both retrieval chunks and a structured-document tree; and a FastAPI + Next.js web app that retrieves and answers questions with cited sources.

```
rbi.org.in → Scraper (Celery/Redis) → PostgreSQL+pgvector
                                            ↕
                                     FastAPI (/api/v1/)
                                            ↕
                                  Next.js 14 (app router)
                                            ↕
                                  LLM (claude-sonnet / gpt-4o)
```

**Rebuild status.** Foundation reused; PDF extractor rewritten to produce structured documents; document renderer rewritten on the frontend; remaining non-v2 routes (auth, admin, landing, snippet share, detail pages) ported to v2 design tokens; test infrastructure expanded with Playwright E2E + pgvector integration suite in CI.

---

## 2. Database Schema

**19 tables.** Ground truth: `backend/migrations/001..005.sql`. Slice 4 adds `circular_documents.structured_content JSONB` for the renderer.

### Users & Auth
| Table | Key columns | Notes |
|---|---|---|
| `users` | email, email_verified, full_name, designation, org_name, org_type, credit_balance, plan, plan_expires_at, plan_auto_renew, is_admin, is_active, bot_suspect, last_login_at, last_credit_alert_sent, last_seen_updates, deletion_requested_at | Work-email gated, OTP auth |
| `sessions` | user_id, token_hash, expires_at, revoked | Refresh token store |
| `pending_domain_reviews` | domain, email, mx_valid, reviewed, approved, reviewed_by | Flagged low-traffic domains |

### Circulars & Chunks
| Table | Key columns | Notes |
|---|---|---|
| `circular_documents` | circular_number, title, doc_type, department, issued_date, effective_date, rbi_url, status, superseded_by, ai_summary, pending_admin_review, impact_level, action_deadline, affected_teams (JSONB), tags (JSONB), regulator, scraper_run_id, indexed_at, **structured_content (JSONB)** | Never hosts PDFs; structured_content = renderer source |
| `document_chunks` | document_id, chunk_index, chunk_text, embedding vector(3072), token_count | Retrieval source only — never rendered to users |

### Q&A
| Table | Key columns | Notes |
|---|---|---|
| `questions` | user_id, question_text, question_embedding vector(3072), answer_text, quick_answer, risk_level, confidence_score, consult_expert, recommended_actions (JSONB), affected_teams (JSONB), citations (JSONB), chunks_used (JSONB), model_used, prompt_version, feedback, feedback_comment, admin_override, reviewed, credit_deducted, streaming_completed, latency_ms | Core Q&A record |
| `action_items` | user_id, source_question_id, source_circular_id, title, description, assigned_team, priority, due_date, status | Auto-generated from `recommended_actions` |
| `saved_interpretations` | user_id, question_id, name, tags (JSONB), needs_review | Staleness flag on re-index |

### Admin & Config
| Table | Key columns |
|---|---|
| `prompt_versions` | version_tag (unique), prompt_text, is_active, created_by |
| `admin_audit_log` | actor_id, action, target_table, target_id, old_value (JSONB), new_value (JSONB), ip_address |
| `analytics_events` | user_hash, event_type, event_data (JSONB), session_id, ip_address, user_agent |
| `manual_uploads` | admin_id, filename, status, document_id, error_message |
| `question_clusters` | cluster_label, representative_questions, centroid, period_start/end |

### Sprint 3 (KG, news, snippets)
| Table | Key columns |
|---|---|
| `kg_entities` | entity_type, canonical_name, aliases (JSONB) |
| `kg_relationships` | source/target_entity_id, relation_type, source_document_id |
| `news_items` | source, external_id, title, url, linked_circular_id, relevance_score |
| `public_snippets` | slug, question_id, snippet_text, top_citation, consult_expert |

### Payments + Scraper
| Table | Key columns |
|---|---|
| `subscription_events` | user_id, order_id, razorpay_event_id (unique), plan, amount_paise, status |
| `scraper_runs` | status, documents_processed/failed |

Indexes: ivfflat on `document_chunks.embedding` (lists=100), GIN on FTS + citations + tags JSONB, btree on FKs/status/timestamps.

---

## 3. Document Storage & Rendering

The scraper emits two outputs from a single PDF source:

| Output | Stored in | Shape | Consumer |
|---|---|---|---|
| Retrieval chunks | `document_chunks` (existing) | 512-token sliding windows, 64-token overlap, embedded with `text-embedding-3-large` (3072-dim) | Vector ANN + FTS for RAG |
| Structured document | `circular_documents.structured_content` (slice 4) | JSONB tree: `{type: "heading"\|"paragraph"\|"table"\|"list", level, text, children}` | `/library/[id]`, `/history/[id]`, `/s/[slug]` renderers |

The slice-4 extractor uses pdfplumber's table API + heading-detection heuristics (font-size deltas, position) to reconstruct hierarchy. **Retrieval shape and reading shape are never the same data.** Rendering retrieval chunks directly is explicitly reversed (ADR A30).

---

## 4. API Specification

All routes under `/api/v1/`. OpenAPI spec auto-generated by FastAPI; consumed by `openapi-typescript` codegen to produce `frontend/src/lib/api/generated/*`.

| Group | Routes | Auth |
|---|---|---|
| Auth | `/auth/register`, `/auth/verify`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Public |
| Account | `/account`, `/account/export`, `/account/delete` | Active user |
| Circulars | `/circulars`, `/circulars/{id}`, `/circulars/search`, `/circulars/updates`, `/circulars/updates/mark-seen`, `/circulars/autocomplete`, `/circulars/departments`, `/circulars/tags` | Mixed |
| Q&A | `POST /questions` (SSE), `GET /questions`, `/questions/{id}`, `/questions/{id}/feedback`, `/questions/{id}/export`, `/questions/suggestions` | Credits |
| Action items | `/action-items`, `/action-items/stats`, `/action-items/{id}` | Verified |
| Saved | `/saved`, `/saved/{id}` | Verified |
| Subscriptions | `/subscriptions/plans`, `/subscriptions/create-order`, `/subscriptions/webhook` (HMAC) | Mixed |
| Snippets | `POST /snippets`, `GET /s/{slug}` (public) | Mixed |
| News | `/news`, `/news/{id}` | Verified |
| **New (slice 9)** | `/learnings`, `/debate`, `/feedback/structured` | Verified |
| **New (slice 10)** | `/annotations` | Verified |
| Admin | `/admin/*` (8 sub-routes) | Admin |

All errors: `{"success": false, "error": "...", "code": "..."}`.

---

## 5. RAG Pipeline

```
1. Normalise + SHA256 hash → Redis cache check (24h TTL, no credit)
2. Embed question via text-embedding-3-large → Redis-cached
3. PARALLEL: pgvector cosine ANN + PostgreSQL FTS (WHERE status='ACTIVE')
4. RRF fusion: score = Σ 1/(60 + rank_i)
5. Dedup: max RAG_MAX_CHUNKS_PER_DOC per document
6. Cross-encoder rerank (ms-marco-MiniLM-L-6-v2, ProcessPoolExecutor, 30s timeout) → top K
   ↑ ALWAYS on, including DEMO_MODE
7. KG expansion (canonical entities → linked chunks) if enabled
8. Insufficient context guard: < 2 chunks → consult-expert (no LLM call)
9. Injection guard (regex) + XML-wrapped prompt → LLM
10. Anthropic claude-sonnet-4-20250514 (10k thinking budget); on typed Anthropic exception → OpenAI gpt-4o fallback (slice 10 wraps with pybreaker)
11. Validate citations → strip circulars not in retrieved chunks
12. Confidence score (3 signals): retrieval coherence × citation coverage × answer specificity
13. Confidence < 0.5 OR zero valid citations → consult-expert
14. INSERT question row → cache answer → SSE/JSON to client → deduct credit
```

LLM returns: `{quick_answer, detailed_interpretation, risk_level, confidence_score, consult_expert, affected_teams, citations[], recommended_actions[]}`.

---

## 6. Auth + Security

- OTP register/login flow: work-email-gated (250+ blocklist + MX check); 6-digit code; 10 min TTL; 5 attempts; `DEMO_MODE` fixes to `123456`
- JWT: RS256, 15-min access token in Zustand memory; refresh as HttpOnly + Secure + SameSite=lax cookie; jti blacklist in Redis on logout
- Bot suspect heuristic: domain age, MX validity, registration cadence; flagged users gated until admin review
- Rate limits: slowapi behind Cloud Run / Nginx `X-Forwarded-For`
- PII never to LLM; injection guard before LLM call; citation validation after
- Admin mutations → `admin_audit_log`; non-mutating admin (sandbox) → `analytics_events`
- DPDP: account delete anonymises PII, deletes sessions/saved/actions, nullifies question.user_id; data export returns JSON

---

## 7. Subscription Plans

| Plan | Credits/mo | Price (₹) | Notes |
|---|---|---|---|
| Free | 5 lifetime | 0 | One-time grant on email verify |
| Starter | 50 | 999 | Razorpay one-time, manual renew |
| Pro | 200 | 2,999 | Auto-renewal supported (slice 9 already shipped pre-rebuild) |
| Enterprise | 1000+ | Custom | Manual provisioning |

Webhook at `/subscriptions/webhook` — HMAC-SHA256, excluded from CORS. Renewal reminder Celery task daily 08:00 IST. Low-credit notification at balance 5 + 2.

---

## 8. Scraper Pipeline

```
1. RBI listing crawler (rbi.org.in) → discover circular URLs
2. PDF fetch → pdfplumber/pypdf
3. STRUCTURAL extract (slice 4): heading detection + table reconstruction + list parsing → JSON tree
4. Linear text → chunker (512-token windows, 64-token overlap)
5. Embedder: text-embedding-3-large batch
6. Metadata extractor: circular number, dept, date, doc_type, impact
7. Entity extractor → kg_entities + kg_relationships
8. Supersession resolver → mark old version status='SUPERSEDED'
9. News relevance: RSS items embedded → cosine-link to nearest circular (≥ 0.65)
10. Write to circular_documents (with structured_content) + document_chunks
```

Celery beat schedules: `daily_scrape` (06:00 IST), `daily_rss_fetch` (07:00), `subscription_renewal_check` (08:00), `low_credit_notify` (every 6h), `staleness_check` (daily 09:00), `weekly_clustering` (Sunday 02:00).

---

## 9. Frontend Pages (27 routes, all v2 post-rebuild)

| Group | Routes |
|---|---|
| Public | `/` (landing), `/s/[slug]` (snippet share) |
| Auth | `/(auth)/{login, register, verify}` |
| App | `/(app)/{dashboard, ask, library, library/[id], updates, history, history/[id], saved, action-items, learnings, debate, upgrade, account}` |
| Admin | `/admin/{*}` (8 sub-routes + dashboard + heatmap) |

Design system: CSS custom-property tokens in `frontend/src/app/globals.css`; primitives in `components/design/Primitives.tsx`; shell in `components/shell/`; light + dark via `html.dark` class; serif (Source Serif 4) for editorial brief headers + answers; mono (JetBrains Mono) for tickers/IDs/badges; sans (Inter Tight) for everything else.

---

## 10. Testing

| Layer | Tool | Where it runs |
|---|---|---|
| Backend unit | pytest + SQLite + fakeredis | `pytest backend/tests/unit` — gate in CI |
| Backend integration | pytest + ephemeral PG (pgvector) + Redis containers | `pytest backend/tests/integration` — gate in CI |
| Backend evals | pytest + real OpenAI embeddings + real PG | `make eval` — gate on PRs touching RAG |
| Frontend E2E | Playwright | `pnpm -C frontend exec playwright test` — gate in CI against `docker compose up` |
| Frontend visual | Playwright snapshots | Slice 7 admin port |
| Load | k6 | smoke / load / spike scenarios in `tests/load/` |

**No slice merges without integration-green + Playwright-green on the MVP journey.**

---

## 11. Configuration

`.env.example` ships dev-safe defaults so `pytest` runs cleanly from a fresh clone. Required at production: real `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RAZORPAY_*`, `SMTP_*`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`.

`DEMO_MODE=true` changes: fixed OTP `123456`, work-email validation skipped, dummy payment + email keys. **Reranker, citation validation, confidence scoring, KG expansion remain on.**

---

## 12. Localhost Deployment

```bash
cp .env.example .env       # dev defaults already filled
docker compose up --build -d
make e2e                   # Playwright suite against running stack
```

Six containers: postgres (pgvector), redis, backend, scraper, celery-beat, frontend. Schema auto-applied via initdb.d mount. Reranker model pre-baked into dev Dockerfile cache so no HuggingFace download at startup.
