.PHONY: help up down build logs lint lint-fix test format type-check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Docker ---
up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Build all Docker images
	docker compose build

logs: ## Tail logs from all services
	docker compose logs -f

# --- Linting & Formatting ---
lint: ## Run all linters
	cd backend && ruff check . && cd ..
	cd scraper && ruff check . && cd ..
	cd frontend && pnpm lint

lint-fix: ## Auto-fix lint issues
	cd backend && ruff check --fix . && black . && cd ..
	cd scraper && ruff check --fix . && black . && cd ..
	cd frontend && pnpm lint:fix

format: ## Format all code
	black backend/ scraper/
	cd frontend && pnpm lint:fix

type-check: ## Run type checkers
	mypy backend/ scraper/ --config-file pyproject.toml
	cd frontend && pnpm type-check

# --- Testing ---
test: ## Run all tests
	pytest backend/tests/ scraper/tests/ -v

test-backend: ## Run backend tests only
	pytest backend/tests/ -v

test-scraper: ## Run scraper tests only
	pytest scraper/tests/ -v

test-frontend: ## Run frontend tests only
	cd frontend && pnpm test

# --- Jira ---
jira-status: ## Get Jira ticket status (ISSUE=RP-2)
	@./scripts/jira.sh status $(ISSUE)

jira-transitions: ## List available Jira transitions (ISSUE=RP-2)
	@./scripts/jira.sh transitions $(ISSUE)

jira-move: ## Move Jira ticket (ISSUE=RP-2 STATUS="Done")
	@./scripts/jira.sh move $(ISSUE) "$(STATUS)"

jira-comment: ## Add Jira comment (ISSUE=RP-2 MSG="message")
	@./scripts/jira.sh comment $(ISSUE) "$(MSG)"

jira-done: ## Mark Jira ticket done with comment (ISSUE=RP-2 MSG="message")
	@./scripts/jira.sh update $(ISSUE) "Done" "$(MSG)"

# --- Utilities ---
clean: ## Clean generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
