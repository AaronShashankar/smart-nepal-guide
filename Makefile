# Bato: shortcuts for running the backend. Run `make` to list them.
#
#   make dev      start everything the API needs, then run it with auto-reload
#
# Works with the make that ships with macOS (GNU make 3.81).

BACKEND := backend
API_PORT := 8000
UV := cd $(BACKEND) && uv run

.DEFAULT_GOAL := help
.PHONY: help dev services install migrate model seed train evaluate test lint format \
        create-admin stop status verify

help: ## List the commands
	@echo "Usage: make <command>"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[1;34m%-13s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- run

dev: services install migrate model ## Start Postgres + Redis, install, migrate, train if needed, run the API
	@if lsof -iTCP:$(API_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Port $(API_PORT) is already in use (an API is probably running). Stop it with: make stop"; \
		exit 1; \
	fi
	@echo
	@echo "API:  http://localhost:$(API_PORT)/health   docs: http://localhost:$(API_PORT)/docs"
	@IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null); \
		[ -n "$$IP" ] && echo "Phone: http://$$IP:$(API_PORT)/health"; true
	@echo "Press Ctrl+C to stop."
	@echo
	$(UV) uvicorn app.main:app --reload --host 0.0.0.0 --port $(API_PORT)

services: ## Start PostgreSQL and Redis if they are stopped
	@if ! pg_isready -q; then \
		echo "Starting PostgreSQL..."; \
		brew services start postgresql@16 >/dev/null; \
		for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do pg_isready -q && break; sleep 1; done; \
	fi
	@pg_isready -q || { echo "PostgreSQL did not start. Try: brew services start postgresql@16"; exit 1; }
	@echo "PostgreSQL: ready"
	@if ! redis-cli ping >/dev/null 2>&1; then \
		echo "Starting Redis..."; brew services start redis >/dev/null; sleep 1; \
	fi
	@redis-cli ping >/dev/null 2>&1 && echo "Redis: ready" || echo "Redis: not running (not needed in Version 1)"

install: ## Install / update the Python packages (uv sync)
	@cd $(BACKEND) && uv sync --quiet
	@echo "Python packages: up to date"

migrate: ## Bring the database schema up to date (alembic upgrade head)
	@$(UV) alembic upgrade head
	@echo "Database schema: up to date"

model: ## Train the risk model only if none exists yet
	@if ls $(BACKEND)/models/*.joblib >/dev/null 2>&1; then \
		echo "Risk model: found"; \
	else \
		echo "No trained risk model yet; training it (about a minute)..."; \
		$(UV) python -m app.ml.train; \
	fi

# ---------------------------------------------------------------- data and model

seed: services ## Reload data/ into the database (overwrites admin edits to seeded content)
	$(UV) python -m app.seed

train: services ## Retrain the risk model
	$(UV) python -m app.ml.train

evaluate: ## Rebuild the model comparison and figures in backend/docs/ml/
	$(UV) python -m app.ml.evaluate

create-admin: services ## Create an admin account: make create-admin EMAIL=you@example.com PASSWORD='long-password'
	@[ -n "$(EMAIL)" ] && [ -n "$(PASSWORD)" ] || { echo "Usage: make create-admin EMAIL=you@example.com PASSWORD='a-long-password'"; exit 1; }
	$(UV) python -m app.create_admin "$(EMAIL)" '$(PASSWORD)'

# ---------------------------------------------------------------- checks

test: services ## Run the backend tests (pytest)
	$(UV) pytest

lint: ## Lint and format-check the backend (ruff)
	$(UV) ruff check .
	$(UV) ruff format --check .

format: ## Auto-fix lint issues and format the backend
	$(UV) ruff check --fix .
	$(UV) ruff format .

verify: ## Run every check in the project (scripts/verify.sh)
	./scripts/verify.sh

# ---------------------------------------------------------------- helpers

status: ## Show what is running
	@pg_isready -q && echo "PostgreSQL: running" || echo "PostgreSQL: stopped"
	@redis-cli ping >/dev/null 2>&1 && echo "Redis:      running" || echo "Redis:      stopped"
	@curl -sf http://localhost:$(API_PORT)/health >/dev/null && echo "API:        running on :$(API_PORT)" || echo "API:        stopped"

stop: ## Stop the API running on port 8000 (leaves Postgres and Redis running)
	@PIDS=$$(lsof -tiTCP:$(API_PORT) -sTCP:LISTEN); \
	if [ -n "$$PIDS" ]; then kill $$PIDS && echo "Stopped the API on port $(API_PORT)"; else echo "Nothing is running on port $(API_PORT)"; fi
