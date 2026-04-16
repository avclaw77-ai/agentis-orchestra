# AgentisOrchestra

Docker-first multi-agent orchestration platform. The foundation for everything AgentisLab builds.

## What This Is

One install = one company. Department-by-department agent teams, linked at CEO level. Not a dev tool -- the operating system for AI-powered organizations. Any domain: engineering, research, ops, support, sales.

## Architecture

```
docker-compose.yml          # One command to run everything
app/                        # Next.js 15 frontend + API (port 3000)
bridge/                     # Agent execution engine + heartbeat (port 3847)
postgres                    # Embedded via Docker (port 5432)
```

## Org Model

```
COMPANY (singleton)
  ├── CEO Agent (cross-department, sees all)
  ├── Engineering Dept → Dev, QA, Ops
  ├── Design Dept → UIUX
  ├── Research Dept → RnD
  └── Operations Dept → Maxx
```

## Stack

- **App**: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, TypeScript
- **Bridge**: Node.js + Express, multi-provider model routing, heartbeat engine
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Auth**: Session-based (bcrypt + httpOnly cookies)
- **Encryption**: AES-256-GCM for provider API keys
- **Infrastructure**: Docker Compose, Makefile

## Model Providers

| Provider | Mode | Cost Model | Use Case |
|----------|------|-----------|----------|
| Claude Code CLI | Pro subscription | Flat monthly | Primary workhorse -- free tokens |
| OpenRouter | API key | Per-token | 100+ models, best-model routing |
| Perplexity | API key | Per-query | Research, web search, fact-checking |
| OpenAI | API key | Per-token | GPT models, specific strengths |

**Economics**: CLI-first (Pro sub = cost control). API keys stored encrypted in DB, configured during setup wizard.

## Key Design Decisions

- **Single-company**: One install = one company. Departments are the org unit.
- **Department-first**: Every table has `department_id` (nullable for CEO-level items).
- **Docker-first**: `docker compose up` on any VPS or Mac.
- **CLI-first economics**: Pro subscription as default, API keys when scaling.
- **Guided config**: Templates, natural language cron, smart defaults, inline help.
- **Heartbeat-first**: Agents execute autonomously via heartbeat, not just chat.
- **Bilingual**: EN/FR natively. Quebec French, not Parisian.
- **Light theme only**: All internal apps use light mode.

## First Run

After `docker compose up`, open localhost:3000:
1. Setup wizard: language, admin account, company, providers, departments, agents
2. CEO agent auto-created at company level
3. Dashboard with agents grouped by department

## Development

```bash
# Full stack
docker compose up        # or: make up

# Local dev
cd app && pnpm dev
cd bridge && pnpm dev

# Ops
make health              # check all services
make backup              # pg_dump to backups/
make db-push             # run Drizzle migrations
make logs                # tail all logs
```

## Conventions

- pnpm as package manager
- Drizzle ORM for all DB access
- API routes in `app/src/app/api/`
- Components in `app/src/components/`
- Design tokens via CSS variables, never hardcoded colors
- 80-20 rule. Ship working systems.
