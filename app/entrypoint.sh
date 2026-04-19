#!/bin/sh
set -e

# Run database migrations on startup (safe to run multiple times)
if [ -f "drizzle.config.ts" ] && [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running database migrations..."
  npx drizzle-kit push --force 2>/dev/null || echo "[entrypoint] Migration skipped (drizzle-kit not available or DB not ready)"
fi

# Start the application
exec node server.js
