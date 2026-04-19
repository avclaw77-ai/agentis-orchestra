#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AgentisOrchestra -- First-time setup
# =============================================================================

echo "AgentisOrchestra Setup"
echo "==================="
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is required. Install it from https://docker.com"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "ERROR: Docker Compose V2 is required."
  exit 1
fi

echo "[ok] Docker found"

# Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate random tokens
  BRIDGE_TOKEN=$(openssl rand -hex 16)
  SECRET=$(openssl rand -hex 32)
  ENCRYPT_KEY=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -hex 12)

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/BRIDGE_TOKEN=change-me-in-production/BRIDGE_TOKEN=$BRIDGE_TOKEN/" .env
    sed -i '' "s/NEXTAUTH_SECRET=change-me-in-production/NEXTAUTH_SECRET=$SECRET/" .env
    sed -i '' "s/ENCRYPTION_KEY=change-me-in-production/ENCRYPTION_KEY=$ENCRYPT_KEY/" .env
    sed -i '' "s/DB_PASSWORD=change-me-in-production/DB_PASSWORD=$DB_PASS/" .env
  else
    sed -i "s/BRIDGE_TOKEN=change-me-in-production/BRIDGE_TOKEN=$BRIDGE_TOKEN/" .env
    sed -i "s/NEXTAUTH_SECRET=change-me-in-production/NEXTAUTH_SECRET=$SECRET/" .env
    sed -i "s/ENCRYPTION_KEY=change-me-in-production/ENCRYPTION_KEY=$ENCRYPT_KEY/" .env
    sed -i "s/DB_PASSWORD=change-me-in-production/DB_PASSWORD=$DB_PASS/" .env
  fi

  echo "[ok] .env created with random secrets"
else
  echo "[ok] .env already exists"
fi

echo ""
echo "Ready. Run: make up"
echo ""
echo "  App:    http://localhost:3000"
echo "  Bridge: http://localhost:3847"
echo "  DB:     localhost:5432"
echo ""
