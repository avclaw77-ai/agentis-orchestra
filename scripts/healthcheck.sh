#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AgentisOrchestra -- Service Health Check
# Usage: ./scripts/healthcheck.sh
# Returns exit code 0 if all services healthy, 1 otherwise
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

DB_PORT="${DB_PORT:-5432}"
BRIDGE_PORT="${BRIDGE_PORT:-3847}"
APP_PORT="${APP_PORT:-3000}"
HOST="${HEALTH_HOST:-localhost}"

FAILED=0

check_service() {
  local name="$1"
  local url="$2"
  local timeout="${3:-5}"

  if curl -sf --max-time "$timeout" "$url" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[ok]${NC} $name"
  else
    echo -e "  ${RED}[FAIL]${NC} $name -- $url"
    FAILED=1
  fi
}

check_db() {
  if command -v pg_isready &>/dev/null; then
    if pg_isready -h "$HOST" -p "$DB_PORT" -q 2>/dev/null; then
      echo -e "  ${GREEN}[ok]${NC} Database (pg_isready)"
      return
    fi
  fi

  # Fallback: TCP check
  if (echo > /dev/tcp/"$HOST"/"$DB_PORT") 2>/dev/null; then
    echo -e "  ${GREEN}[ok]${NC} Database (TCP port $DB_PORT)"
  else
    echo -e "  ${RED}[FAIL]${NC} Database -- port $DB_PORT not responding"
    FAILED=1
  fi
}

echo ""
echo "AgentisOrchestra Health Check"
echo "============================="
echo ""

# Check Docker containers are running
if command -v docker &>/dev/null; then
  RUNNING=$(docker compose ps --status running --format '{{.Name}}' 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  Docker containers running: ${RUNNING}"
  echo ""
fi

check_db
check_service "Bridge" "http://${HOST}:${BRIDGE_PORT}/health"
check_service "App" "http://${HOST}:${APP_PORT}/api/health"

echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}All services healthy.${NC}"
  exit 0
else
  echo -e "${RED}One or more services are down.${NC}"
  exit 1
fi
