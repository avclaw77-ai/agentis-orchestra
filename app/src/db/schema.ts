import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
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
  setupCompletedAt: timestamp("setup_completed_at"), // NULL = setup not done
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// =============================================================================
// DEPARTMENTS -- Organizational units (replaces workspaces)
// =============================================================================

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"),
  template: text("template"), // "engineering", "research", etc.
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
    id: text("id").primaryKey(), // "task-001"
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
// WORKFLOWS -- Autonomous execution
// =============================================================================

export const workflows = pgTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-wide
    name: text("name").notNull(),
    description: text("description"),
    steps: jsonb("steps").notNull().default([]), // ordered list of agent steps
    trigger: jsonb("trigger").default({}), // cron, webhook, manual
    isActive: boolean("is_active").default(false),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("workflows_department_idx").on(t.departmentId)]
)

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "cascade",
    }), // NULL = company-wide
    status: text("status").notNull().default("running"), // running | completed | failed | cancelled
    input: jsonb("input").default({}),
    output: jsonb("output").default({}),
    tokensUsed: integer("tokens_used").default(0),
    costCents: integer("cost_cents").default(0),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("workflow_runs_workflow_idx").on(t.workflowId),
    index("workflow_runs_department_idx").on(t.departmentId),
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
