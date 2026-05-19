.PHONY: help up down logs build lint test-backend test-frontend test-integration migrate seed clean eval e2e dev-env api-codegen

help:
	@echo "RegPulse Development Commands:"
	@echo ""
	@echo "  make dev-env         Generate dev RSA keypair into .env (one-time setup)"
	@echo "  make up              Start all services (docker compose)"
	@echo "  make down            Stop all services"
	@echo "  make logs            Follow logs (all services)"
	@echo "  make build           Build all Docker images"
	@echo "  make lint            Run ruff + black (backend) + eslint (frontend)"
	@echo "  make test-backend    Run backend pytest (unit)"
	@echo "  make test-integration Run backend pytest (integration, needs Postgres+Redis)"
	@echo "  make test-frontend   Run frontend build (type-check + lint)"
	@echo "  make eval            Run RAG evals (golden + retrieval)"
	@echo "  make e2e             Run Playwright E2E suite (added in slice 3)"
	@echo "  make api-codegen     Regenerate frontend client from FastAPI OpenAPI (slice 2)"
	@echo "  make migrate         Run Alembic migrations"
	@echo "  make seed            Seed admin user + initial prompt"
	@echo "  make clean           Remove build artifacts"
	@echo ""
	@echo "Jira Commands:"
	@echo "  make jira-status ISSUE=RP-2"
	@echo "  make jira-done ISSUE=RP-2 MSG='...'"

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------
lint:
	cd backend && ruff check . && black --check --line-length 100 .
	cd frontend && npx next lint

test-backend:
	PYTHONPATH=backend pytest backend/tests/unit/ -v

test-integration:
	PYTHONPATH=backend pytest backend/tests/integration/ -v

test-frontend:
	cd frontend && npx tsc --noEmit && npx next lint && npx next build

test: test-backend test-frontend

eval:
	docker compose run --rm --build \
		-e PYTHONPATH=/app \
		backend bash -c "pip install -q pytest pytest-asyncio && pytest tests/evals/ -v"

# Slice 3+ — Playwright E2E against running docker compose stack.
# First-time run: `make e2e-install` to download browser binaries (~250MB).
e2e:
	cd frontend && npx playwright test

e2e-install:
	cd frontend && npx playwright install --with-deps chromium

e2e-list:
	cd frontend && npx playwright test --list

# Regenerate TypeScript client from FastAPI's OpenAPI spec.
# Boots the app in-process (no backend container required) → dumps openapi.json
# → runs openapi-typescript → writes generated types to frontend.
api-codegen:
	@mkdir -p frontend/src/lib/api/generated
	PYTHONPATH=backend python3 backend/scripts/export_openapi.py --out frontend/src/lib/api/generated/openapi.json
	cd frontend && npx openapi-typescript src/lib/api/generated/openapi.json -o src/lib/api/generated/schema.d.ts
	@echo "Generated frontend/src/lib/api/generated/schema.d.ts"

# ---------------------------------------------------------------------------
# One-time dev setup: generate an RSA keypair into .env so the app boots
# locally without manual OpenSSL gymnastics.
# ---------------------------------------------------------------------------
dev-env:
	@test -f .env || cp .env.example .env
	@if grep -q "^JWT_PRIVATE_KEY=your-rsa-private-key-pem" .env; then \
		TMP=$$(mktemp -d); \
		openssl genrsa -out $$TMP/private.pem 2048 2>/dev/null; \
		openssl rsa -in $$TMP/private.pem -pubout -out $$TMP/public.pem 2>/dev/null; \
		PRIV=$$(awk 'NF {sub(/\r/, ""); printf "%s\\n", $$0}' $$TMP/private.pem); \
		PUB=$$(awk 'NF {sub(/\r/, ""); printf "%s\\n", $$0}' $$TMP/public.pem); \
		sed -i.bak "s|^JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=\"$$PRIV\"|" .env; \
		sed -i.bak "s|^JWT_PUBLIC_KEY=.*|JWT_PUBLIC_KEY=\"$$PUB\"|" .env; \
		rm -f .env.bak; \
		rm -rf $$TMP; \
		echo "Generated dev RSA keypair into .env"; \
	else \
		echo ".env already has a JWT keypair — skipping"; \
	fi

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
migrate:
	cd backend && alembic upgrade head

seed:
	@echo "Seed command — implement via backend/scripts/seed.py"

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/.next 2>/dev/null || true

# ---------------------------------------------------------------------------
# Jira integration
# ---------------------------------------------------------------------------
jira-status:
	@./scripts/jira.sh status $(ISSUE)

jira-transitions:
	@./scripts/jira.sh transitions $(ISSUE)

jira-move:
	@./scripts/jira.sh move $(ISSUE) "$(STATUS)"

jira-comment:
	@./scripts/jira.sh comment $(ISSUE) "$(MSG)"

jira-done:
	@./scripts/jira.sh update $(ISSUE) "Done" "$(MSG)"

jira-progress:
	@./scripts/jira.sh update $(ISSUE) "In Progress" "$(MSG)"
