/**
 * Database persistence layer for the bridge.
 *
 * Uses the `postgres` npm package (raw SQL, no Drizzle dependency).
 * All functions are fire-and-forget safe -- they log errors but don't
 * crash the bridge.
 */

import postgres from "postgres"

let sql: ReturnType<typeof postgres>

// =============================================================================
// Connection
// =============================================================================

export function initDb(): void {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn("[db] DATABASE_URL not set -- persistence disabled")
    return
  }
  sql = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  })
  console.log("[db] Connected to PostgreSQL")
}

function isReady(): boolean {
  return !!sql
}

// =============================================================================
// Chat Messages
// =============================================================================

export interface SaveChatMessageParams {
  departmentId?: string | null
  channel: string
  role: "user" | "assistant"
  content: string
  modelId?: string | null
  runId?: string | null
  tokensUsed?: number
  metadata?: Record<string, unknown>
}

export async function saveChatMessage(params: SaveChatMessageParams): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      INSERT INTO chat_messages (department_id, channel, role, content, model_id, run_id, tokens_used, metadata)
      VALUES (
        ${params.departmentId ?? null},
        ${params.channel},
        ${params.role},
        ${params.content},
        ${params.modelId ?? null},
        ${params.runId ?? null},
        ${params.tokensUsed ?? 0},
        ${JSON.stringify(params.metadata ?? {})}::jsonb
      )
    `
  } catch (err) {
    console.error("[db] saveChatMessage error:", err)
  }
}

// =============================================================================
// Agent Status
// =============================================================================

export async function updateAgentStatus(
  agentId: string,
  status: string,
  currentTask?: string | null
): Promise<void> {
  if (!isReady()) return
  try {
    const result = await sql`
      UPDATE agents
      SET status = ${status},
          current_task = ${currentTask ?? null},
          last_active = NOW()
      WHERE id = ${agentId}
    `
    // If agent doesn't exist, result.count === 0 -- that's fine, we skip silently
  } catch (err) {
    console.error("[db] updateAgentStatus error:", err)
  }
}

export async function resetAllAgentsIdle(): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE agents SET status = 'idle', current_task = NULL
    `
    console.log("[db] Reset all agents to idle")
  } catch (err) {
    console.error("[db] resetAllAgentsIdle error:", err)
  }
}

// =============================================================================
// Activity Log
// =============================================================================

export async function logActivity(
  departmentId: string | null,
  agent: string,
  action: string,
  task?: string | null,
  durationMs?: number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      INSERT INTO activity_log (department_id, agent, action, task, duration_ms, metadata)
      VALUES (
        ${departmentId},
        ${agent},
        ${action},
        ${task ?? null},
        ${durationMs ?? null},
        ${JSON.stringify(metadata ?? {})}::jsonb
      )
    `
  } catch (err) {
    console.error("[db] logActivity error:", err)
  }
}

// =============================================================================
// Agent Runtime State
// =============================================================================

export interface RuntimeStateTokens {
  inputTokens?: number
  outputTokens?: number
  costCents?: number
}

export async function saveRuntimeState(
  agentId: string,
  sessionId: string | null,
  stateJson: Record<string, unknown>,
  tokens?: RuntimeStateTokens
): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      INSERT INTO agent_runtime_state (agent_id, session_id, state_json, total_input_tokens, total_output_tokens, total_cost_cents, updated_at)
      VALUES (
        ${agentId},
        ${sessionId},
        ${JSON.stringify(stateJson)}::jsonb,
        ${tokens?.inputTokens ?? 0},
        ${tokens?.outputTokens ?? 0},
        ${tokens?.costCents ?? 0},
        NOW()
      )
      ON CONFLICT (agent_id) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        state_json = EXCLUDED.state_json,
        total_input_tokens = agent_runtime_state.total_input_tokens + EXCLUDED.total_input_tokens,
        total_output_tokens = agent_runtime_state.total_output_tokens + EXCLUDED.total_output_tokens,
        total_cost_cents = agent_runtime_state.total_cost_cents + EXCLUDED.total_cost_cents,
        updated_at = NOW()
    `
  } catch (err) {
    console.error("[db] saveRuntimeState error:", err)
  }
}

export async function getAgentRuntimeState(
  agentId: string
): Promise<Record<string, unknown> | null> {
  if (!isReady()) return null
  try {
    const rows = await sql`
      SELECT * FROM agent_runtime_state WHERE agent_id = ${agentId}
    `
    return rows.length > 0 ? (rows[0] as Record<string, unknown>) : null
  } catch (err) {
    console.error("[db] getAgentRuntimeState error:", err)
    return null
  }
}

// =============================================================================
// Heartbeat Runs
// =============================================================================

export interface CreateHeartbeatRunParams {
  id: string
  departmentId?: string | null
  agentId: string
  wakeupSource: string
  prompt?: string | null
  modelId?: string | null
  contextSnapshot?: Record<string, unknown>
}

export async function createHeartbeatRun(params: CreateHeartbeatRunParams): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      INSERT INTO heartbeat_runs (id, department_id, agent_id, wakeup_source, status, prompt, model_id, context_snapshot)
      VALUES (
        ${params.id},
        ${params.departmentId ?? null},
        ${params.agentId},
        ${params.wakeupSource},
        'queued',
        ${params.prompt ?? null},
        ${params.modelId ?? null},
        ${JSON.stringify(params.contextSnapshot ?? {})}::jsonb
      )
    `
  } catch (err) {
    console.error("[db] createHeartbeatRun error:", err)
  }
}

export async function claimRun(runId: string): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE heartbeat_runs
      SET status = 'claimed', started_at = NOW()
      WHERE id = ${runId}
    `
  } catch (err) {
    console.error("[db] claimRun error:", err)
  }
}

export interface FinalizeRunParams {
  status: "succeeded" | "failed" | "cancelled" | "timed_out"
  inputTokens?: number
  outputTokens?: number
  costCents?: number
  error?: string | null
  modelId?: string | null
}

export async function finalizeRun(runId: string, params: FinalizeRunParams): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE heartbeat_runs
      SET status = ${params.status},
          input_tokens = ${params.inputTokens ?? 0},
          output_tokens = ${params.outputTokens ?? 0},
          cost_cents = ${params.costCents ?? 0},
          error = ${params.error ?? null},
          model_id = COALESCE(${params.modelId ?? null}, model_id),
          finished_at = NOW()
      WHERE id = ${runId}
    `
  } catch (err) {
    console.error("[db] finalizeRun error:", err)
  }
}

export async function getRunById(runId: string): Promise<Record<string, unknown> | null> {
  if (!isReady()) return null
  try {
    const rows = await sql`SELECT * FROM heartbeat_runs WHERE id = ${runId}`
    return rows.length > 0 ? (rows[0] as Record<string, unknown>) : null
  } catch (err) {
    console.error("[db] getRunById error:", err)
    return null
  }
}

export async function getRunsByAgent(
  agentId: string,
  limit = 50
): Promise<Record<string, unknown>[]> {
  if (!isReady()) return []
  try {
    const rows = await sql`
      SELECT * FROM heartbeat_runs
      WHERE agent_id = ${agentId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    return rows as Record<string, unknown>[]
  } catch (err) {
    console.error("[db] getRunsByAgent error:", err)
    return []
  }
}

export async function hasActiveRun(agentId: string): Promise<boolean> {
  if (!isReady()) return false
  try {
    const rows = await sql`
      SELECT 1 FROM heartbeat_runs
      WHERE agent_id = ${agentId}
        AND status IN ('queued', 'claimed', 'executing')
      LIMIT 1
    `
    return rows.length > 0
  } catch (err) {
    console.error("[db] hasActiveRun error:", err)
    return false
  }
}

// =============================================================================
// Wakeup Requests
// =============================================================================

export interface CreateWakeupRequestParams {
  id: string
  departmentId?: string | null
  agentId: string
  source: string
  reason?: string | null
  payload?: Record<string, unknown>
}

export async function createWakeupRequest(params: CreateWakeupRequestParams): Promise<void> {
  if (!isReady()) return
  try {
    // Coalesce: if there's already a pending request for this agent with the same source, increment count
    const existing = await sql`
      SELECT id, coalesced_count FROM agent_wakeup_requests
      WHERE agent_id = ${params.agentId}
        AND source = ${params.source}
        AND status = 'queued'
      LIMIT 1
    `
    if (existing.length > 0) {
      await sql`
        UPDATE agent_wakeup_requests
        SET coalesced_count = coalesced_count + 1,
            payload = ${JSON.stringify(params.payload ?? {})}::jsonb,
            reason = COALESCE(${params.reason ?? null}, reason)
        WHERE id = ${existing[0].id}
      `
      return
    }

    await sql`
      INSERT INTO agent_wakeup_requests (id, department_id, agent_id, source, reason, payload, status)
      VALUES (
        ${params.id},
        ${params.departmentId ?? null},
        ${params.agentId},
        ${params.source},
        ${params.reason ?? null},
        ${JSON.stringify(params.payload ?? {})}::jsonb,
        'queued'
      )
    `
  } catch (err) {
    console.error("[db] createWakeupRequest error:", err)
  }
}

export async function getPendingWakeups(
  agentId?: string
): Promise<Record<string, unknown>[]> {
  if (!isReady()) return []
  try {
    if (agentId) {
      const rows = await sql`
        SELECT * FROM agent_wakeup_requests
        WHERE agent_id = ${agentId} AND status = 'queued'
        ORDER BY requested_at ASC
      `
      return rows as Record<string, unknown>[]
    }
    const rows = await sql`
      SELECT * FROM agent_wakeup_requests
      WHERE status = 'queued'
      ORDER BY requested_at ASC
    `
    return rows as Record<string, unknown>[]
  } catch (err) {
    console.error("[db] getPendingWakeups error:", err)
    return []
  }
}

export async function claimWakeup(requestId: string, runId: string): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE agent_wakeup_requests
      SET status = 'claimed', run_id = ${runId}, claimed_at = NOW()
      WHERE id = ${requestId}
    `
  } catch (err) {
    console.error("[db] claimWakeup error:", err)
  }
}

export async function finishWakeup(requestId: string): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE agent_wakeup_requests
      SET status = 'finished', finished_at = NOW()
      WHERE id = ${requestId}
    `
  } catch (err) {
    console.error("[db] finishWakeup error:", err)
  }
}

// =============================================================================
// Routines
// =============================================================================

export async function getRoutineById(
  routineId: string
): Promise<Record<string, unknown> | null> {
  if (!isReady()) return null
  try {
    const rows = await sql`SELECT * FROM routines WHERE id = ${routineId}`
    return rows.length > 0 ? (rows[0] as Record<string, unknown>) : null
  } catch (err) {
    console.error("[db] getRoutineById error:", err)
    return null
  }
}

export async function getRoutineSteps(
  routineId: string
): Promise<Record<string, unknown>[]> {
  if (!isReady()) return []
  try {
    const rows = await sql`
      SELECT * FROM routine_steps
      WHERE routine_id = ${routineId}
      ORDER BY step_order ASC
    `
    return rows as Record<string, unknown>[]
  } catch (err) {
    console.error("[db] getRoutineSteps error:", err)
    return []
  }
}

export async function updateRoutineLastTriggered(routineId: string): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE routines SET last_triggered_at = NOW(), updated_at = NOW()
      WHERE id = ${routineId}
    `
  } catch (err) {
    console.error("[db] updateRoutineLastTriggered error:", err)
  }
}

// =============================================================================
// Routine Runs
// =============================================================================

export interface CreateRoutineRunParams {
  id: string
  routineId: string
  triggerType: string
  triggerPayload?: Record<string, unknown>
}

export async function createRoutineRun(params: CreateRoutineRunParams): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      INSERT INTO routine_runs (id, routine_id, trigger_type, trigger_payload, status)
      VALUES (
        ${params.id},
        ${params.routineId},
        ${params.triggerType},
        ${JSON.stringify(params.triggerPayload ?? {})}::jsonb,
        'queued'
      )
    `
  } catch (err) {
    console.error("[db] createRoutineRun error:", err)
  }
}

export async function updateRoutineRunStatus(runId: string, status: string): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE routine_runs
      SET status = ${status}, started_at = COALESCE(started_at, NOW())
      WHERE id = ${runId}
    `
  } catch (err) {
    console.error("[db] updateRoutineRunStatus error:", err)
  }
}

export async function updateRoutineRunStep(runId: string, step: number): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE routine_runs SET current_step = ${step} WHERE id = ${runId}
    `
  } catch (err) {
    console.error("[db] updateRoutineRunStep error:", err)
  }
}

export async function updateRoutineRunResults(
  runId: string,
  data: { stepResults: unknown[]; totalTokens: number; totalCostCents: number }
): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE routine_runs
      SET step_results = ${JSON.stringify(data.stepResults)}::jsonb,
          total_tokens = ${data.totalTokens},
          total_cost_cents = ${data.totalCostCents}
      WHERE id = ${runId}
    `
  } catch (err) {
    console.error("[db] updateRoutineRunResults error:", err)
  }
}

export interface FinalizeRoutineRunParams {
  status: string
  error?: string | null
  totalTokens?: number
  totalCostCents?: number
  stepResults?: unknown[]
}

export async function finalizeRoutineRun(
  runId: string,
  params: FinalizeRoutineRunParams
): Promise<void> {
  if (!isReady()) return
  try {
    await sql`
      UPDATE routine_runs
      SET status = ${params.status},
          error = ${params.error ?? null},
          total_tokens = COALESCE(${params.totalTokens ?? null}, total_tokens),
          total_cost_cents = COALESCE(${params.totalCostCents ?? null}, total_cost_cents),
          step_results = COALESCE(${params.stepResults ? JSON.stringify(params.stepResults) : null}::jsonb, step_results),
          completed_at = NOW()
      WHERE id = ${runId}
    `
  } catch (err) {
    console.error("[db] finalizeRoutineRun error:", err)
  }
}

export async function getRoutineRunById(
  runId: string
): Promise<Record<string, unknown> | null> {
  if (!isReady()) return null
  try {
    const rows = await sql`SELECT * FROM routine_runs WHERE id = ${runId}`
    return rows.length > 0 ? (rows[0] as Record<string, unknown>) : null
  } catch (err) {
    console.error("[db] getRoutineRunById error:", err)
    return null
  }
}

export async function getActiveRoutineRuns(
  routineId: string
): Promise<Record<string, unknown>[]> {
  if (!isReady()) return []
  try {
    const rows = await sql`
      SELECT * FROM routine_runs
      WHERE routine_id = ${routineId}
        AND status IN ('queued', 'running')
    `
    return rows as Record<string, unknown>[]
  } catch (err) {
    console.error("[db] getActiveRoutineRuns error:", err)
    return []
  }
}

export async function getRoutineRunsByRoutine(
  routineId: string,
  limit = 50,
  offset = 0
): Promise<Record<string, unknown>[]> {
  if (!isReady()) return []
  try {
    const rows = await sql`
      SELECT * FROM routine_runs
      WHERE routine_id = ${routineId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    return rows as Record<string, unknown>[]
  } catch (err) {
    console.error("[db] getRoutineRunsByRoutine error:", err)
    return []
  }
}

// =============================================================================
// Routine Triggers (for scheduler + webhook handler)
// =============================================================================

export async function getActiveRoutineCronTriggers(): Promise<Record<string, unknown>[]> {
  if (!isReady()) return []
  try {
    const rows = await sql`
      SELECT
        rt.id as trigger_id,
        rt.routine_id,
        rt.cron_expression,
        r.name as routine_name
      FROM routine_triggers rt
      JOIN routines r ON r.id = rt.routine_id
      WHERE rt.type = 'cron'
        AND rt.is_active = true
        AND r.status = 'active'
        AND rt.cron_expression IS NOT NULL
    `
    return rows as Record<string, unknown>[]
  } catch (err) {
    console.error("[db] getActiveRoutineCronTriggers error:", err)
    return []
  }
}

export async function getRoutineTriggerByWebhookPath(
  webhookPath: string
): Promise<Record<string, unknown> | null> {
  if (!isReady()) return null
  try {
    const rows = await sql`
      SELECT * FROM routine_triggers
      WHERE webhook_path = ${webhookPath}
        AND is_active = true
      LIMIT 1
    `
    return rows.length > 0 ? (rows[0] as Record<string, unknown>) : null
  } catch (err) {
    console.error("[db] getRoutineTriggerByWebhookPath error:", err)
    return null
  }
}
