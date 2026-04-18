<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="app/public/logo-full.svg">
    <img src="app/public/logo-full.svg" alt="AgentisOrchestra" height="48">
  </picture>
</p>

<h3 align="center">Your AI team, orchestrated.</h3>

<p align="center">
  Department-by-department AI agents that work autonomously,<br>
  chat with your team, and connect to your existing systems.
</p>

<p align="center">
  <a href="https://github.com/AgentisLab/AgentisOrchestra/actions"><img src="https://img.shields.io/github/actions/workflow/status/AgentisLab/AgentisOrchestra/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"></a>
  <a href="https://github.com/AgentisLab/AgentisOrchestra/releases"><img src="https://img.shields.io/badge/version-1.0.0-0284C7?style=flat-square" alt="Version"></a>
  <a href="https://orchestra.agentislab.ai"><img src="https://img.shields.io/badge/website-orchestra.agentislab.ai-0284C7?style=flat-square" alt="Website"></a>
</p>

<p align="center">
  <a href="https://orchestra.agentislab.ai">Website</a> &middot;
  <a href="docs/DEPLOYMENT.md">Deploy Guide</a> &middot;
  <a href="CONTRIBUTING.md">Contribute</a> &middot;
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## One install. One company. AI agents that actually work.

```bash
git clone https://github.com/AgentisLab/AgentisOrchestra.git
cd AgentisOrchestra
make setup && make up
# Open http://localhost:3000 -- setup wizard takes 2 minutes
```

AgentisOrchestra is an open-source platform for building and running AI agent teams. Structure agents by department -- Engineering, Sales, Research, Operations -- and a CEO agent orchestrates across all of them.

Tell it about your company. It proposes a tailored agent team. You customize, activate, and watch them work.

---

## What makes this different

| Problem | How we solve it |
|---------|----------------|
| **"My agents never improve"** | **Soul Engine.** Agents evolve their own personas through user feedback, execution analysis, and self-evaluation. No other platform does this. |
| **"Which model should I use?"** | Model router picks the best model per task. CLI-first = free tokens via Pro subscription. |
| **"My agents only work when I chat"** | Heartbeat engine. Agents wake on schedule, check for work, execute, report back. Autonomously. |
| **"Setup takes days of config files"** | 7-step web wizard. Or give us your company URL -- we propose your entire team in 30 seconds. |
| **"Agents burn my API budget"** | Budget cascade with auto-pause. Agent -> Department -> Company. Hard stop at limit. |
| **"I can't track what agents do"** | Full audit trail. Every run logged with tokens, cost, duration, and output. |
| **"It's just another chatbot"** | Kanban boards, goal trees, approval workflows, file management, routine automation. |

---

## The setup experience

No YAML. No config files. No CLI flags.

1. **Choose language** -- English or Quebec French
2. **Create admin** -- email + password
3. **Describe your company** -- name, website, industry
4. **AI proposes your team** -- Perplexity researches your site, LLM generates departments, agents, personas, schedules
5. **Connect providers** -- Claude CLI auto-detected, API keys tested live
6. **Review and launch** -- accept or customize from templates
7. **Dashboard loads** -- agents ready to work

*Step 4 is what makes prospects say "I need this."* No other platform does it.

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### Agent Management
- Department-based org with CEO cross-department view
- Per-agent personas, models, guardrails, budgets
- Display names for change management
- Pause/resume from dashboard

### Autonomous Execution
- Heartbeat engine: cron, webhook, manual, or chat
- Run lifecycle: queued -> executing -> succeeded/failed
- Atomic task checkout prevents double-work
- Session persistence across restarts

### Multi-Model Intelligence
- **Claude CLI** -- Pro subscription, flat cost
- **OpenRouter** -- 100+ models (GPT, Gemini, Llama, DeepSeek)
- **Perplexity** -- web search with citations
- **OpenAI** -- direct API access
- Smart router picks best model per task type

</td>
<td width="50%" valign="top">

### Workflow & Tasks
- Kanban board with drag-and-drop
- Due dates, priorities, phases, assignees
- Multi-step routines across departments
- Natural language scheduling ("Every weekday at 9am")
- Global search (Cmd+K)

### Cost Control & Governance
- Per-run token and cost tracking
- Budget cascade: agent -> department -> company
- Goal hierarchy with progress tracking
- Approval workflows with threaded comments
- Full decision and activity audit logs

### Integration & Extensibility
- 10 pre-built connector templates (Slack, HubSpot, GitHub, SMTP...)
- MCP server with 21 tools
- Plugin system with Worker thread isolation
- Company config export/import as templates
- File browser with upload and preview

</td>
</tr>
</table>

### Also includes
- **Bilingual** -- English and Quebec French natively (not translated)
- **Multi-user** -- Admin / member / viewer roles with department scoping
- **Model Sandbox** -- test any model from the browser
- **API Key management** -- AES-256-GCM encrypted, rotate from UI
- **Keyboard shortcuts** -- Cmd+K search, Cmd+1-9 navigation
- **Responsive** -- works on desktop and mobile
- **Loading skeletons** -- polished initial load experience

---

## Soul Engine -- agents that get better over time

No other platform has this. Every competitor ships static agent definitions -- you write a system prompt and hope it works. Orchestra's Soul Engine makes agents evolve through actual work.

**Layer 1: Guided Soul Builder**
A 7-step interview that builds agent personas through conversation, not prompt engineering. Non-technical users answer questions like "What does this agent do?" and "What should it never do?" -- the system generates a structured, versioned persona.

**Layer 2: Feedback-Driven Refinement**
- Thumbs up/down after every chat response (one click, non-intrusive)
- Optional daily/weekly pulse checks ("How did your agents do?")
- The system aggregates signals, identifies patterns, and proposes persona changes
- Proposals go through an approval workflow before applying

**Layer 3: Autonomous Self-Evaluation**
After each autonomous run, agents reflect on their own performance -- what worked, what was hard, what they'd change. These evaluations feed into the refinement engine, creating a continuous improvement loop.

**Always optional.** Every feedback prompt is dismissible in one click. The system works fine with zero user input. If someone dismisses feedback 3 times, it stops asking.

---

## Architecture

```
                HTTPS (443)
                    |
                [ Caddy ]             Reverse proxy + auto SSL
                    |
                [ App :3000 ]         Next.js 15 -- UI + API routes
                    |
                [ Bridge :3847 ]      Heartbeat engine + model routing
               /    |    \
        [ CLI ]  [ APIs ]  [ MCP ]    Claude, OpenRouter, Perplexity, OpenAI
                    |
               [ Postgres ]           34 tables, Drizzle ORM
```

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, TypeScript |
| Execution | Node.js, Express 5, SSE streaming, heartbeat scheduler |
| Database | PostgreSQL 16, Drizzle ORM, 34 tables |
| Auth | scrypt hashing, httpOnly session cookies, AES-256-GCM encryption |
| Infra | Docker Compose, Makefile, Caddy, GitHub Actions CI |

---

## Quick start

### Docker (recommended)

```bash
git clone https://github.com/AgentisLab/AgentisOrchestra.git
cd AgentisOrchestra
make setup    # generates .env with random secrets
make up       # starts app + bridge + postgres
```

Open `http://localhost:3000`. The setup wizard handles the rest.

### Local development

```bash
docker compose up -d db                    # postgres only
cd app && pnpm install && pnpm dev         # http://localhost:3000
cd bridge && pnpm install && pnpm dev      # http://localhost:3847
```

### Production (VPS / Mac Mini)

```bash
git clone https://github.com/AgentisLab/AgentisOrchestra.git /opt/agentis-orchestra
cd /opt/agentis-orchestra
make setup && nano .env    # set DOMAIN, API keys
docker compose -f docker-compose.prod.yml up -d
```

SSL auto-provisioned by Caddy. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide including Mac Mini deployment with launchd.

---

## Model providers

| Provider | Mode | Cost | Best for |
|----------|------|------|----------|
| Claude CLI | Pro subscription | Flat monthly | Primary workhorse (free tokens) |
| OpenRouter | API key | Per-token | 100+ models, flexibility |
| Perplexity | API key | Per-query | Research, web search |
| OpenAI | API key | Per-token | GPT-4o, specific tasks |

**Start with Claude CLI only.** Zero marginal cost. Add API keys later for specific models or research.

---

## Project structure

```
AgentisOrchestra/
├── app/                       Next.js 15 frontend + API
│   ├── src/app/api/           30+ API routes
│   ├── src/components/        25+ React components
│   ├── src/db/schema.ts       34 tables (Drizzle)
│   └── src/lib/               Auth, crypto, i18n, connectors
├── bridge/                    Execution engine
│   ├── heartbeat.ts           Autonomous agent loop
│   ├── providers.ts           Multi-model adapters
│   ├── router.ts              Smart model routing
│   └── mcp/                   MCP server (21 tools)
├── design/                    Prototypes + specs
├── docs/                      Deployment guides
├── tests/                     E2E test suites
├── docker-compose.yml         Development
├── docker-compose.prod.yml    Production
└── Makefile                   15 ops commands
```

---

## Makefile commands

```bash
make up          # Start all services
make down        # Stop all services
make logs        # Tail all logs
make health      # Check service health
make backup      # Database backup (gzipped)
make db-push     # Run schema migrations
make db-shell    # psql into database
make clean       # Full reset (removes all data)
```

---

## Built with

[Next.js 15](https://nextjs.org) &middot; [React 19](https://react.dev) &middot; [Tailwind CSS 4](https://tailwindcss.com) &middot; [Drizzle ORM](https://orm.drizzle.team) &middot; [PostgreSQL 16](https://postgresql.org) &middot; [Docker](https://docker.com) &middot; [TypeScript](https://typescriptlang.org)

---

## Who built this

**[AgentisLab](https://agentislab.ai)** -- a boutique AI firm in Quebec City, Canada. We don't advise on AI. We build it, run it, and ship it.

AgentisOrchestra is the platform we use internally and deploy to clients. It's open-source because the best way to show what we can do is to let you see it.

**Want us to set it up for your company?** [alex@agentislab.ai](mailto:alex@agentislab.ai)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture overview, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[Apache 2.0](LICENSE) -- AgentisLab 2026
