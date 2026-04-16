/**
 * Heartbeat Engine -- the core autonomous execution loop.
 *
 * Checks for pending wakeup requests on a regular interval, creates
 * heartbeat runs, and executes them through the model router + providers.
 *
 * Chat messages flow through here too: triggerChat() creates a wakeup
 * request that gets picked up by the tick loop, unifying chat and
 * autonomous execution under one system.
 */

import { randomUUID } from "node:crypto"
import { routeModel, type RouteRequest } from "./router.js"
import { executeWithProvider, type StreamCallbacks } from "./providers.js"
import * as db from "./db.js"
import { calculateCost, recordCostEvent, checkBudget } from "./cost-tracker.js"
import type { TaskType } from "./models.js"

// =============================================================================
// Types
// =============================================================================

interface WakeupRecord {
  id: string
  department_id: string | null
  agent_id: string
  source: string
  reason: string | null
  payload: Record<string, unknown>
  status: string
}

interface PendingExecution {
  wakeup: WakeupRecord
  runId: string
  resolve: (result: string) => void
  reject: (err: Error) => void
  onToken?: (token: string) => void
  onToolUse?: (tool: string, input: unknown) => void
  onComplete?: (result: string) => void
  onError?: (error: string) => void
  onModelSelected?: (modelId: string, reason: string) => void
}

// =============================================================================
// Heartbeat Engine
// =============================================================================

class HeartbeatEngine {
  private running = false
  private tickInProgress = false
  private tickInterval: NodeJS.Timeout | null = null
  private pendingExecutions = new Map<string, PendingExecution>()
  private activeAgents = new Set<string>()

  isRunning(): boolean {
    return this.running
  }

  start(intervalMs = 10_000): void {
    if (this.running) return
    this.running = true
    console.log(`[heartbeat] Engine started (tick every ${intervalMs}ms)`)
    this.tickInterval = setInterval(() => this.tick(), intervalMs)
    // Run first tick immediately
    this.tick()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    console.log("[heartbeat] Engine stopped")
  }

  // ---------------------------------------------------------------------------
  // Main tick loop
  // ---------------------------------------------------------------------------

  private async tick(): Promise<void> {
    if (this.tickInProgress) return
    this.tickInProgress = true
    try {
      // 1. Get all pending wakeup requests
      const wakeups = (await db.getPendingWakeups()) as WakeupRecord[]
      if (wakeups.length === 0) return

      for (const wakeup of wakeups) {
        // 2. Skip if agent already has a running execution
        if (this.activeAgents.has(wakeup.agent_id)) {
          continue
        }

        // 3. Check DB for active runs too (in case of restart)
        const hasActive = await db.hasActiveRun(wakeup.agent_id)
        if (hasActive) {
          this.activeAgents.add(wakeup.agent_id)
          continue
        }

        // 4. Budget check before creating the run
        const budgetResult = await checkBudget(wakeup.agent_id, wakeup.department_id)
        if (!budgetResult.allowed) {
          const runId = `run-${randomUUID()}`
          await db.createHeartbeatRun({
            id: runId,
            departmentId: wakeup.department_id,
            agentId: wakeup.agent_id,
            wakeupSource: wakeup.source,
            prompt: this.extractPrompt(wakeup),
          })
          await db.claimWakeup(wakeup.id, runId)
          await db.claimRun(runId)
          await db.finalizeRun(runId, {
            status: "cancelled",
            error: `Budget exceeded (${budgetResult.blockedBy} limit: ${budgetResult.limitCents}c, used: ${budgetResult.usedCents}c)`,
          })
          await db.finishWakeup(wakeup.id)
          console.log(`[heartbeat] ${wakeup.agent_id} blocked by ${budgetResult.blockedBy} budget`)
          continue
        }

        // 5. Create the run
        const runId = `run-${randomUUID()}`
        await db.createHeartbeatRun({
          id: runId,
          departmentId: wakeup.department_id,
          agentId: wakeup.agent_id,
          wakeupSource: wakeup.source,
          prompt: this.extractPrompt(wakeup),
        })

        // 6. Claim the wakeup
        await db.claimWakeup(wakeup.id, runId)

        // 7. Claim the run
        await db.claimRun(runId)

        // 8. Mark agent as active
        this.activeAgents.add(wakeup.agent_id)
        await db.updateAgentStatus(wakeup.agent_id, "active", this.extractPrompt(wakeup))

        // 9. Execute (non-blocking -- runs in background per agent)
        this.executeRun(runId, wakeup).catch((err) => {
          console.error(`[heartbeat] Run ${runId} failed:`, err)
        })
      }
    } catch (err) {
      console.error("[heartbeat] Tick error:", err)
    } finally {
      this.tickInProgress = false
    }
  }

  // ---------------------------------------------------------------------------
  // Run execution
  // ---------------------------------------------------------------------------

  private async executeRun(runId: string, wakeup: WakeupRecord): Promise<void> {
    const agentId = wakeup.agent_id
    const prompt = this.extractPrompt(wakeup)
    const startTime = Date.now()

    // Check if there's a pending execution with streaming callbacks (chat flow)
    const pending = this.pendingExecutions.get(runId)

    try {
      // Update run status to executing
      await this.updateRunStatus(runId, "executing")

      // Build context
      const context = await this.buildContext(agentId)

      // Update context snapshot on the run
      // (we already created it, just update)

      // Route to best model
      const routeReq: RouteRequest = {
        taskType: (wakeup.payload?.taskType as TaskType) || "conversation",
        agentModel: (wakeup.payload?.agentModel as string) || undefined,
        needsSearch: !!wakeup.payload?.needsSearch,
        needsVision: !!wakeup.payload?.needsVision,
        needsTools: true,
        preferCLI: true,
      }

      const route = routeModel(routeReq)
      console.log(`[heartbeat] ${agentId} -> ${route.model.name} (${route.reason})`)

      // Notify client about model selection
      pending?.onModelSelected?.(route.model.id, route.reason)

      // Execute via provider
      let fullResult = ""
      const callbacks: StreamCallbacks = {
        onToken: (token) => {
          fullResult += token
          pending?.onToken?.(token)
        },
        onToolUse: (tool, input) => {
          pending?.onToolUse?.(tool, input)
        },
        onComplete: (result) => {
          fullResult = result
          pending?.onComplete?.(result)
        },
        onError: (error) => {
          pending?.onError?.(error)
        },
      }

      const systemPrompt = (context.persona as string) || undefined
      const abortController = new AbortController()

      await executeWithProvider(
        route.model.provider,
        {
          model: route.model.model,
          message: prompt || "",
          systemPrompt,
          signal: abortController.signal,
        },
        callbacks
      )

      // Finalize: succeeded
      const durationMs = Date.now() - startTime

      // Estimate tokens from result length (rough heuristic until providers return counts)
      const estimatedInputTokens = Math.ceil((prompt?.length || 0) / 4)
      const estimatedOutputTokens = Math.ceil(fullResult.length / 4)

      // Calculate cost and record the event
      const billingType = route.model.mode === "cli" ? "subscription" : "metered"
      const { costCents, cliSavings } = calculateCost(
        route.model.id,
        estimatedInputTokens,
        estimatedOutputTokens
      )

      await db.finalizeRun(runId, {
        status: "succeeded",
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        costCents,
        modelId: route.model.id,
      })

      // Record cost event for tracking
      await recordCostEvent({
        departmentId: wakeup.department_id,
        agentId,
        runId,
        modelId: route.model.id,
        provider: route.model.provider,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        costCents,
        billingType: billingType as "metered" | "subscription",
      })

      // Update runtime state
      await db.saveRuntimeState(agentId, null, { lastResult: fullResult }, {
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        costCents,
      })

      // Save assistant message to chat
      await db.saveChatMessage({
        departmentId: wakeup.department_id,
        channel: agentId,
        role: "assistant",
        content: fullResult,
        modelId: route.model.id,
        runId,
      })

      // Log activity
      await db.logActivity(
        wakeup.department_id,
        agentId,
        "complete",
        prompt,
        durationMs,
        { runId, model: route.model.id, source: wakeup.source }
      )

      // Finish the wakeup request
      await db.finishWakeup(wakeup.id)

      // Resolve pending promise (for chat flow)
      pending?.resolve(fullResult)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"

      await db.finalizeRun(runId, {
        status: "failed",
        error: errorMsg,
      })

      await db.saveRuntimeState(agentId, null, { lastError: errorMsg })

      await db.logActivity(
        wakeup.department_id,
        agentId,
        "error",
        prompt,
        Date.now() - startTime,
        { runId, error: errorMsg }
      )

      await db.finishWakeup(wakeup.id)

      pending?.onError?.(errorMsg)
      pending?.reject(err instanceof Error ? err : new Error(errorMsg))

    } finally {
      this.activeAgents.delete(agentId)
      this.pendingExecutions.delete(runId)
      await db.updateAgentStatus(agentId, "idle")
    }
  }

  // ---------------------------------------------------------------------------
  // Manual + Chat triggers
  // ---------------------------------------------------------------------------

  /**
   * Manual trigger: create a wakeup request for immediate execution.
   * Returns the run ID so the caller can poll for results.
   */
  async triggerManual(agentId: string, prompt: string, departmentId?: string): Promise<string> {
    const wakeupId = `wk-${randomUUID()}`
    await db.createWakeupRequest({
      id: wakeupId,
      departmentId: departmentId ?? null,
      agentId,
      source: "manual",
      reason: prompt,
      payload: { prompt },
    })

    // Save the user message
    await db.saveChatMessage({
      departmentId: departmentId ?? null,
      channel: agentId,
      role: "user",
      content: prompt,
    })

    await db.logActivity(departmentId ?? null, agentId, "start", prompt)

    return wakeupId
  }

  /**
   * Chat trigger: wraps a chat message as a heartbeat run with streaming support.
   * Creates a wakeup request, pre-creates the run, and registers streaming callbacks
   * so the tick loop can stream tokens back via SSE.
   */
  async triggerChat(
    agentId: string,
    message: string,
    departmentId?: string,
    callbacks?: {
      onToken?: (token: string) => void
      onToolUse?: (tool: string, input: unknown) => void
      onComplete?: (result: string) => void
      onError?: (error: string) => void
      onModelSelected?: (modelId: string, reason: string) => void
    }
  ): Promise<string> {
    const wakeupId = `wk-${randomUUID()}`
    const runId = `run-${randomUUID()}`

    // Save the user message to chat
    await db.saveChatMessage({
      departmentId: departmentId ?? null,
      channel: agentId,
      role: "user",
      content: message,
    })

    // Create wakeup request
    await db.createWakeupRequest({
      id: wakeupId,
      departmentId: departmentId ?? null,
      agentId,
      source: "chat",
      reason: message,
      payload: { prompt: message },
    })

    // Pre-create the run
    await db.createHeartbeatRun({
      id: runId,
      departmentId: departmentId ?? null,
      agentId,
      wakeupSource: "chat",
      prompt: message,
    })

    // Claim wakeup + run immediately so the tick loop doesn't double-pick
    await db.claimWakeup(wakeupId, runId)
    await db.claimRun(runId)

    // Mark agent active
    this.activeAgents.add(agentId)
    await db.updateAgentStatus(agentId, "active", message)

    await db.logActivity(departmentId ?? null, agentId, "start", message, undefined, {
      runId,
      source: "chat",
    })

    // Register pending execution with callbacks
    const pending: PendingExecution = {
      wakeup: {
        id: wakeupId,
        department_id: departmentId ?? null,
        agent_id: agentId,
        source: "chat",
        reason: message,
        payload: { prompt: message },
        status: "claimed",
      },
      runId,
      resolve: () => {},
      reject: () => {},
      onToken: callbacks?.onToken,
      onToolUse: callbacks?.onToolUse,
      onComplete: callbacks?.onComplete,
      onError: callbacks?.onError,
      onModelSelected: callbacks?.onModelSelected,
    }

    // Create a promise that resolves when execution finishes
    const resultPromise = new Promise<string>((resolve, reject) => {
      pending.resolve = resolve
      pending.reject = reject
    })

    this.pendingExecutions.set(runId, pending)

    // Execute immediately (don't wait for tick loop -- chat needs low latency)
    this.executeRun(runId, pending.wakeup).catch((err) => {
      console.error(`[heartbeat] Chat run ${runId} failed:`, err)
    })

    // Wait for completion (streaming happens via callbacks during execution)
    await resultPromise

    return runId
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private extractPrompt(wakeup: WakeupRecord): string {
    return (wakeup.payload?.prompt as string) || wakeup.reason || ""
  }

  private async buildContext(agentId: string): Promise<Record<string, unknown>> {
    const state = await db.getAgentRuntimeState(agentId)
    return {
      agentId,
      runtimeState: state?.state_json ?? {},
      persona: state?.session_id ?? null, // placeholder -- persona loading is a future concern
    }
  }

  private async updateRunStatus(runId: string, status: string): Promise<void> {
    try {
      const { _sql } = await import("./db.js")
      const sql = _sql()
      if (!sql) return
      await sql`UPDATE heartbeat_runs SET status = ${status} WHERE id = ${runId}`
    } catch (err) {
      console.error("[heartbeat] updateRunStatus error:", err)
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const heartbeatEngine = new HeartbeatEngine()
