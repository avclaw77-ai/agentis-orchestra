# AgentisOrchestra

**The operating system for AI-powered organizations.**

One install = one company. Department-by-department AI agent teams, linked at CEO level. Not a dev tool -- a full orchestration platform for any domain: engineering, research, ops, support, sales.

---

## Get Started in 3 Commands

```bash
git clone https://github.com/AgentisLab/agentis-orchestra.git
cd agentis-orchestra
make setup && make up
```

Open `http://localhost:3000`. The setup wizard walks you through everything.

---

## Features

- **Department-based org model** -- Structure agents by department (Engineering, Design, Research, Operations...) with a CEO agent that sees across all of them.
- **Heartbeat engine** -- Agents don't just chat. They execute autonomously on configurable intervals, checking for work, running routines, and reporting status.
- **Multi-model routing** -- Claude CLI (Pro subscription, flat cost), Anthropic API, OpenRouter (100+ models), Perplexity (web search), OpenAI. Use what makes sense for each task.
- **Guided setup wizard** -- Language, admin account, company profile, provider configuration, departments, agents. No YAML to write. No config files to edit.
- **Routines** -- Scheduled agent tasks with natural language cron. "Every weekday at 9 AM, check for new support tickets."
- **MCP server** -- Built-in Model Context Protocol server. Agents get tools from the bridge and from plugins.
- **Plugin system** -- Extend with custom tools, scheduled jobs, and model adapters. Worker-isolated for safety.
- **Kanban task board** -- Track work across agents and departments. Tasks flow through backlog, in-progress, review, done.
- **Cost tracking** -- Per-agent, per-model token usage and cost dashboards. Budget alerts.
- **Approval workflow** -- Human-in-the-loop for sensitive agent actions.
- **Company export/import** -- Full org configuration as portable JSON.
- **Bilingual** -- English and Quebec French natively.
- **Light theme** -- Clean, professional UI. No dark mode gimmicks.

---

## Architecture

```
                    HTTPS (443)
                        |
                    [ Caddy ]          Reverse proxy + auto SSL
                        |
                    [ App ]            Next.js 15 -- UI + REST API
                        |
                    [ Bridge ]         Agent execution engine
                   /    |    \
            [ CLI ]  [ SDK ]  [ OpenRouter ]    Model providers
                        |
                   [ Postgres ]        pgvector/pg16
                        |
                   [ Plugins ]         Worker-isolated extensions
```

| Layer | Stack | Port |
|-------|-------|------|
| App | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui | 3000 |
| Bridge | Node.js, Express 5, multi-provider model router | 3847 |
| MCP | JSON-RPC 2.0 over HTTP | 3848 |
| Database | PostgreSQL 16 + pgvector, Drizzle ORM | 5432 |
| Infra | Docker Compose, Caddy, Makefile | -- |

---

## Model Providers

| Provider | Mode | Cost Model | Use Case |
|----------|------|-----------|----------|
| Claude CLI | Pro subscription | Flat monthly | Primary workhorse -- unlimited tokens |
| Anthropic API | API key | Per-token | SDK adapter mode |
| OpenRouter | API key | Per-token | 100+ models (GPT, Gemini, Llama, DeepSeek, Qwen) |
| Perplexity | API key | Per-query | Research, web search, fact-checking |
| OpenAI | API key | Per-token | GPT models direct |

CLI-first economics: start with a Pro subscription for flat-cost operation. Add API keys when you need specific models or want to scale.

---

## Project Structure

```
app/                    Next.js frontend + API routes
bridge/                 Agent execution engine + heartbeat + MCP
plugins/                Worker-isolated extensions
scripts/                Setup, backup, healthcheck
docs/                   Deployment and operations guides
docker-compose.yml      Development
docker-compose.prod.yml Production (Caddy + hardened config)
Makefile                Common commands
```

---

## Development

```bash
# Full stack via Docker
make up                 # docker compose up -d
make logs               # tail all service logs
make health             # check all services

# Local dev (hot reload)
cd app && pnpm dev      # http://localhost:3000
cd bridge && pnpm dev   # http://localhost:3847

# Database
make db-push            # Run Drizzle migrations
make db-shell           # psql into the database
make backup             # pg_dump to backups/
```

---

## Production Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide. The short version:

```bash
# On your VPS
git clone https://github.com/AgentisLab/agentis-orchestra.git /opt/agentis-orchestra
cd /opt/agentis-orchestra
make setup
# Edit .env: set DOMAIN, add API keys
docker compose -f docker-compose.prod.yml up -d
```

Caddy handles SSL automatically. Minimum: 2 vCPU, 4 GB RAM.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, project structure, and PR process.

---

## License

[MIT](LICENSE) -- Copyright (c) 2026 AgentisLab
