<p align="center">
  <h1 align="center">AgentisOrchestra</h1>
  <p align="center"><strong>Run your company with AI agent teams. Department by department.</strong></p>
  <p align="center">
    <a href="https://orchestra.agentislab.ai">Website</a> &middot;
    <a href="docs/DEPLOYMENT.md">Deploy</a> &middot;
    <a href="CONTRIBUTING.md">Contribute</a> &middot;
    <a href="https://discord.gg/agentislab">Discord</a>
  </p>
</p>

---

AgentisOrchestra is an open-source platform for building and running AI agent teams. You structure agents by department -- Engineering, Sales, Research, Operations -- and a CEO agent orchestrates across all of them.

Tell it about your company. It proposes a tailored agent team. You customize, activate, and watch them work.

```bash
git clone https://github.com/avclaw77-ai/AgentisOrchestra.git
cd agentis-orchestra
make setup && make up
# Open http://localhost:3000
```

**That's it.** The web-based setup wizard handles everything else.

---

## Why AgentisOrchestra?

Most agent frameworks give you a blank canvas and say "figure it out." We give you a structured operating system for AI teams:

| Problem | AgentisOrchestra |
|---------|-----------------|
| "Which model should I use?" | Model router picks the best model for each task. CLI-first = free tokens via Pro subscription. |
| "How do I organize agents?" | Department-based hierarchy. CEO sees everything. Each department has its own agents, tasks, and budget. |
| "My agents only work when I chat with them" | Heartbeat engine. Agents wake up on schedule, check for work, execute, and report back. Autonomously. |
| "Setup takes days of config files" | 7-step web wizard. Or tell us your company URL and we propose your entire agent team in 30 seconds. |
| "I can't track what agents are doing" | Full audit trail. Every heartbeat run logged with tokens, cost, duration, and output. |
| "Agents go rogue and burn my API budget" | Budget enforcement with cascading limits. Agent -> department -> company. Auto-pause on hard stop. |

---

## The Setup Experience

No YAML. No config files. No CLI flags.

1. **Choose your language** -- English or Quebec French
2. **Create admin account** -- email + password
3. **Tell us about your company** -- name, website, industry
4. **We analyze your business** -- Perplexity researches your website, LLM proposes a tailored agent team with departments, roles, personas, and schedules
5. **Connect AI providers** -- Claude CLI auto-detected, API keys tested live
6. **Review and customize** -- accept the proposal or build from templates
7. **Launch** -- dashboard loads with your agents ready to work

*No other orchestration platform does step 4.* This is what makes prospects say "I need this."

---

## Features

**Agent Management**
- Department-based organization with CEO cross-department view
- Agent personas, model selection, and heartbeat scheduling per agent
- Config versioning with full audit trail

**Autonomous Execution**
- Heartbeat engine: agents wake on cron, webhook, manual trigger, or chat
- Run lifecycle tracking: queued -> executing -> succeeded/failed
- Session persistence across Docker restarts
- Atomic task checkout prevents double-work

**Multi-Model Intelligence**
- Claude CLI (Pro subscription -- flat cost, unlimited tokens)
- OpenRouter (100+ models: GPT, Gemini, Llama, DeepSeek, Qwen)
- Perplexity (web search with citations)
- OpenAI (direct API)
- Smart router picks best model per task type. CLI-first = cost control.

**Workflow Automation**
- Named routines with cron/webhook/manual triggers
- Multi-step cross-department chains (Research -> Build -> Review)
- Concurrency and catch-up policies
- Natural language schedule builder ("Every weekday at 9am")

**Cost Control**
- Per-run token and cost tracking
- Budget cascade: agent -> department -> company
- Soft alerts at 80%, hard stop at 100%
- ROI dashboard: tasks completed, hours saved, CLI savings

**Governance**
- Goal hierarchy: company mission -> department goals -> tasks
- Approval workflows with threaded comments
- Versioned skill library
- Company export/import as portable templates

**Extensibility**
- MCP server with 21 tools for external integration
- Plugin system with Worker thread isolation
- Crash recovery with exponential backoff

**Multi-User Teams**
- Admin / member / viewer roles with department-scoped access
- Multi-department access (one person can manage multiple departments)
- CEO view for admins, filtered department view for members
- Team management UI for inviting and managing users
- Agent display names for change management ("Sophie" instead of "Dev Agent")

**System Integration** (Phase 1)
- Connector Agents plug into existing company systems (CRM, ERP, databases)
- Configuration-driven -- no custom code per client
- MCP tool servers for high-frequency integrations
- Connector credentials encrypted alongside provider keys

**Bilingual**
- English and Quebec French natively
- Not translated -- written for each language

---

## Architecture

For CLI mode (Pro subscription), the bridge runs on the host for direct Claude CLI access:

```
                    HTTPS (443)
                        |
                    [ Caddy ]           Reverse proxy + auto SSL
                        |
                    [ App :3000 ]       Next.js 15 -- UI + API
                        |
                    [ Bridge :3847 ]    Heartbeat + execution engine
                   /    |    \
            [ CLI ]  [ APIs ]  [ MCP :3848 ]    Model providers + tools
                        |
                   [ Postgres ]         34 tables, Drizzle ORM
                        |
                   [ Plugins ]          Worker-isolated extensions
```

| Component | Stack |
|-----------|-------|
| Frontend | Next.js 15, React 19, Tailwind 4, TypeScript |
| Execution | Node.js, Express, SSE streaming, heartbeat scheduler |
| Database | PostgreSQL 16 + pgvector, Drizzle ORM |
| Auth | scrypt password hashing, session cookies, AES-256-GCM key encryption |
| Infra | Docker Compose, Makefile, Caddy, GitHub Actions CI/CD |

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/avclaw77-ai/AgentisOrchestra.git
cd agentis-orchestra
make setup    # generates .env with random secrets
make up       # starts app + bridge + postgres
```

Open `http://localhost:3000`. Setup wizard takes 2 minutes.

### Local Development

```bash
docker compose up -d db          # postgres only
cd app && pnpm install && pnpm dev       # http://localhost:3000
cd bridge && pnpm install && pnpm dev    # http://localhost:3847
```

### Production (VPS)

```bash
ssh root@your-server
git clone ... /opt/agentis-orchestra && cd /opt/agentis-orchestra
make setup && nano .env          # set DOMAIN + API keys
docker compose -f docker-compose.prod.yml up -d
# SSL auto-provisioned by Caddy. Done.
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide.

---

## Model Providers

| Provider | Mode | Cost | Best For |
|----------|------|------|----------|
| Claude CLI | Pro subscription | Flat monthly | Primary workhorse (free tokens) |
| OpenRouter | API key | Per-token | 100+ models, flexibility |
| Perplexity | API key | Per-query | Research, web search |
| OpenAI | API key | Per-token | GPT-4o, o3 |

**Start with Claude CLI only.** Zero marginal cost. Add API keys later for specific models or research capability.

---

## Project Structure

```
agentis-orchestra/
├── app/                     Next.js 15 frontend + API
│   ├── src/app/             Pages + API routes
│   ├── src/components/      React components (sidebar, kanban, chat...)
│   ├── src/db/              Drizzle schema (34 tables)
│   └── src/lib/             Utils, crypto, i18n, templates
├── bridge/                  Execution engine
│   ├── heartbeat.ts         Autonomous agent execution
│   ├── scheduler.ts         Cron scheduling
│   ├── router.ts            Multi-model routing
│   ├── providers.ts         Claude CLI, OpenRouter, Perplexity, OpenAI
│   ├── mcp/                 MCP server (21 tools)
│   └── plugins/             Plugin loader + worker manager
├── design/                  Prototypes + design system
├── docs/                    Deployment guide
├── plugins/                 Plugin directory (add yours here)
├── scripts/                 Setup, backup, healthcheck
├── docker-compose.yml       Development
├── docker-compose.prod.yml  Production (Caddy + hardened)
└── Makefile                 15 ops commands
```

---

## Makefile Commands

```bash
make up          # Start all services
make down        # Stop all services
make logs        # Tail all logs
make health      # Check service health
make backup      # Database backup (gzipped, auto-prune)
make db-push     # Run schema migrations
make db-shell    # psql into database
make clean       # Nuclear reset (removes all data)
make status      # Docker container status
```

---

## Built With

[Next.js](https://nextjs.org) | [React 19](https://react.dev) | [Tailwind CSS 4](https://tailwindcss.com) | [Drizzle ORM](https://orm.drizzle.team) | [PostgreSQL](https://postgresql.org) | [Docker](https://docker.com) | [Lucide Icons](https://lucide.dev) | [TypeScript](https://typescriptlang.org)

---

## Who Made This

[AgentisLab](https://agentislab.ai) -- a boutique AI firm in Quebec City, Canada. We don't advise on AI. We build it, run it, and ship it.

AgentisOrchestra is the platform we use internally and deploy to clients. It's open-source because we believe the best way to show what we can do is to let you see it.

**Need help setting it up for your company?** [Talk to us](mailto:alex@agentislab.ai).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, architecture guide, and PR process.

## License

[MIT](LICENSE) -- AgentisLab 2026
