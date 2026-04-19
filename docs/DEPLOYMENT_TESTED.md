# Tested Deployment Process

This document records the exact steps used to deploy AgentisOrchestra to a Hostinger VPS (148.230.91.61) on April 16, 2026. Use this as the authoritative deployment reference.

## Server Specs

- **Provider**: Hostinger VPS
- **OS**: Ubuntu 22.04 (5.15.0-171-generic)
- **RAM**: 8 GB
- **Disk**: 97 GB (83 GB free)
- **IP**: 148.230.91.61

## Step 1: Install Docker

```bash
ssh root@your-server-ip

apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git make

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker && systemctl start docker
```

**Verify**: `docker --version` and `docker compose version`

## Step 2: Clone and Configure

```bash
git clone https://github.com/AgentisLab/AgentisOrchestra.git /opt/agentis-orchestra
cd /opt/agentis-orchestra
make setup    # generates .env with random secrets
```

**Verify**: `grep "change-me" .env` should return nothing (all secrets generated).

## Step 3: Open Firewall Ports

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable
```

## Step 4: Build Containers

```bash
docker compose build --no-cache
```

**Time**: ~3-5 minutes on a 2-vCPU VPS.

**Verify**: Both images built -- `docker images | grep agentis-orchestra`

## Step 5: Start Database

```bash
docker compose up -d db
sleep 8
docker compose exec -T db pg_isready -U agentis
```

**Verify**: Should print "accepting connections".

## Step 6: Push Schema (Critical)

The database starts empty. You must push the Drizzle schema before the app and bridge can work.

```bash
source .env
docker run --rm \
  --network agentis-orchestra_orchestra \
  -e DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}" \
  -v $(pwd)/app:/work -w /work \
  node:22-alpine \
  sh -c "corepack enable && corepack prepare pnpm@latest --activate && pnpm install && pnpm db:push"
```

**Time**: ~20-30 seconds.

**Verify**: Should print `[✓] Changes applied`.

**Why this way**: The production Docker image doesn't include devDependencies (drizzle-kit). We run a temporary node container with the full dependency set to push the schema. This only needs to happen once on first deploy and after schema changes.

## Step 7: Start All Services

```bash
docker compose up -d
```

If the app doesn't start (bridge healthcheck dependency), force it:

```bash
docker compose up -d --no-deps app
```

**Verify**:
```bash
docker compose ps                           # All 3 running
curl -sf http://localhost:3847/health       # Bridge: {"status":"ok",...}
curl -sf http://localhost:3000/api/health   # App: {"status":"ok",...}
curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000  # 307 (redirect to /setup)
```

The 307 redirect to `/setup` is correct -- it means the wizard is waiting for first-run configuration.

## Step 8: Set Up Backups

```bash
CRON_JOB="0 3 * * * cd /opt/agentis-orchestra && ./scripts/backup.sh >> /var/log/orchestra-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v orchestra-backup; echo "$CRON_JOB") | crontab -
```

**Verify**: `crontab -l` should show the backup job.

## Step 9: Access the Setup Wizard

Open `http://YOUR_SERVER_IP:3000` in a browser. You'll see the AgentisOrchestra setup wizard.

Walk through:
1. Language (EN/FR)
2. Admin account
3. Company info (+ optional AI analysis)
4. Workshop import (optional)
5. AI providers
6. Departments
7. Agents
8. Launch

## Known Issues

### Bridge shows "unhealthy" in Docker

The bridge healthcheck (`wget -qO- http://localhost:3847/health`) sometimes fails during the start_period even though the server is running. This is cosmetic -- the bridge is functional. The increased `start_period: 30s` and `retries: 10` should handle most cases.

**Workaround**: If the app won't start due to bridge dependency, use:
```bash
docker compose up -d --no-deps app
```

### Schema must be pushed before first use

Unlike some ORMs that auto-migrate, Drizzle requires an explicit `pnpm db:push`. If you see `relation "X" does not exist` errors in bridge logs, the schema hasn't been pushed. See Step 6.

### AUTH_TOKEN warning

The compose file references `AUTH_TOKEN` which was removed from the .env template. This is harmless -- the variable defaults to blank. To suppress the warning, add `AUTH_TOKEN=` to your .env file.

## Updating

```bash
cd /opt/agentis-orchestra
git pull
docker compose build --no-cache
docker compose up -d

# If schema changed:
source .env
docker run --rm --network agentis-orchestra_orchestra \
  -e DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}" \
  -v $(pwd)/app:/work -w /work node:22-alpine \
  sh -c "corepack enable && corepack prepare pnpm@latest --activate && pnpm install && pnpm db:push"
```

## Service Ports

| Service | Port | Access |
|---------|------|--------|
| App | 3000 | Public (setup wizard + dashboard) |
| Bridge | 3847 | Internal (agent execution engine) |
| MCP | 3848 | Internal (tool server for external Claude) |
| Postgres | 5432 | Internal (database) |

For production with SSL, add Caddy reverse proxy using `docker-compose.prod.yml`.
