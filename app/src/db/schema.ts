/**
 * AgentisOrchestra Database Schema
 *
 * 34 tables organized by domain:
 *
 *  CORE
 *   1. company              -- Singleton company record
 *   2. departments           -- Organizational units
 *   3. providerKeys          -- AI provider credentials (encrypted)
 *
 *  AUTH
 *   4. users                 -- Admin/viewer accounts
 *   5. sessions              -- Session tokens
 *
 *  AGENTS
 *   6. agents                -- Agent registry
 *   7. agentConfigs          -- Per-agent configuration (model, persona, guardrails)
 *   8. agentConfigRevisions  -- Config change audit trail
 *
 *  SKILLS
 *   9. skills                -- Skill definitions
 *  10. agentSkills           -- Agent-to-skill assignments
 *
 *  TASKS
 *  11. projects              -- Project groupings
 *  12. tasks                 -- Kanban task board items
 *  13. taskComments          -- Discussion on tasks
 *  14. labels                -- Task categorization labels
 *  15. taskLabels            -- Task-to-label join table
 *
 *  CHAT
 *  16. chatMessages          -- Agent conversation history
 *
 *  AUDIT
 *  17. activityLog           -- Agent action audit trail
 *  18. decisions             -- Decision log entries
 *
 *  ROUTINES
 *  19. routines              -- Named multi-step workflows
 *  20. routineTriggers       -- Cron / webhook / manual triggers
 *  21. routineSteps          -- Ordered steps within a routine
 *  22. routineRuns           -- Execution records for routine runs
 *
 *  HEARTBEAT
 *  23. agentRuntimeState     -- Per-agent runtime state and token totals
 *  24. heartbeatRuns         -- Individual heartbeat execution records
 *
 *  COST TRACKING
 *  25. costEvents            -- Per-call token/cost ledger
 *  26. budgetPolicies        -- Budget limits (agent/department/company)
 *  27. budgetIncidents       -- Threshold breach records
 *  28. agentWakeupRequests   -- Pending wakeup queue
 *
 *  GOALS
 *  29. goals                 -- Strategic goal hierarchy
 *
 *  APPROVALS
 *  30. approvalRequests      -- Human-in-the-loop governance
 *  31. approvalComments      -- Discussion on approval requests
 *
 *  COMPANY SKILLS
 *  32. companySkills         -- Versioned skill library
 *
 *  KNOWLEDGE
 *  33. documents             -- Department knowledge base
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// =============================================================================
// COMPANY -- Singleton (one install = one company)
// =============================================================================

export const company = pgTable("company", {
  id: text("id").primaryKey().default("default"),
  name: text("name").notNull(),
  mission: text("mission"),
  locale: text("locale").notNull().default("en"), // "en" | "fr"
  settings: jsonb("settings").default({}),
  budgetMonthlyCents: integer("budget_monthly_cents"), // company-wide budget
  setupCompletedAt: timestamp("setup_completed_at"), // NULL = setup not done
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// =============================================================================
// DEPARTMENTS -- Organizational units
// =============================================================================

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"),
  template: text("template"), // "engineering", "research", etc.
  budgetMonthlyCents: integer("budget_monthly_cents"), // per-department budget
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// =============================================================================
// PROVIDER KEYS -- AI provider credentials
// =============================================================================

export const providerKeys = pgTable("provider_keys", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  provider: text("provider").notNull().unique(), // "openrouter", "perplexity", "openai", "claude-cli"
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  isValid: boolean("is_valid").default(true),
  testedAt: timestamp("tested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// =============================================================================
// AUTH -- Users and sessions
// =============================================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("admin"), // admin | viewer
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sessions_token_idx").on(t.tokenHash)]
)

// =============================================================================
// AGENTS -- The core unit
// =============================================================================

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(), // "cio", "dev", "uiux"
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-level (CEO)
    name: text("name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("idle"), // idle | active | thinking
    isCeo: boolean("is_ceo").default(false),
    currentTask: text("current_task"),
    lastActive: timestamp("last_active"),
    heartbeatSchedule: text("heartbeat_schedule"), // cron expression, e.g. '0 * * * *'
    heartbeatEnabled: boolean("heartbeat_enabled").default(false),
  },
  (t) => [index("agents_department_idx").on(t.departmentId)]
)

export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-level
    persona: text("persona"), // system prompt / persona markdown
    model: text("model").default("claude-sonnet-4-6"),
    adapterType: text("adapter_type").default("sdk"), // sdk | cli | api | http
    adapterConfig: jsonb("adapter_config").default({}),
    guardrails: text("guardrails"), // rules the agent must follow
    dataSources: text("data_sources").array(), // knowledge base references
    reportsTo: text("reports_to"), // agent hierarchy
    budget: integer("budget"), // monthly cents cap
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("agent_configs_agent_idx").on(t.agentId),
    index("agent_configs_department_idx").on(t.departmentId),
  ]
)

export const agentConfigRevisions = pgTable(
  "agent_config_revisions",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }),
    changedKeys: text("changed_keys").array(),
    beforeConfig: jsonb("before_config"),
    afterConfig: jsonb("after_config"),
    changedBy: text("changed_by"),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("config_revisions_agent_idx").on(t.agentId)]
)

// =============================================================================
// SKILLS -- Agent capabilities
// =============================================================================

export const skills = pgTable(
  "skills",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    key: text("key").notNull().unique(), // "dev-build", "qa-review"
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"), // engineering, support, ops, etc.
    markdown: text("markdown"), // full skill definition
    trustLevel: text("trust_level").default("standard"), // standard | elevated | restricted
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("skills_key_idx").on(t.key),
    index("skills_category_idx").on(t.category),
  ]
)

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (t) => [
    index("agent_skills_agent_idx").on(t.agentId),
    index("agent_skills_skill_idx").on(t.skillId),
  ]
)

// =============================================================================
// TASKS -- Project management
// =============================================================================

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").references(() => departments.id, {
    onDelete: "cascade",
  }), // NULL = company-wide
  name: text("name").notNull(),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(), // "TASK-001"
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-wide CEO task
    title: text("title").notNull(),
    status: text("status").notNull().default("backlog"), // backlog | in-progress | review | done
    assignedTo: text("assigned_to"),
    createdBy: text("created_by"),
    project: text("project"),
    priority: text("priority").default("medium"), // low | medium | high | critical
    dependencies: text("dependencies").array(),
    notes: text("notes"),
    executionLockedAt: timestamp("execution_locked_at"), // atomic checkout
    checkoutRunId: text("checkout_run_id"), // which heartbeat run owns this task
    parentTaskId: text("parent_task_id").references((): any => tasks.id, {
      onDelete: "set null",
    }),
    phase: text("phase"), // research | spec | design | build | qa | deploy
    estimatedTokens: integer("estimated_tokens"),
    actualTokens: integer("actual_tokens").default(0),
    goalId: text("goal_id").references((): any => goals.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("tasks_department_idx").on(t.departmentId),
    index("tasks_status_idx").on(t.status),
    index("tasks_project_idx").on(t.project),
  ]
)

// =============================================================================
// TASK COMMENTS -- Discussion on tasks
// =============================================================================

export const taskComments = pgTable(
  "task_comments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    authorAgentId: text("author_agent_id"),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    runId: text("run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("task_comments_task_created_idx").on(t.taskId, t.createdAt)]
)

// =============================================================================
// LABELS -- Task categorization
// =============================================================================

export const labels = pgTable(
  "labels",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    color: text("color").default("#6b7280"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("labels_dept_name_idx").on(t.departmentId, t.name)]
)

export const taskLabels = pgTable(
  "task_labels",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: integer("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("task_labels_unique_idx").on(t.taskId, t.labelId)]
)

// =============================================================================
// CHAT -- Agent communication
// =============================================================================

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-wide
    channel: text("channel").notNull(), // agent id or channel name
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    modelId: text("model_id"),
    runId: text("run_id"),
    tokensUsed: integer("tokens_used").default(0),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("chat_department_channel_idx").on(t.departmentId, t.channel)]
)

// =============================================================================
// ACTIVITY & DECISIONS -- Audit trail
// =============================================================================

export const activityLog = pgTable(
  "activity_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-wide
    agent: text("agent").notNull(),
    action: text("action").notNull(), // start | complete | cancel | error
    task: text("task"), // label
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("activity_department_idx").on(t.departmentId),
    index("activity_created_idx").on(t.createdAt),
  ]
)

export const decisions = pgTable(
  "decisions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-wide
    decision: text("decision").notNull(),
    agent: text("agent").notNull(),
    reasoning: text("reasoning"),
    context: text("context"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("decisions_department_idx").on(t.departmentId)]
)

// =============================================================================
// ROUTINES -- Named multi-step agent workflows with scheduling
// =============================================================================

export const routines = pgTable(
  "routines",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }), // NULL = company-wide
    name: text("name").notNull(),
    description: text("description"),
    assigneeAgentId: text("assignee_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }), // primary agent (for single-agent routines)
    status: text("status").default("draft"), // draft | active | paused | archived
    concurrencyPolicy: text("concurrency_policy").default("skip"), // skip | queue | replace
    catchUpPolicy: text("catch_up_policy").default("skip"), // skip | run_once | run_all
    maxDurationMs: integer("max_duration_ms").default(600000), // 10 min
    lastTriggeredAt: timestamp("last_triggered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("routines_department_idx").on(t.departmentId),
    index("routines_status_idx").on(t.status),
  ]
)

export const routineTriggers = pgTable(
  "routine_triggers",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'cron' | 'webhook' | 'manual'
    cronExpression: text("cron_expression"), // for cron type
    cronHumanLabel: text("cron_human_label"), // "Every weekday at 9am" for display
    webhookPath: text("webhook_path"), // unique path for webhook type, e.g. '/hooks/daily-report'
    webhookSecret: text("webhook_secret"), // HMAC secret for webhook validation
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("routine_triggers_routine_idx").on(t.routineId),
    uniqueIndex("routine_triggers_webhook_path_idx").on(t.webhookPath),
  ]
)

export const routineSteps = pgTable(
  "routine_steps",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    promptTemplate: text("prompt_template").notNull(), // supports {{prev_output}} interpolation
    modelOverride: text("model_override"), // override the agent's default model for this step
    timeoutMs: integer("timeout_ms").default(300000), // 5 min per step
    dependsOnStepId: text("depends_on_step_id"), // if set, waits for this step to complete
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("routine_steps_routine_order_idx").on(t.routineId, t.stepOrder),
  ]
)

export const routineRuns = pgTable(
  "routine_runs",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    triggerType: text("trigger_type").notNull(), // 'cron' | 'webhook' | 'manual'
    triggerPayload: jsonb("trigger_payload").default({}), // webhook body or manual params
    status: text("status").default("queued"), // queued | running | completed | failed | cancelled | timed_out
    currentStep: integer("current_step").default(0),
    stepResults: jsonb("step_results").default([]), // array of { stepId, agentId, status, output, tokens, costCents, durationMs }
    totalTokens: integer("total_tokens").default(0),
    totalCostCents: integer("total_cost_cents").default(0),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("routine_runs_routine_created_idx").on(t.routineId, t.createdAt),
    index("routine_runs_status_idx").on(t.status),
  ]
)

// =============================================================================
// HEARTBEAT -- Autonomous agent execution
// =============================================================================

export const agentRuntimeState = pgTable("agent_runtime_state", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  stateJson: jsonb("state_json").default({}),
  totalInputTokens: integer("total_input_tokens").default(0),
  totalOutputTokens: integer("total_output_tokens").default(0),
  totalCostCents: integer("total_cost_cents").default(0),
  lastRunId: text("last_run_id"),
  lastRunStatus: text("last_run_status"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const heartbeatRuns = pgTable(
  "heartbeat_runs",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    wakeupSource: text("wakeup_source").notNull(), // 'cron' | 'webhook' | 'manual' | 'chat' | 'assignment'
    status: text("status").notNull().default("queued"), // queued | claimed | executing | succeeded | failed | cancelled | timed_out
    contextSnapshot: jsonb("context_snapshot").default({}),
    prompt: text("prompt"),
    modelId: text("model_id"),
    sessionIdBefore: text("session_id_before"),
    sessionIdAfter: text("session_id_after"),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),
    costCents: integer("cost_cents").default(0),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("heartbeat_runs_agent_started_idx").on(t.agentId, t.startedAt),
    index("heartbeat_runs_status_idx").on(t.status),
  ]
)

// =============================================================================
// COST TRACKING -- Budget enforcement & ROI
// =============================================================================

export const costEvents = pgTable(
  "cost_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null",
    }),
    modelId: text("model_id").notNull(),
    provider: text("provider").notNull(), // 'claude-cli' | 'openrouter' | 'perplexity' | 'openai'
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").default(0),
    costCents: integer("cost_cents").notNull().default(0),
    taskId: text("task_id"),
    billingType: text("billing_type").default("metered"), // 'metered' | 'subscription'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("cost_events_department_created_idx").on(t.departmentId, t.createdAt),
    index("cost_events_agent_created_idx").on(t.agentId, t.createdAt),
  ]
)

export const budgetPolicies = pgTable(
  "budget_policies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    scopeType: text("scope_type").notNull(), // 'company' | 'department' | 'agent'
    scopeId: text("scope_id"), // NULL for company scope
    amountCents: integer("amount_cents").notNull(),
    warnPercent: integer("warn_percent").default(80),
    hardStopEnabled: boolean("hard_stop_enabled").default(true),
    windowKind: text("window_kind").default("calendar_month"), // 'calendar_month' | 'lifetime'
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    uniqueIndex("budget_policies_scope_idx").on(
      t.scopeType,
      t.scopeId,
      t.windowKind
    ),
  ]
)

export const budgetIncidents = pgTable(
  "budget_incidents",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    policyId: integer("policy_id")
      .notNull()
      .references(() => budgetPolicies.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id"),
    thresholdType: text("threshold_type").notNull(), // 'warn' | 'hard_stop'
    amountLimit: integer("amount_limit").notNull(),
    amountObserved: integer("amount_observed").notNull(),
    status: text("status").notNull().default("open"), // 'open' | 'resolved' | 'dismissed'
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("budget_incidents_policy_idx").on(t.policyId)]
)

export const agentWakeupRequests = pgTable(
  "agent_wakeup_requests",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'cron' | 'webhook' | 'manual' | 'chat' | 'assignment'
    reason: text("reason"),
    payload: jsonb("payload").default({}),
    status: text("status").notNull().default("queued"), // queued | claimed | finished
    coalescedCount: integer("coalesced_count").default(0),
    runId: text("run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("wakeup_requests_agent_status_idx").on(t.agentId, t.status),
  ]
)

// =============================================================================
// GOALS -- Strategic goal hierarchy
// =============================================================================

export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }), // NULL = company mission
    title: text("title").notNull(),
    description: text("description"),
    parentId: text("parent_id").references((): any => goals.id, {
      onDelete: "set null",
    }),
    status: text("status").default("planned"), // planned | active | completed | cancelled
    ownerAgentId: text("owner_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("goals_department_idx").on(t.departmentId),
    index("goals_parent_idx").on(t.parentId),
  ]
)

// =============================================================================
// APPROVAL REQUESTS -- Governance workflows
// =============================================================================

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(), // 'agent_hire' | 'budget_override' | 'strategy_proposal' | 'task_escalation' | 'routine_activation'
    title: text("title").notNull(),
    description: text("description"),
    requestedByAgentId: text("requested_by_agent_id").references(
      () => agents.id,
      { onDelete: "set null" }
    ),
    requestedByUserId: text("requested_by_user_id"),
    status: text("status").notNull().default("pending"), // pending | revision_requested | approved | rejected | cancelled
    payload: jsonb("payload").default({}),
    decisionNote: text("decision_note"),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("approval_requests_status_idx").on(t.status),
    index("approval_requests_department_idx").on(t.departmentId),
  ]
)

// =============================================================================
// APPROVAL COMMENTS -- Discussion on approval requests
// =============================================================================

export const approvalComments = pgTable(
  "approval_comments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    approvalId: integer("approval_id")
      .notNull()
      .references(() => approvalRequests.id, { onDelete: "cascade" }),
    authorAgentId: text("author_agent_id"),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
)

// =============================================================================
// COMPANY SKILLS -- Versioned skill library
// =============================================================================

export const companySkills = pgTable(
  "company_skills",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    version: integer("version").default(1),
    sourceType: text("source_type").default("local"), // 'local' | 'github' | 'url' | 'bundled'
    sourceRef: text("source_ref"), // github repo URL, external URL, etc.
    definition: jsonb("definition").default({}), // skill configuration/schema
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("company_skills_key_idx").on(t.key)]
)

// =============================================================================
// DOCUMENTS -- Department knowledge base
// =============================================================================

export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  departmentId: text("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  format: text("format").default("markdown"),
  body: text("body"),
  revisionNumber: integer("revision_number").default(1),
  createdByAgentId: text("created_by_agent_id"),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
