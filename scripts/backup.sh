#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AgentisOrchestra -- Database Backup
# Usage: ./scripts/backup.sh [output_dir]
# Dumps PostgreSQL via the running Docker container.
# =============================================================================

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_NAME="${DB_NAME:-agentis_orchestra}"
DB_USER="${DB_USER:-agentis}"
CONTAINER_NAME=""

# Find the db container
if command -v docker &>/dev/null; then
  CONTAINER_NAME=$(docker compose ps -q db 2>/dev/null || true)
fi

if [ -z "$CONTAINER_NAME" ]; then
  echo "ERROR: Database container not running. Start with: docker compose up -d db"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Backing up ${DB_NAME}..."
echo "  Container: ${CONTAINER_NAME:0:12}"
echo "  Output:    ${BACKUP_FILE}"

docker exec "$CONTAINER_NAME" \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  --no-owner --no-privileges \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
echo "[ok] Backup complete: ${BACKUP_FILE} (${SIZE})"

# Prune backups older than 30 days
PRUNED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete -print 2>/dev/null | wc -l | tr -d ' ')
if [ "$PRUNED" -gt 0 ]; then
  echo "[ok] Pruned ${PRUNED} backup(s) older than 30 days"
fi
