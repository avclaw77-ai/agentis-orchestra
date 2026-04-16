/**
 * MCP Tool definitions -- expose AgentisOrchestra via JSON-RPC tools.
 *
 * Each tool has: name, description, inputSchema (JSON Schema), handler.
 * Handlers call bridge/db.ts functions and return structured results.
 */

import type { MCPTool } from "./server.js"
import * as db from "../db.js"

// =============================================================================
// Helper: get a postgres `sql` handle from db module for raw queries
// We import it lazily since db.initDb() must be called first.
// =============================================================================

let sql: ReturnType<typeof import("postgres")> | null = null

function getSql() {
  if (!sql) {
    // Access the sql connection via the db module internals
    // We'll use a helper that db exposes
    sql = (db as any)._sql?.() ?? null
  }
  return sql
}

// =============================================================================
// Direct DB query helpers (for tools that need queries not in db.ts)
// =============================================================================

async function query(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  const s = getSql()
  if (!s) return []
  try {
    return (await (s as any)(strings, ...values)) as Record<string, unknown>[]
  } catch (err) {
    console.error("[mcp-tools] query error:", err)
    return []
  }
}

// =============================================================================
// Task Tools
// =============================================================================

const createTask: MCPTool = {
  name: "create_task",
  description:
    "Create a new task. Returns the task ID. Optionally assign to an agent, set priority, department, and notes.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title" },
      departmentId: { type: "string", description: "Department ID (optional)" },
      assignedTo: { type: "string", description: "Agent ID to assign (optional)" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        description: "Priority level (default: medium)",
      },
      notes: { type: "string", description: "Task notes / description" },
    },
    required: ["title"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    const id = `task-${crypto.randomUUID()}`
    try {
      await s`
        INSERT INTO tasks (id, department_id, title, status, assigned_to, priority, notes)
        VALUES (
          ${id},
          ${(params.departmentId as string) ?? null},
          ${params.title as string},
          'backlog',
          ${(params.assignedTo as string) ?? null},
          ${(params.priority as string) ?? "medium"},
          ${(params.notes as string) ?? null}
        )
      `
      return { taskId: id }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to create task" }
    }
  },
}

const updateTask: MCPTool = {
  name: "update_task",
  description: "Update a task's status, assignment, or notes.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
      status: {
        type: "string",
        enum: ["backlog", "in-progress", "review", "done"],
        description: "New status",
      },
      assignedTo: { type: "string", description: "New agent assignment" },
      notes: { type: "string", description: "Updated notes" },
    },
    required: ["taskId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    const updates: string[] = []
    const taskId = params.taskId as string

    try {
      // Build dynamic update
      if (params.status) {
        await s`UPDATE tasks SET status = ${params.status as string}, updated_at = NOW() WHERE id = ${taskId}`
      }
      if (params.assignedTo !== undefined) {
        await s`UPDATE tasks SET assigned_to = ${(params.assignedTo as string) ?? null}, updated_at = NOW() WHERE id = ${taskId}`
      }
      if (params.notes !== undefined) {
        await s`UPDATE tasks SET notes = ${(params.notes as string) ?? null}, updated_at = NOW() WHERE id = ${taskId}`
      }
      return { updated: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to update task" }
    }
  },
}

const listTasks: MCPTool = {
  name: "list_tasks",
  description: "List tasks, optionally filtered by department, status, or assignee.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Filter by department" },
      status: { type: "string", description: "Filter by status" },
      assignedTo: { type: "string", description: "Filter by assigned agent" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { tasks: [] }

    const limit = (params.limit as number) || 50
    try {
      let rows: Record<string, unknown>[]

      if (params.departmentId && params.status) {
        rows = await s`
          SELECT * FROM tasks
          WHERE department_id = ${params.departmentId as string}
            AND status = ${params.status as string}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      } else if (params.departmentId) {
        rows = await s`
          SELECT * FROM tasks
          WHERE department_id = ${params.departmentId as string}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      } else if (params.status) {
        rows = await s`
          SELECT * FROM tasks WHERE status = ${params.status as string}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      } else if (params.assignedTo) {
        rows = await s`
          SELECT * FROM tasks WHERE assigned_to = ${params.assignedTo as string}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      } else {
        rows = await s`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ${limit}`
      }

      return { tasks: rows }
    } catch (err) {
      return { tasks: [], error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const getTask: MCPTool = {
  name: "get_task",
  description: "Get a single task with its comments.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
    },
    required: ["taskId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const tasks = await s`SELECT * FROM tasks WHERE id = ${params.taskId as string}`
      if (tasks.length === 0) return { error: "Task not found" }

      const comments = await s`
        SELECT * FROM task_comments WHERE task_id = ${params.taskId as string}
        ORDER BY created_at ASC
      `
      return { task: tasks[0], comments }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const addComment: MCPTool = {
  name: "add_comment",
  description: "Add a comment to a task.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
      body: { type: "string", description: "Comment text" },
      authorAgentId: { type: "string", description: "Agent ID (optional)" },
    },
    required: ["taskId", "body"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const rows = await s`
        INSERT INTO task_comments (task_id, body, author_agent_id)
        VALUES (${params.taskId as string}, ${params.body as string}, ${(params.authorAgentId as string) ?? null})
        RETURNING id
      `
      return { commentId: rows[0]?.id }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to add comment" }
    }
  },
}

const checkoutTask: MCPTool = {
  name: "checkout_task",
  description:
    "Lock a task for execution. Returns 409 if already locked. Prevents concurrent work on the same task.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
      runId: { type: "string", description: "Run ID that is claiming this task" },
    },
    required: ["taskId", "runId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      // Atomic check-and-lock
      const rows = await s`
        UPDATE tasks
        SET execution_locked_at = NOW(),
            checkout_run_id = ${params.runId as string},
            status = 'in-progress',
            updated_at = NOW()
        WHERE id = ${params.taskId as string}
          AND execution_locked_at IS NULL
        RETURNING id
      `
      if (rows.length === 0) {
        return { locked: false, error: "Task already checked out or not found" }
      }
      return { locked: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Checkout failed" }
    }
  },
}

const releaseTask: MCPTool = {
  name: "release_task",
  description: "Release a task lock after execution completes.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID" },
    },
    required: ["taskId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      await s`
        UPDATE tasks
        SET execution_locked_at = NULL,
            checkout_run_id = NULL,
            updated_at = NOW()
        WHERE id = ${params.taskId as string}
      `
      return { released: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Release failed" }
    }
  },
}

// =============================================================================
// Agent Tools
// =============================================================================

const listAgents: MCPTool = {
  name: "list_agents",
  description: "List all agents, optionally filtered by department.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Filter by department" },
    },
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { agents: [] }

    try {
      const rows = params.departmentId
        ? await s`SELECT * FROM agents WHERE department_id = ${params.departmentId as string} ORDER BY name`
        : await s`SELECT * FROM agents ORDER BY name`
      return { agents: rows }
    } catch (err) {
      return { agents: [], error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const getAgent: MCPTool = {
  name: "get_agent",
  description: "Get an agent's full profile including config and runtime state.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "Agent ID" },
    },
    required: ["agentId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const agents = await s`SELECT * FROM agents WHERE id = ${params.agentId as string}`
      if (agents.length === 0) return { error: "Agent not found" }

      const configs = await s`SELECT * FROM agent_configs WHERE agent_id = ${params.agentId as string}`
      const state = await db.getAgentRuntimeState(params.agentId as string)

      return {
        agent: agents[0],
        config: configs[0] || null,
        runtimeState: state,
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const getAgentStatus: MCPTool = {
  name: "get_agent_status",
  description: "Get an agent's current status, active task, and last activity time.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "Agent ID" },
    },
    required: ["agentId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const agents = await s`
        SELECT id, status, current_task, last_active FROM agents
        WHERE id = ${params.agentId as string}
      `
      if (agents.length === 0) return { error: "Agent not found" }
      return agents[0]
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

// =============================================================================
// Department Tools
// =============================================================================

const listDepartments: MCPTool = {
  name: "list_departments",
  description: "List all departments with agent and task counts.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    const s = getSql()
    if (!s) return { departments: [] }

    try {
      const rows = await s`
        SELECT d.*,
          (SELECT count(*) FROM agents WHERE department_id = d.id) as agent_count,
          (SELECT count(*) FROM tasks WHERE department_id = d.id) as task_count
        FROM departments d
        ORDER BY d.name
      `
      return { departments: rows }
    } catch (err) {
      return { departments: [], error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const getDepartment: MCPTool = {
  name: "get_department",
  description: "Get a department with agent and task counts.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Department ID" },
    },
    required: ["departmentId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const depts = await s`
        SELECT d.*,
          (SELECT count(*) FROM agents WHERE department_id = d.id) as agent_count,
          (SELECT count(*) FROM tasks WHERE department_id = d.id) as task_count
        FROM departments d
        WHERE d.id = ${params.departmentId as string}
      `
      if (depts.length === 0) return { error: "Department not found" }
      return { department: depts[0] }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

// =============================================================================
// Routine Tools
// =============================================================================

const listRoutines: MCPTool = {
  name: "list_routines",
  description: "List routines, optionally filtered by department or status.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Filter by department" },
      status: { type: "string", description: "Filter by status (draft, active, paused, archived)" },
    },
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { routines: [] }

    try {
      let rows: Record<string, unknown>[]

      if (params.departmentId && params.status) {
        rows = await s`
          SELECT * FROM routines
          WHERE department_id = ${params.departmentId as string}
            AND status = ${params.status as string}
          ORDER BY created_at DESC
        `
      } else if (params.departmentId) {
        rows = await s`
          SELECT * FROM routines WHERE department_id = ${params.departmentId as string}
          ORDER BY created_at DESC
        `
      } else if (params.status) {
        rows = await s`
          SELECT * FROM routines WHERE status = ${params.status as string}
          ORDER BY created_at DESC
        `
      } else {
        rows = await s`SELECT * FROM routines ORDER BY created_at DESC`
      }
      return { routines: rows }
    } catch (err) {
      return { routines: [], error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const triggerRoutine: MCPTool = {
  name: "trigger_routine",
  description: "Manually trigger a routine execution.",
  inputSchema: {
    type: "object",
    properties: {
      routineId: { type: "string", description: "Routine ID" },
      payload: { type: "object", description: "Optional trigger payload" },
    },
    required: ["routineId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    // Import routine engine dynamically to avoid circular deps
    const { routineEngine } = await import("../routine-engine.js")

    try {
      const runId = await routineEngine.executeRun(
        params.routineId as string,
        "manual",
        (params.payload as Record<string, unknown>) || {}
      )
      if (!runId) {
        return { error: "Skipped due to concurrency policy" }
      }
      return { runId }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Trigger failed" }
    }
  },
}

// =============================================================================
// Goal Tools
// =============================================================================

const listGoals: MCPTool = {
  name: "list_goals",
  description: "List strategic goals, optionally filtered by department.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Filter by department" },
    },
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { goals: [] }

    try {
      const rows = params.departmentId
        ? await s`SELECT * FROM goals WHERE department_id = ${params.departmentId as string} ORDER BY created_at DESC`
        : await s`SELECT * FROM goals ORDER BY created_at DESC`
      return { goals: rows }
    } catch (err) {
      return { goals: [], error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const getGoal: MCPTool = {
  name: "get_goal",
  description: "Get a goal with its linked tasks.",
  inputSchema: {
    type: "object",
    properties: {
      goalId: { type: "string", description: "Goal ID" },
    },
    required: ["goalId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const goals = await s`SELECT * FROM goals WHERE id = ${params.goalId as string}`
      if (goals.length === 0) return { error: "Goal not found" }

      const linkedTasks = await s`
        SELECT * FROM tasks WHERE goal_id = ${params.goalId as string}
        ORDER BY created_at DESC
      `
      return { goal: goals[0], linkedTasks }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

// =============================================================================
// Cost Tools
// =============================================================================

const getSpendSummary: MCPTool = {
  name: "get_spend_summary",
  description:
    "Get cost summary: total spend, breakdown by agent and model. Optionally scoped to a department.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Scope to department (optional)" },
    },
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const deptFilter = params.departmentId
        ? s`WHERE department_id = ${params.departmentId as string}`
        : s``

      const totalRows = await s`
        SELECT COALESCE(SUM(cost_cents), 0) as total_cents FROM cost_events ${deptFilter}
      `

      const byAgent = await s`
        SELECT agent_id, COALESCE(SUM(cost_cents), 0) as cents, COUNT(*) as runs
        FROM cost_events ${deptFilter}
        GROUP BY agent_id ORDER BY cents DESC
      `

      const byModel = await s`
        SELECT model_id, COALESCE(SUM(cost_cents), 0) as cents,
               COALESCE(SUM(input_tokens + output_tokens), 0) as tokens
        FROM cost_events ${deptFilter}
        GROUP BY model_id ORDER BY cents DESC
      `

      return {
        totalCents: Number(totalRows[0]?.total_cents ?? 0),
        byAgent,
        byModel,
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

const getAgentSpend: MCPTool = {
  name: "get_agent_spend",
  description: "Get spend details for a specific agent.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "Agent ID" },
    },
    required: ["agentId"],
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { error: "Database not available" }

    try {
      const total = await s`
        SELECT COALESCE(SUM(cost_cents), 0) as total_cents FROM cost_events
        WHERE agent_id = ${params.agentId as string}
      `

      const thisMonth = await s`
        SELECT COALESCE(SUM(cost_cents), 0) as cents FROM cost_events
        WHERE agent_id = ${params.agentId as string}
          AND created_at >= date_trunc('month', NOW())
      `

      const runs = await s`
        SELECT * FROM cost_events
        WHERE agent_id = ${params.agentId as string}
        ORDER BY created_at DESC LIMIT 20
      `

      return {
        totalCents: Number(total[0]?.total_cents ?? 0),
        thisMonth: Number(thisMonth[0]?.cents ?? 0),
        runs,
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

// =============================================================================
// Communication Tools
// =============================================================================

const sendMessage: MCPTool = {
  name: "send_message",
  description:
    "Send a message to an agent, triggering a heartbeat run. Returns the wakeup request ID.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "Target agent ID" },
      message: { type: "string", description: "Message content" },
    },
    required: ["agentId", "message"],
  },
  handler: async (params) => {
    const { heartbeatEngine } = await import("../heartbeat.js")

    try {
      const wakeupId = await heartbeatEngine.triggerManual(
        params.agentId as string,
        params.message as string
      )
      return { runId: wakeupId }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to send message" }
    }
  },
}

// =============================================================================
// Activity Tools
// =============================================================================

const getActivityLog: MCPTool = {
  name: "get_activity_log",
  description: "Get recent activity log entries.",
  inputSchema: {
    type: "object",
    properties: {
      departmentId: { type: "string", description: "Filter by department" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
  },
  handler: async (params) => {
    const s = getSql()
    if (!s) return { activities: [] }

    const limit = (params.limit as number) || 50

    try {
      const rows = params.departmentId
        ? await s`
            SELECT * FROM activity_log
            WHERE department_id = ${params.departmentId as string}
            ORDER BY created_at DESC LIMIT ${limit}
          `
        : await s`
            SELECT * FROM activity_log
            ORDER BY created_at DESC LIMIT ${limit}
          `
      return { activities: rows }
    } catch (err) {
      return { activities: [], error: err instanceof Error ? err.message : "Query failed" }
    }
  },
}

// =============================================================================
// Export all tools
// =============================================================================

export function getAllTools(): MCPTool[] {
  return [
    // Tasks
    createTask,
    updateTask,
    listTasks,
    getTask,
    addComment,
    checkoutTask,
    releaseTask,
    // Agents
    listAgents,
    getAgent,
    getAgentStatus,
    // Departments
    listDepartments,
    getDepartment,
    // Routines
    listRoutines,
    triggerRoutine,
    // Goals
    listGoals,
    getGoal,
    // Costs
    getSpendSummary,
    getAgentSpend,
    // Communication
    sendMessage,
    // Activity
    getActivityLog,
  ]
}
