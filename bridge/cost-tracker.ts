/**
 * Cost Tracker -- cost calculation, persistence, and budget enforcement.
 *
 * Calculates per-token costs for API providers, tracks CLI savings
 * (what would have been spent if using API instead of Pro subscription),
 * and enforces cascading budget policies (agent -> department -> company).
 */

import { _sql } from "./db.js"

function getSql() {
  return _sql()
}

function isReady(): boolean {
  return !!getSql()
}

// =============================================================================
// Pricing tables (cents per 1M tokens)
// =============================================================================

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-cli:opus": { input: 0, output: 0 },
  "claude-cli:sonnet": { input: 0, output: 0 },
  "claude-cli:haiku": { input: 0, output: 0 },
  "openai:gpt-4.1": { input: 200, output: 800 },
  "openai:gpt-4.1-mini": { input: 40, output: 160 },
  "openai:gpt-4.1-nano": { input: 10, output: 40 },
  "openai:o4-mini": { input: 110, output: 440 },
  "openai:o3": { input: 1000, output: 4000 },
  "perplexity:sonar": { input: 100, output: 100 },
  "perplexity:sonar-pro": { input: 300, output: 1500 },
  "openrouter:deepseek-v3": { input: 14, output: 28 },
  "openrouter:gemini-2.5-pro": { input: 125, output: 1000 },
  "openrouter:llama-4-maverick": { input: 20, output: 60 },
  "openrouter:qwen-3-235b": { input: 14, output: 28 },
}

// What CLI usage would cost at API prices (for savings calculation)
const CLI_EQUIVALENT_PRICING: Record<string, { input: number; output: number }> = {
  "claude-cli:opus": { input: 1500, output: 7500 },
  "claude-cli:sonnet": { input: 300, output: 1500 },
  "claude-cli:haiku": { input: 80, output: 400 },
}

// =============================================================================
// Cost Calculation
// =============================================================================

export interface CostResult {
  costCents: number
  cliSavings: number
}

export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): CostResult {
  const pricing = PRICING[modelId]
  if (!pricing) {
    // Unknown model -- estimate at standard tier
    const fallback = { input: 300, output: 1500 }
    const cost = Math.round(
      (inputTokens * fallback.input) / 1_000_000 +
        (outputTokens * fallback.output) / 1_000_000
    )
    return { costCents: cost, cliSavings: 0 }
  }

  const costCents = Math.round(
    (inputTokens * pricing.input) / 1_000_000 +
      (outputTokens * pricing.output) / 1_000_000
  )

  // Calculate CLI savings (what API would have cost for CLI usage)
  let cliSavings = 0
  const equiv = CLI_EQUIVALENT_PRICING[modelId]
  if (equiv) {
    cliSavings = Math.round(
      (inputTokens * equiv.input) / 1_000_000 +
        (outputTokens * equiv.output) / 1_000_000
    )
  }

  return { costCents, cliSavings }
}

// =============================================================================
// Record Cost Event
// =============================================================================

export interface RecordCostEventParams {
  departmentId?: string | null
  agentId: string
  runId?: string | null
  modelId: string
  provider: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  costCents: number
  taskId?: string | null
  billingType: "metered" | "subscription"
}

export async function recordCostEvent(params: RecordCostEventParams): Promise<void> {
  if (!isReady()) return
  try {
    await getSql()!`
      INSERT INTO cost_events (
        department_id, agent_id, run_id, model_id, provider,
        input_tokens, output_tokens, cached_input_tokens,
        cost_cents, task_id, billing_type
      )
      VALUES (
        ${params.departmentId ?? null},
        ${params.agentId},
        ${params.runId ?? null},
        ${params.modelId},
        ${params.provider},
        ${params.inputTokens},
        ${params.outputTokens},
        ${params.cachedInputTokens ?? 0},
        ${params.costCents},
        ${params.taskId ?? null},
        ${params.billingType}
      )
    `
  } catch (err) {
    console.error("[cost-tracker] recordCostEvent error:", err)
  }
}

// =============================================================================
// Budget Enforcement
// =============================================================================

export interface BudgetCheckResult {
  allowed: boolean
  usedCents: number
  limitCents: number | null
  percentUsed: number
  blockedBy: string | null // 'agent' | 'department' | 'company' | null
}

export async function getMonthlySpend(
  scopeType: "company" | "department" | "agent",
  scopeId: string | null
): Promise<number> {
  if (!isReady()) return 0
  try {
    let rows
    if (scopeType === "company") {
      rows = await getSql()!`
        SELECT COALESCE(SUM(cost_cents), 0) AS total
        FROM cost_events
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      `
    } else if (scopeType === "department") {
      rows = await getSql()!`
        SELECT COALESCE(SUM(cost_cents), 0) AS total
        FROM cost_events
        WHERE department_id = ${scopeId}
          AND created_at >= date_trunc('month', CURRENT_DATE)
      `
    } else {
      rows = await getSql()!`
        SELECT COALESCE(SUM(cost_cents), 0) AS total
        FROM cost_events
        WHERE agent_id = ${scopeId}
          AND created_at >= date_trunc('month', CURRENT_DATE)
      `
    }
    return Number(rows[0]?.total ?? 0)
  } catch (err) {
    console.error("[cost-tracker] getMonthlySpend error:", err)
    return 0
  }
}

export async function checkBudget(
  agentId: string,
  departmentId: string | null
): Promise<BudgetCheckResult> {
  if (!isReady()) {
    return { allowed: true, usedCents: 0, limitCents: null, percentUsed: 0, blockedBy: null }
  }

  try {
    // CASCADE: agent -> department -> company

    // 1. Check agent-level budget
    const agentPolicies = await getSql()!`
      SELECT * FROM budget_policies
      WHERE scope_type = 'agent'
        AND scope_id = ${agentId}
        AND is_active = true
        AND window_kind = 'calendar_month'
      LIMIT 1
    `
    if (agentPolicies.length > 0) {
      const policy = agentPolicies[0]
      const used = await getMonthlySpend("agent", agentId)
      const limit = Number(policy.amount_cents)
      const percent = limit > 0 ? Math.round((used / limit) * 100) : 0

      if (policy.hard_stop_enabled && used >= limit) {
        await createIncidentIfNeeded(Number(policy.id), used, limit, "hard_stop", "agent", agentId)
        return { allowed: false, usedCents: used, limitCents: limit, percentUsed: percent, blockedBy: "agent" }
      }
      if (percent >= Number(policy.warn_percent)) {
        await createIncidentIfNeeded(Number(policy.id), used, limit, "warn", "agent", agentId)
      }
    }

    // 2. Check department-level budget
    if (departmentId) {
      const deptPolicies = await getSql()!`
        SELECT * FROM budget_policies
        WHERE scope_type = 'department'
          AND scope_id = ${departmentId}
          AND is_active = true
          AND window_kind = 'calendar_month'
        LIMIT 1
      `
      if (deptPolicies.length > 0) {
        const policy = deptPolicies[0]
        const used = await getMonthlySpend("department", departmentId)
        const limit = Number(policy.amount_cents)
        const percent = limit > 0 ? Math.round((used / limit) * 100) : 0

        if (policy.hard_stop_enabled && used >= limit) {
          await createIncidentIfNeeded(Number(policy.id), used, limit, "hard_stop", "department", departmentId)
          return { allowed: false, usedCents: used, limitCents: limit, percentUsed: percent, blockedBy: "department" }
        }
        if (percent >= Number(policy.warn_percent)) {
          await createIncidentIfNeeded(Number(policy.id), used, limit, "warn", "department", departmentId)
        }
      }
    }

    // 3. Check company-level budget
    const companyPolicies = await getSql()!`
      SELECT * FROM budget_policies
      WHERE scope_type = 'company'
        AND scope_id IS NULL
        AND is_active = true
        AND window_kind = 'calendar_month'
      LIMIT 1
    `
    if (companyPolicies.length > 0) {
      const policy = companyPolicies[0]
      const used = await getMonthlySpend("company", null)
      const limit = Number(policy.amount_cents)
      const percent = limit > 0 ? Math.round((used / limit) * 100) : 0

      if (policy.hard_stop_enabled && used >= limit) {
        await createIncidentIfNeeded(Number(policy.id), used, limit, "hard_stop", "company", null)
        return { allowed: false, usedCents: used, limitCents: limit, percentUsed: percent, blockedBy: "company" }
      }
      if (percent >= Number(policy.warn_percent)) {
        await createIncidentIfNeeded(Number(policy.id), used, limit, "warn", "company", null)
      }
    }

    // No budget blocked
    const totalUsed = await getMonthlySpend("company", null)
    return { allowed: true, usedCents: totalUsed, limitCents: null, percentUsed: 0, blockedBy: null }
  } catch (err) {
    console.error("[cost-tracker] checkBudget error:", err)
    // Fail open -- don't block execution on budget check errors
    return { allowed: true, usedCents: 0, limitCents: null, percentUsed: 0, blockedBy: null }
  }
}

// =============================================================================
// Incident Management
// =============================================================================

async function createIncidentIfNeeded(
  policyId: number,
  observed: number,
  limit: number,
  type: "warn" | "hard_stop",
  scopeType: string,
  scopeId: string | null
): Promise<void> {
  if (!isReady()) return
  try {
    // Check if there's already an open incident for this policy + type this month
    const existing = await getSql()!`
      SELECT 1 FROM budget_incidents
      WHERE policy_id = ${policyId}
        AND threshold_type = ${type}
        AND status = 'open'
        AND created_at >= date_trunc('month', CURRENT_DATE)
      LIMIT 1
    `
    if (existing.length > 0) {
      // Update observed amount
      await getSql()!`
        UPDATE budget_incidents
        SET amount_observed = ${observed}, updated_at = NOW()
        WHERE policy_id = ${policyId}
          AND threshold_type = ${type}
          AND status = 'open'
          AND created_at >= date_trunc('month', CURRENT_DATE)
      `
      return
    }

    await getSql()!`
      INSERT INTO budget_incidents (
        policy_id, scope_type, scope_id, threshold_type,
        amount_limit, amount_observed, status
      )
      VALUES (
        ${policyId}, ${scopeType}, ${scopeId}, ${type},
        ${limit}, ${observed}, 'open'
      )
    `
    console.log(`[cost-tracker] Budget incident created: ${type} for ${scopeType}:${scopeId ?? "company"}`)
  } catch (err) {
    console.error("[cost-tracker] createIncidentIfNeeded error:", err)
  }
}
