#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AgentisOrchestra -- VPS Deploy (one command)
#
# Usage:
#   VPS_PASS=xxx ./scripts/deploy-vps.sh              # default host
#   VPS_PASS=xxx ./scripts/deploy-vps.sh user@host     # custom host
#   ./scripts/deploy-vps.sh user@host                  # SSH key auth
#
# What it does:
#   1. Pull latest code
#   2. Install dependencies (app + bridge)
#   3. Run database migrations
#   4. Fix docker-compose for host-bridge pattern
#   5. Rebuild and restart Docker app
#   6. Restart host bridge (systemd)
#   7. Health check
# =============================================================================

HOST="${1:-root@148.230.91.61}"
DIR="/opt/agentis-orchestra"

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
NC="\033[0m"

step() { echo -e "${YELLOW}[$1]${NC} $2"; }

# SSH wrapper
if command -v sshpass &>/dev/null && [ -n "${VPS_PASS:-}" ]; then
  run() { sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no "$HOST" "$@"; }
else
  run() { ssh -o StrictHostKeyChecking=no "$HOST" "$@"; }
fi

echo -e "${YELLOW}Deploying to${NC} ${HOST}"
echo ""

step "1/8" "Pulling latest code..."
run "cd $DIR && git stash 2>/dev/null; git pull origin main 2>&1 | tail -3"

step "2/8" "Installing app dependencies..."
run "cd $DIR/app && CI=true pnpm install 2>&1 | tail -1"

step "3/8" "Installing bridge dependencies + build..."
run "cd $DIR/bridge && CI=true pnpm install 2>&1 | tail -1 && npx tsc 2>&1 | tail -2"

step "4/8" "Running database migrations..."
run "cd $DIR/app && DATABASE_URL=\"postgres://agentis:\$(grep DB_PASSWORD $DIR/.env | cut -d= -f2)@127.0.0.1:5432/agentis_orchestra\" npx drizzle-kit push 2>&1 | tail -2"

step "5/8" "Configuring Docker for host bridge..."
run "cd $DIR && bash scripts/vps-post-pull.sh 2>&1"

step "6/8" "Rebuilding and restarting app..."
run "cd $DIR && docker compose build app 2>&1 | tail -2 && docker compose up -d app 2>&1 | tail -3"

step "7/8" "Restarting bridge..."
run "systemctl restart orchestra-bridge 2>/dev/null || true"

# Health check
echo ""
step "check" "Waiting for services (10s)..."
sleep 10

HEALTH=$(run "curl -s http://localhost:3000/api/health" 2>/dev/null || echo '{"status":"unreachable"}')
APP=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
BRIDGE=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('bridge','?'))" 2>/dev/null || echo "?")

echo ""
if [ "$APP" == "ok" ] && [ "$BRIDGE" == "ok" ]; then
  echo -e "${GREEN}Deploy successful${NC} -- App: ok, Bridge: ok"
else
  echo -e "${RED}Deploy warning${NC} -- App: $APP, Bridge: $BRIDGE"
  echo "  Check logs: ssh $HOST 'cd $DIR && docker compose logs app --tail 20'"
fi
