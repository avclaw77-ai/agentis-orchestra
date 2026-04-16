# Changelog

All notable changes to AgentisOrchestra are documented here.

## [0.3.0] -- 2026-04-16

### Added
- **Agent chat working end-to-end** -- CLI execution via host bridge, SSE streaming to browser
- **Verbose chat** -- shows model selection, thinking, tool use, tool results in real-time
- **Agent "Run Now" button** -- manually trigger any agent from profile panel
- **10 connector templates** -- Slack, HubSpot, GitHub, CSV/Excel, PDF, PostgreSQL, MySQL, SMTP, Webhooks (in/out)
- **Connector library UI** -- browse by category, search, configure with encrypted credentials
- **Approvals in main nav** -- promoted from Settings sub-tab to top-level Operate view
- **Chat history persistence** -- loads previous messages on page load
- **Login page branding** -- Orchestra logo, "Powered by AgentisLab" footer

### Security
- Fixed `/api/auth/me` returning admin role for unauthenticated users
- Fixed `/api/company/export` missing auth check
- Sanitized setup API error messages (no raw DB errors to client)
- Setup cookie (`ao_setup_done`) set on both login and register

### Fixed
- Task ID race condition under concurrent creation (count + fallback)
- Setup wizard back/forward department duplication
- Duplicate CLI auto-test effect (double API call)
- Chat panel TypeScript build error (`unknown` type in JSX)
- CLI-only setup flow (no API key required)

### Token Economics
- `--max-turns` limit (5 chat, 3 heartbeat) prevents runaway agents
- Execution timeout (120s chat, 60s heartbeat)
- Real token usage parsed from CLI output (not estimated)
- Heartbeats route to Haiku (cheap), chat to Sonnet (quality)
- `--verbose` only for user-facing chat
- Design brief: `design/TOKEN_ECONOMICS.md`

### Architecture
- Bridge runs on host via systemd (not Docker) for CLI access
- `orchestra` user for non-root bridge execution
- Host-to-Docker bridge via `host.docker.internal`
- 82 automated E2E tests passing
- 10 connector definitions in `app/src/lib/connectors/`

## [0.2.0] -- 2026-04-16

### Added
- **Multi-user support** -- admin/member/viewer roles with multi-department access
- **Team management UI** -- invite users, assign departments, edit roles (Settings > Team)
- **Agent display names** -- optional friendly names for change management (e.g. "Sophie" instead of "Dev")
- **Agent CRUD API** -- GET/PATCH/DELETE `/api/agents/[id]` for agent-level field updates
- **User profile endpoint** -- `/api/auth/me` returns role + department access

### Security
- **Auth guards** on all critical API routes (agents, departments, chat, users, company)
- **Role enforcement** -- admin-only for user/company mutations, viewer blocked from writes
- **Bridge CORS** restricted to APP_URL origin (was open `*`)
- **Docker** -- PostgreSQL bound to 127.0.0.1 (was 0.0.0.0)
- **Docker** -- pgAdmin requires explicit PGADMIN_PASSWORD (was default "admin")
- **.env.example** -- encryption key placeholder now fails on use (was valid zero-key)

### Fixed
- **Wizard icon invisible** -- blue SVG on blue background. Created white `logo-mark.svg` variant
- **displayName** shown consistently across all components (roster, profile, dashboard, kanban, org-chart, routine-builder)

### Documentation
- Updated Paperclip Parity chart to reflect current state (most Tier 1+2 features complete)
- Created `design/SECURITY_BACKLOG.md` -- tracked medium/low security items
- Created `design/SYSTEM_INTEGRATION.md` -- connector agents + MCP hybrid approach
- Created `design/MULTI_USER_V2.md` -- flexible permissions model

### Architecture
- 34 database tables, 38 API routes, 32 components
- Shell adapts to user role (admin=CEO View, member=filtered departments)
- Department selector filters based on user_departments join table

## [0.1.0] -- 2026-04-15

### Added
- **Web-based setup wizard** with 7 steps, department templates, and live provider testing
- **AI-powered onboarding** -- analyzes your company and proposes a tailored agent team
- **Heartbeat engine** -- agents execute autonomously on cron/webhook/manual triggers
- **Multi-model routing** -- Claude CLI, OpenRouter, Perplexity, OpenAI with smart task-type routing
- **Department-based org model** -- CEO agent sees all departments, department views are scoped
- **Task management** with Kanban board, atomic checkout, comments, and activity logging
- **Cost tracking** with per-run token counting, budget cascade (agent->department->company), ROI dashboard
- **Routines** -- named multi-step workflows with cron/webhook/manual triggers and cross-department agent chains
- **Goal hierarchy** -- company mission -> department goals -> tasks
- **Approval workflows** with threaded comments and status machine
- **Versioned skill library** with multi-source support (local, GitHub, URL)
- **MCP server** with 21 tools for external agent integration
- **Plugin system** with Worker thread isolation and crash recovery
- **Bilingual UI** -- English and Quebec French with 70+ translation keys
- **Company export/import** for portable templates
- **Docker Compose** deployment with Makefile, healthchecks, backup scripts
- **Production compose** with Caddy SSL, resource limits, log rotation
- **CI/CD** via GitHub Actions (lint, type check, build, deploy)
- **Session auth** with scrypt hashing and AES-256-GCM key encryption
- **Sidebar navigation** with collapsible groups, department selector, mobile drawer

### Architecture
- 34 database tables (Drizzle ORM + PostgreSQL 16)
- Next.js 15 + React 19 + Tailwind 4 frontend
- Node.js bridge with SSE streaming execution engine
- 116 files, 25,000+ lines of TypeScript
