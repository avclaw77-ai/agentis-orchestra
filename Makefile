# =============================================================================
# AgentisOrchestra -- Makefile
# =============================================================================

.PHONY: up down restart logs logs-bridge logs-app logs-db \
        db-push db-studio setup health clean backup build

# --- Lifecycle ---

up:
	docker compose up -d

up-logs:
	docker compose up

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

rebuild:
	docker compose build --no-cache

# --- Logs ---

logs:
	docker compose logs -f --tail=100

logs-bridge:
	docker compose logs -f --tail=100 bridge

logs-app:
	docker compose logs -f --tail=100 app

logs-db:
	docker compose logs -f --tail=100 db

# --- Database ---

db-push:
	docker compose exec app pnpm db:push

db-studio:
	docker compose exec app pnpm db:studio

db-shell:
	docker compose exec db psql -U $${DB_USER:-agentis} $${DB_NAME:-agentis_orchestra}

# --- Tools ---

pgadmin:
	docker compose --profile tools up -d pgadmin

# --- Ops ---

setup:
	bash scripts/setup.sh

health:
	bash scripts/healthcheck.sh

backup:
	bash scripts/backup.sh

# --- Cleanup ---

clean:
	@echo "This will destroy all data (volumes, images). Ctrl+C to cancel."
	@sleep 3
	docker compose down -v --rmi local
	@echo "[ok] Clean slate."

status:
	docker compose ps
