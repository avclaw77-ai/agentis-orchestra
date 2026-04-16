# Paperclip Parity Analysis

## Scale Comparison

| Metric | Paperclip | AgentisOrchestra (today) | Target |
|--------|-----------|-------------------------|--------|
| DB tables | 77 | 14 | ~35 |
| API endpoints | 100+ | 8 | ~50 |
| UI pages | 52 | 5 | ~20 |
| Components | 180+ | 6 | ~40 |
| Adapters | 10 built-in | 4 providers | 4 + plugin system |
| Service files | 110+ | 3 | ~20 |

We don't replicate 77 tables. We replicate the FEATURES that matter for $1k/mo, adapted to our department model.

---

## Feature Parity Matrix

### TIER 1: MUST HAVE (Phases 0-3) -- required for first paying client

| Feature | Paperclip Implementation | Our Plan Status | Gap |
|---------|------------------------|-----------------|-----|
| **Web setup wizard** | CLI-only (`pnpm onboard`) | Phase 0 (web-based) | WE'RE AHEAD |
| **Agent CRUD + hierarchy** | agents, agent_configs, reportsTo | Have schema, need UI | Small gap |
| **Agent execution engine** | 190KB heartbeat service, run lifecycle, session persistence | Basic session manager | LARGE GAP |
| **Task/issue management** | 14 tables (issues, comments, attachments, labels, relations, work products) | 1 table, placeholder UI | LARGE GAP |
| **Chat/communication** | issue_comments with threading, @mentions | SSE chat, no persistence yet | Medium gap |
| **Cost tracking** | cost_events + finance_events, per-run/agent/project | Planned Phase 3, not built | Full gap |
| **Budget enforcement** | budget_policies + budget_incidents, auto-pause, approval overrides | Planned Phase 3, not built | Full gap |
| **Activity audit trail** | activity_log with actor tracking | Table exists, not populated | Medium gap |
| **Auth** | BetterAuth, sessions, agent JWTs, API keys | Bearer token only | LARGE GAP |
| **Multi-model routing** | None (single adapter per agent) | BUILT AND WORKING | WE'RE AHEAD |
| **Department org model** | None (flat company) | Schema done | WE'RE AHEAD |
| **Docker deployment** | Dockerfile + embedded PG | Docker Compose + healthchecks | WE'RE AHEAD |

### TIER 2: SHOULD HAVE (Phases 4-5) -- needed within 6 months

| Feature | Paperclip | Our Plan | Gap |
|---------|-----------|----------|-----|
| **Routines/workflows** | routines with cron/webhook, concurrency + catch-up policies | Planned Phase 4 | Full gap |
| **Goal hierarchy** | goals table, company->project->task ancestry | Planned Phase 5 | Full gap |
| **Approval workflows** | approvals, approval_comments, linked to issues | Planned Phase 5 | Full gap |
| **Company export/import** | Structured markdown dirs + YAML manifest | Planned Phase 5 (JSON) | Full gap |
| **Git worktree isolation** | execution_workspaces, per-issue branches, provision scripts | Not in plan | NEW GAP |
| **Agent runtime state** | agent_runtime_state table (session, tokens, cost accumulation) | Not in plan | NEW GAP |
| **Agent wakeup requests** | agent_wakeup_requests (queued wakeups with coalescing) | Not in plan | NEW GAP |
| **Skill versioning** | company_skills, multi-source (GitHub, URLs, bundled) | Not in plan | NEW GAP |
| **Issue execution decisions** | approval + review stages during task execution | Not in plan | NEW GAP |
| **Secret management** | company_secrets + versions, provider abstraction, rotation | provider_keys table | Partial |
| **Document management** | documents + issue_documents, revision history | Not in plan | NEW GAP |

### TIER 3: NICE TO HAVE (Phase 6+) -- differentiators or future roadmap

| Feature | Paperclip | Priority |
|---------|-----------|----------|
| Plugin system (full SDK, worker isolation, 40+ capabilities) | Sophisticated | Future |
| MCP server (40+ tools) | Built-in | Phase 6 |
| Feedback/voting system | 71KB service | Future |
| Work products (deliverables per issue) | issue_work_products | Future |
| Issue relations (blocking) | issue_relations | Future |
| Workspace runtime services (port allocation) | workspace_runtime_services | Future |
| Plugin UI slots (15 types) | sidebar, toolbar, settings, etc. | Future |
| Inbox with read/archive state | inbox_dismissals, issue_read_states | Future |
| Full financial event tracking | finance_events (12+ event kinds) | Future |
| CLI auth challenges | cli_auth_challenges | Future |
| Company logos/branding | company_logos | Future |

---

## Tables We Need to Add (prioritized)

### Phase 0-1 (add now)
```
users                    -- session auth (QA critical C2)
sessions                 -- auth sessions
```

### Phase 2 (tasks)
```
task_comments            -- already planned
task_attachments         -- file attachments to tasks
task_labels              -- label/tag system
labels                   -- label definitions per department
```

### Phase 3 (costs)
```
cost_events              -- already planned, add finance granularity
budget_policies          -- scope (company/department/agent), window, thresholds
budget_incidents         -- threshold violations with resolution
```

### Phase 4 (execution)
```
agent_runtime_state      -- session persistence, accumulated tokens/cost
agent_wakeup_requests    -- queued wakeups with coalescing
heartbeat_runs           -- full execution lifecycle tracking
heartbeat_run_events     -- event stream per run
execution_workspaces     -- git worktree isolation per task
```

### Phase 5 (governance)
```
goals                    -- already planned
approval_requests        -- already planned, add comments
approval_comments        -- threaded discussion on approvals
documents                -- general docs with revision history
task_documents           -- link docs to tasks
```

---

## Key Architectural Patterns to Replicate

### 1. Heartbeat Execution Model
Paperclip's core loop:
1. Wakeup request created (cron, webhook, assignment, manual)
2. Run queued with context snapshot (task, project, agent config)
3. Run claimed by heartbeat service (atomic checkout)
4. Budget pre-check (reject if over limit)
5. Workspace resolved (git worktree or existing)
6. Agent adapter invoked with full context
7. Tokens/cost tracked per run
8. Session state persisted (survives restart)
9. Run finalized (succeeded/failed/cancelled/timed_out)
10. Activity logged

### 2. Atomic Task Checkout
- `execution_locked_at` timestamp on tasks
- `checkout_run_id` links task to active run
- Prevents two agents working same task
- Auto-release on run completion/failure

### 3. Budget Cascade
- Budget policies at company, department (project in Paperclip), and agent level
- Window kinds: calendar month or lifetime
- Soft alert at configurable % (default 80%)
- Hard stop pauses the scope
- Incident created, requires approval to resume
- Pre-execution check blocks new runs

### 4. Agent Runtime State
Separate from agent config:
- `session_id` -- current execution session
- `state_json` -- adapter-specific state (conversation history, etc.)
- `total_input_tokens`, `total_output_tokens`, `total_cost_cents`
- Persists across runs, survives restarts

---

## What We DON'T Need to Replicate

1. **Multi-company isolation** -- we're single-company, department-based
2. **Company memberships/roles** -- simpler: admin user + agents
3. **Issue prefix system** (PAP-001) -- nice but not critical
4. **Full plugin SDK** -- defer to Phase 6+
5. **Plugin UI slots** -- our UI is simpler
6. **Feedback/voting** -- internal tool, not needed
7. **Finance events** (12+ kinds) -- cost_events is enough for now
8. **CLI auth challenges** -- we have web auth
9. **Asset/file management** -- defer until needed
10. **Workspace runtime services** (port allocation) -- overkill for our model
