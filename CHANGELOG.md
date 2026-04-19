# Changelog

All notable changes to AgentisOrchestra are documented here.

## [1.0.1] -- 2026-04-19

### Platform Readiness

**Critical install fixes (100% of fresh installs would have failed):**
- Auto-migration: `entrypoint.sh` runs `drizzle-kit push` before server start
- ENCRYPTION_KEY: `.env.example` placeholder now matches `setup.sh` sed pattern
- Setup lockout: handles "user exists but setup incomplete" state (no more 403 deadlock)

**Error handling (13 issues fixed across 9 API files):**
- Auth route: try/catch on all DB operations
- Tasks: title 500 char limit, notes 5000 char limit, status enum validation
- Conversations: agent existence check before create
- Agents DELETE: existence check with 404
- Company import: admin-only check
- Users GET: auth guard added (was unauthenticated)
- Chat: bridge unreachable returns 503 (was unhandled crash)
- Attachments: task ID format validation (path traversal prevention)
- Providers: encrypt() try/catch

**Performance:**
- LIMIT added to 6 unbounded queries (approvals, goals, comments, skills, routines)

**Install polish:**
- AUTH_TOKEN added to `.env.example`
- `setup.sh` success message matches README
- `plugins/.gitkeep` added to repo
- `.env.example` included in public repo (was excluded by rsync)
- Dockerfile: uploads directory created for task attachments

**Repo cleanup:**
- Removed site prototypes and marketing content from `design/`
- Platform repo contains only platform code and technical design docs

### Tests
- 69/69 automated tests green (29 Soul Engine + 40 Runtime)
- 10/10 edge case tests green (long strings, special chars, path traversal, unauth)
- 102/104 auth handlers verified (2 intentionally public)
- Fresh install simulation verified from clean clone

## [1.0.0] -- 2026-04-18

### Soul Engine -- Agents that get better over time
- **Layer 1: Guided Soul Builder** -- 7-step interview builds agent personas through conversation, not prompt engineering. Structured, versioned output.
- **Layer 2: Feedback-Driven Refinement** -- thumbs up/down on chat responses, optional daily/weekly pulse checks, automatic signal aggregation, persona change proposals through approval workflow
- **Layer 3: Autonomous Self-Evaluation** -- agents reflect on performance after each heartbeat run (what worked, what was hard, what to change), feeds refinement engine
- 5 new DB tables: agent_feedback, persona_versions, persona_proposals, agent_self_evaluations, feedback_preferences
- 5 API routes, 5 UI components, bridge self-eval hook
- Hard rule: all feedback always optional, dismissible in one click, auto-backoff on repeated dismissal

### Model Governance
- **Admin model controls** -- select which models are available to the organization
- **Provider deduplication** -- models available via direct API key greyed out in OpenRouter
- **Live model fetch** -- OpenAI shows all models from API key, not a hardcoded list
- **GPT-5.4 family** -- GPT-5.4, GPT-5.4 Pro, GPT-5.4 Mini + o4-mini
- **Subscription tier** -- Claude CLI labeled "SUB" (not "FREE"), separate Anthropic API models with per-token pricing
- **Router respects config** -- never overrides a manually set agent model

### Features
- **Kanban drag-and-drop** -- @hello-pangea/dnd with grip handles and drop zone highlights
- **Global search modal** -- Cmd+K searches agents, tasks, goals, routines, navigation
- **Multi-conversation per agent** -- conversation sidebar with create/rename/delete
- **Clipboard image paste** -- Ctrl+V captures images directly into chat
- **Agent pause/resume** -- hover toggle on dashboard agent cards
- **Task due dates** -- schema, create dialog, kanban cards (overdue in red), task detail
- **Task dependencies** -- blocking/blocked-by badges with add/remove UI
- **Task file attachments** -- upload, list, size display in task detail (10MB limit)
- **Tool permissions per agent** -- checkbox grid in agent config (Read, Write, Edit, Bash, Grep, WebSearch, WebFetch)
- **Edit/retry on chat messages** -- inline edit textarea, retry button on user messages
- **Token count per message** -- usage display on assistant messages from SSE done events
- **Live run view** -- modal with real-time status polling, token/cost/elapsed stats
- **System logs** -- Settings > Logs tab with level/source filters, auto-refresh
- **Loading skeletons** -- dashboard, kanban, chat skeleton components
- **Onboarding checklist** -- first-run progress tracker on dashboard (dismissible)
- **Pulse check** -- periodic agent rating card on dashboard (optional, auto-backoff)

### Security
- **Auth guards** on all 25 API routes (58 handlers) -- defense-in-depth with getSessionUser()
- **Rate limiting** -- /api/setup/test-provider: 5 req/min per IP
- **CSP headers** -- Content-Security-Policy + X-Frame-Options + nosniff on all responses
- **ENCRYPTION_KEY validation** -- startup check with clear error messages
- **Upload size limit** -- 10MB max on task attachments
- **Conversation ownership** -- verify exists before PATCH/DELETE

### Polish
- **French i18n** -- 60+ new translation strings for all sprint features
- **Help tooltips** -- title attributes on form labels (create task, agent config)
- **Dashboard polling** -- reduced from 30s to 10s
- **9 QA bugs fixed** -- edit/retry querySelector, live run URL, onboarding flash, task ID race, search globalIdx, bridge stream leak, NaN limit, conversation ownership

### Infrastructure
- **GitHub org repo** -- github.com/AgentisLab/AgentisOrchestra
- **GitHub Actions CI** -- lint, typecheck, build (app + bridge), Docker build
- **GitHub Pages** -- microsite deployed at orchestra.agentislab.ai
- **GitHub Discussions** -- welcome + roadmap threads seeded
- **v0.4.0 release** -- full release notes with 10 topics

## [0.4.0] -- 2026-04-17

### Added
- **Models Sandbox** -- test any model from the browser with prompt presets and markdown rendering
- **API Key Management** -- add, rotate, delete provider keys from Models > API Keys (encrypted AES-256-GCM)
- **Files View** -- browse agent outputs, preview text/code/markdown, upload files, filter by agent
- **File Attachments in Chat** -- attach files via paperclip button, text/image support
- **Password Change** -- Settings > General, verifies current password, scrypt hashing
- **Approval Badge** -- red count badge on Approvals nav when pending requests exist
- **Task Search/Filter** -- search by title, filter by priority and assignee on Kanban board
- **Skills Library Upgrade** -- search, source filter, structured definition display (23 skills populated)
- **Keyboard Shortcuts** -- Cmd+K (chat), Cmd+1-9 (nav), Escape (close panels)
- **Contextual Help Tooltips** -- hover descriptions on all nav items
- **10 Connector Templates** -- Slack, HubSpot, GitHub, CSV/Excel, PDF, PostgreSQL, MySQL, SMTP, Webhooks
- **Mac Mini Deployment Guide** -- launchd plist, full macOS setup procedure

### Fixed
- **Login works on HTTP** -- session cookie Secure flag only when SECURE_COOKIES=true
- **Login redirect loop** -- / goes to /login not /setup when cookie missing
- **Login form hydration** -- native submit prevented before React attaches handler
- **Login error messages** -- red alert box with specific messages (wrong password, disabled, connection)
- **Chat markdown rendering** -- responses render bold, lists, code blocks, tables via react-markdown
- **Chat stop button** -- AbortController kills generation, red stop icon in header
- **Chat copy button** -- hover-reveal clipboard copy on assistant messages
- **Chat image upload** -- binary files handled as base64, not garbage text
- **9 responsive UI fixes** -- mobile touch targets, wrapping, padding across all views

### Security
- Auth bypass on /api/auth/me fixed (was returning admin for unauthenticated)
- Setup API error messages sanitized (no raw DB errors)
- Company export requires admin auth
- Task ID race condition fixed (count + fallback)

### Documentation
- Feature gap analysis: design/FEATURE_GAPS.md (25 items tracked)
- Token economics: design/TOKEN_ECONOMICS.md
- Connector plan: design/CONNECTORS_PLAN.md
- Mac Mini deployment: docs/DEPLOYMENT.md Path 4
- 82 E2E API tests + 37 user flow tests

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
