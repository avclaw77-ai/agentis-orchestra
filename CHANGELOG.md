# Changelog

All notable changes to AgentisOrchestra are documented here.

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
