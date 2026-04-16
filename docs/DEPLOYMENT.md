# Deployment Guide

Two deployment paths: **Local** (development or personal use) and **VPS** (production for clients).

---

## Path 1: Local Development

For running on your Mac, Linux machine, or Windows (WSL2). Good for development, testing, and personal use.

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker Engine (Linux)
- Node.js 22+ and pnpm 9+ (for local dev without Docker)
- Git

### Option A: Docker (recommended)

The simplest path. Everything runs in containers.

```bash
# 1. Clone
git clone https://github.com/AgentisLab/agentis-orchestra.git
cd agentis-orchestra

# 2. Generate secrets
make setup

# 3. Start everything
make up
```

**Verify:**
```bash
make health
# Should show:
#   [ok] Database (pg_isready)
#   [ok] Bridge
#   [ok] App
```

Open `http://localhost:3000` -- you'll see the setup wizard.

**Common commands:**
```bash
make up          # Start all services (background)
make down        # Stop all services
make logs        # Tail all logs
make logs-app    # App logs only
make logs-bridge # Bridge logs only
make db-shell    # Drop into psql
make backup      # Backup database
make clean       # Nuclear reset (deletes all data)
```

### Option B: Local dev servers (no Docker for app/bridge)

For active development -- faster hot reload, debugger support.

```bash
# 1. Start only the database via Docker
docker compose up -d db

# 2. Wait for it
docker compose exec db pg_isready -U agentis
# Should print: accepting connections

# 3. Install dependencies
cd app && pnpm install && cd ..
cd bridge && pnpm install && cd ..

# 4. Create .env for app
cat > app/.env.local << 'EOF'
DATABASE_URL=postgres://agentis:agentis_local@localhost:5432/agentis_orchestra
BRIDGE_URL=http://localhost:3847
BRIDGE_TOKEN=dev-token
NEXTAUTH_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
EOF

# 5. Create .env for bridge
cat > bridge/.env << 'EOF'
PORT=3847
DATABASE_URL=postgres://agentis:agentis_local@localhost:5432/agentis_orchestra
BRIDGE_TOKEN=dev-token
CLAUDE_CLI_PATH=/usr/local/bin/claude
EOF

# 6. Push schema to database
cd app && pnpm db:push && cd ..

# 7. Start bridge (terminal 1)
cd bridge && pnpm dev

# 8. Start app (terminal 2)
cd app && pnpm dev
```

**Verify:**
- App: `http://localhost:3000`
- Bridge health: `curl http://localhost:3847/health`
- Database: `docker compose exec db psql -U agentis agentis_orchestra -c "\\dt"`

### Connecting Claude CLI

If you have a Claude Code Pro subscription:

```bash
# Verify Claude CLI is installed
claude --version

# Verify it's authenticated
claude --print-system-prompt  # should not error

# The bridge auto-detects it at /usr/local/bin/claude
# Or set CLAUDE_CLI_PATH in bridge/.env
```

### Adding API keys

During the setup wizard (step 4), you can add API keys for:
- **OpenRouter** -- unlocks 100+ models (GPT, Gemini, Llama, etc.)
- **Perplexity** -- web search with citations for research agents
- **OpenAI** -- direct GPT-4o, o3 access

These are stored encrypted (AES-256-GCM) in the database. You can also set them in `.env` as fallbacks.

---

## Path 2: VPS Production Deployment

For deploying to a client's infrastructure or your own production server.

### Prerequisites

- A VPS with 2+ vCPU, 4+ GB RAM, 40+ GB SSD
- Ubuntu 22.04 or 24.04 LTS
- A domain name (e.g., `orchestra.yourcompany.com`)
- DNS A record pointing to your server IP
- Ports 80 and 443 open

### Step 1: Provision and secure the server

```bash
# SSH into your VPS
ssh root@your-server-ip

# Create a non-root user
adduser orchestra
usermod -aG sudo orchestra
su - orchestra

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for Docker group to take effect
exit
ssh orchestra@your-server-ip

# Verify Docker
docker --version
docker compose version
```

### Step 2: Clone and configure

```bash
cd /opt
sudo mkdir agentis-orchestra && sudo chown orchestra:orchestra agentis-orchestra
git clone https://github.com/AgentisLab/agentis-orchestra.git agentis-orchestra
cd agentis-orchestra

# Generate secrets
make setup

# Edit .env -- set your domain
nano .env
```

**Required .env changes for production:**
```bash
# Set your domain (required for SSL)
DOMAIN=orchestra.yourcompany.com

# Optional: add API keys
OPENROUTER_API_KEY=sk-or-...
PERPLEXITY_API_KEY=pplx-...
OPENAI_API_KEY=sk-...
```

**Verify .env:**
```bash
# Check all secrets were generated (no "change-me" values)
grep "change-me" .env
# Should return nothing
```

### Step 3: Start production services

```bash
docker compose -f docker-compose.prod.yml up -d
```

This starts:
- **db** -- PostgreSQL 16 (internal only, no port exposed)
- **bridge** -- Agent execution engine (port 3847, internal)
- **app** -- Next.js frontend + API (port 3000, internal)
- **caddy** -- Reverse proxy with automatic SSL (ports 80, 443)

### Step 4: Verify

```bash
# Check containers are running
docker compose -f docker-compose.prod.yml ps

# Check health
make health

# Check SSL (give Caddy 30 seconds to provision cert)
curl -I https://orchestra.yourcompany.com
# Should return HTTP/2 200
```

Open `https://orchestra.yourcompany.com` -- you'll see the setup wizard.

### Step 5: Complete setup wizard

1. Choose language (EN/FR)
2. Create admin account
3. Name your company + mission
4. Connect AI providers (test each connection)
5. Create first department from template
6. Add agents
7. Launch dashboard

### Step 6: Set up automated backups

```bash
# Daily backup at 3 AM
crontab -e
```

Add this line:
```
0 3 * * * cd /opt/agentis-orchestra && ./scripts/backup.sh >> /var/log/orchestra-backup.log 2>&1
```

**Verify backup works:**
```bash
make backup
ls -la backups/
```

### Step 7: Set up monitoring

```bash
# Health check every 5 minutes
crontab -e
```

Add:
```
*/5 * * * * cd /opt/agentis-orchestra && ./scripts/healthcheck.sh > /dev/null 2>&1 || curl -s "https://your-alerting-endpoint"
```

---

## Updating

### From Git (build on server)

```bash
cd /opt/agentis-orchestra
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
make health
```

### From pre-built images (GHCR)

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
make health
```

### Rollback

```bash
# Check previous image tags
docker images | grep orchestra

# Restart with previous version
docker compose -f docker-compose.prod.yml down
git checkout <previous-commit>
docker compose -f docker-compose.prod.yml up -d
```

---

## SSL Setup

### Automatic (Caddy -- default)

The production compose includes Caddy. It handles everything:
- Provisions Let's Encrypt certificate automatically
- Renews before expiration
- Redirects HTTP to HTTPS
- Modern TLS configuration

**Requirements:**
- Ports 80 + 443 open
- DNS A record pointing to server IP
- `DOMAIN` set in `.env`

### Custom certificate

Edit `Caddyfile`:
```
orchestra.yourcompany.com {
    tls /path/to/cert.pem /path/to/key.pem
    reverse_proxy app:3000
}
```

### No SSL (internal/VPN only)

If behind a corporate VPN or reverse proxy that handles SSL:
```bash
# Remove caddy from prod compose, expose app directly
# Edit docker-compose.prod.yml:
#   app.ports: "3000:3000"
```

---

## Backup and Restore

### Backup

```bash
make backup
# Output: backups/agentis_orchestra_20260415-030000.sql.gz
```

Backups are gzipped SQL dumps. Auto-pruned after 30 days.

### Off-site backup

```bash
# To S3
aws s3 sync ./backups/ s3://your-bucket/orchestra-backups/

# To another server
rsync -az ./backups/ user@backup-host:/backups/orchestra/
```

### Restore

```bash
# Stop the app and bridge first
docker compose -f docker-compose.prod.yml stop app bridge

# Restore
gunzip -c backups/agentis_orchestra_20260415-030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U agentis agentis_orchestra

# Restart
docker compose -f docker-compose.prod.yml up -d
make health
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOMAIN` | Prod only | -- | Domain for SSL certificate |
| `DB_NAME` | No | `agentis_orchestra` | Database name |
| `DB_USER` | No | `agentis` | Database user |
| `DB_PASSWORD` | Yes | Generated | Database password |
| `BRIDGE_TOKEN` | Yes | Generated | Bridge authentication secret |
| `ENCRYPTION_KEY` | Yes | Generated | 32-byte hex key for API key encryption |
| `NEXTAUTH_SECRET` | Yes | Generated | Session signing key |
| `ADAPTER_MODE` | No | `cli` | Default: `cli` (Pro sub), `sdk`, or `api` |
| `CLAUDE_CLI_PATH` | No | `/usr/local/bin/claude` | Path to Claude CLI binary |
| `ANTHROPIC_API_KEY` | No | -- | For SDK/API adapter mode |
| `OPENROUTER_API_KEY` | No | -- | 100+ models via OpenRouter |
| `OPENAI_API_KEY` | No | -- | Direct OpenAI API access |
| `PERPLEXITY_API_KEY` | No | -- | Web search with citations |

All secrets are auto-generated by `make setup`. Only add API keys for providers you want to use.

---

## Troubleshooting

**Services won't start:**
```bash
docker compose -f docker-compose.prod.yml logs --tail=50
```

**Database connection errors:**
```bash
docker compose exec db pg_isready -U agentis
docker compose exec db psql -U agentis agentis_orchestra -c "SELECT 1"
```

**SSL certificate not provisioning:**
- Verify ports 80/443 are open: `sudo ufw status`
- Verify DNS: `dig +short orchestra.yourcompany.com`
- Check Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`

**Bridge can't reach database:**
```bash
docker compose exec bridge wget -qO- http://localhost:3847/health
# Check DATABASE_URL in bridge environment
```

**Out of memory:**
```bash
docker stats
# If bridge or app exceed limits, increase in docker-compose.prod.yml
```

**Schema out of date after update:**
```bash
docker compose exec app pnpm db:push
```
