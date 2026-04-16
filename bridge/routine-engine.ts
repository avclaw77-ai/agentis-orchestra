/**
 * Routine Engine -- multi-step agent workflow orchestration.
 *
 * Executes routines (named sequences of agent steps) with support for:
 * - Sequential and dependency-based step ordering
 * - Prompt template interpolation ({{prev_output}}, {{trigger_payload}})
 * - Concurrency policies (skip / queue / replace)
 * - Timeout enforcement per-step and per-routine
 * - Cost and token tracking aggregated per run
 */

import { randomUUID } from "node:crypto"
import { heartbeatEngine } from "./heartbeat.js"
import * as db from "./db.js"

// =============================================================================
// Types (bridge-local, mirrors DB rows)
// =============================================================================

interface RoutineRow {
  id: string
  department_id: string | null
  name: string
  status: string
  concurrency_policy: string
  catch_up_policy: string
  max_duration_ms: number
  assignee_agent_id: string | null
}

interface RoutineStepRow {
  id: string
  routine_id: string
  step_order: number
  agent_id: string
  prompt_template: string
  model_override: string | null
  timeout_ms: number
  depends_on_step_id: string | null
}

interface StepResult {
  stepId: string
  agentId: string
  status: string
  output: string
  tokens: number
  costCents: number
  durationMs: number
}

// =============================================================================
// Routine Engine
// =============================================================================

class RoutineEngine {
  /**
   * Execute a routine run. Called by scheduler (cron), webhook handler, or manual trigger.
   * Returns the run ID.
   */
  async executeRun(
    routineId: string,
    triggerType: string,
    triggerPayload: Record<string, unknown> = {}
  ): Promise<string> {
    const routine = await db.getRoutineById(routineId)
    if (!routine) {
      throw new Error(`Routine ${routineId} not found`)
    }

    // Check concurrency policy
    const canRun = await this.checkConcurrency(routineId, routine.concurrency_policy as string)
    if (!canRun) {
      console.log(`[routine] ${routine.name} skipped (concurrency policy: ${routine.concurrency_policy})`)
      return ""
    }

    // Create the run
    const runId = `rrun-${randomUUID()}`
    await db.createRoutineRun({
      id: runId,
      routineId,
      triggerType,
      triggerPayload,
    })

    // Update last_triggered_at
    await db.updateRoutineLastTriggered(routineId)

    // Get steps ordered by step_order
    const steps = await db.getRoutineSteps(routineId) as RoutineStepRow[]
    if (steps.length === 0) {
      await db.finalizeRoutineRun(runId, { status: "completed" })
      return runId
    }

    // Mark run as running
    await db.updateRoutineRunStatus(runId, "running")

    // Execute steps in background
    this.executeSteps(runId, routine as RoutineRow, steps).catch((err) => {
      console.error(`[routine] Run ${runId} failed:`, err)
    })

    return runId
  }

  /**
   * Execute steps sequentially, respecting depends_on for ordering.
   */
  private async executeSteps(
    runId: string,
    routine: RoutineRow,
    steps: RoutineStepRow[]
  ): Promise<void> {
    const startTime = Date.now()
    const stepResults: StepResult[] = []
    const completedSteps = new Map<string, StepResult>() // stepId -> result
    let totalTokens = 0
    let totalCostCents = 0

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]

        // Check routine-level timeout
        if (Date.now() - startTime > routine.max_duration_ms) {
          await db.finalizeRoutineRun(runId, {
            status: "timed_out",
            error: `Routine timed out after ${routine.max_duration_ms}ms`,
            totalTokens,
            totalCostCents,
            stepResults,
          })
          return
        }

        // If step has a dependency, wait for it (already completed since we go in order,
        // but validate it succeeded)
        if (step.depends_on_step_id) {
          const dep = completedSteps.get(step.depends_on_step_id)
          if (!dep || dep.status !== "succeeded") {
            const error = `Step ${step.id} depends on ${step.depends_on_step_id} which ${dep ? "failed" : "was not found"}`
            await db.finalizeRoutineRun(runId, {
              status: "failed",
              error,
              totalTokens,
              totalCostCents,
              stepResults,
            })
            return
          }
        }

        // Update current step on the run
        await db.updateRoutineRunStep(runId, i + 1)

        // Get previous step output for interpolation
        const prevOutput = stepResults.length > 0
          ? stepResults[stepResults.length - 1].output
          : ""

        // Get trigger payload from the run
        const run = await db.getRoutineRunById(runId)
        const payload = (run?.trigger_payload as Record<string, unknown>) || {}

        // Execute the step
        const stepStart = Date.now()
        try {
          const result = await this.executeStep(step, prevOutput, JSON.stringify(payload))
          const durationMs = Date.now() - stepStart

          const stepResult: StepResult = {
            stepId: step.id,
            agentId: step.agent_id,
            status: "succeeded",
            output: result.output,
            tokens: result.tokens,
            costCents: result.costCents,
            durationMs,
          }

          stepResults.push(stepResult)
          completedSteps.set(step.id, stepResult)
          totalTokens += result.tokens
          totalCostCents += result.costCents

          // Update run with intermediate results
          await db.updateRoutineRunResults(runId, {
            stepResults,
            totalTokens,
            totalCostCents,
          })

        } catch (err) {
          const durationMs = Date.now() - stepStart
          const errorMsg = err instanceof Error ? err.message : "Unknown step error"

          const stepResult: StepResult = {
            stepId: step.id,
            agentId: step.agent_id,
            status: "failed",
            output: "",
            tokens: 0,
            costCents: 0,
            durationMs,
          }
          stepResults.push(stepResult)

          await db.finalizeRoutineRun(runId, {
            status: "failed",
            error: `Step ${i + 1} (${step.agent_id}) failed: ${errorMsg}`,
            totalTokens,
            totalCostCents,
            stepResults,
          })
          return
        }
      }

      // All steps completed
      await db.finalizeRoutineRun(runId, {
        status: "completed",
        totalTokens,
        totalCostCents,
        stepResults,
      })

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown routine error"
      await db.finalizeRoutineRun(runId, {
        status: "failed",
        error: errorMsg,
        totalTokens,
        totalCostCents,
        stepResults,
      })
    }
  }

  /**
   * Execute a single step via the heartbeat engine.
   * Interpolates prompt template and collects results.
   */
  private async executeStep(
    step: RoutineStepRow,
    prevOutput: string,
    triggerPayload: string
  ): Promise<{ output: string; tokens: number; costCents: number }> {
    // Interpolate prompt template
    const prompt = step.prompt_template
      .replace(/\{\{prev_output\}\}/g, prevOutput)
      .replace(/\{\{trigger_payload\}\}/g, triggerPayload)

    // Execute via heartbeat engine's triggerChat (gives us streaming + cost tracking)
    let fullOutput = ""
    const outputPromise = new Promise<string>((resolve, reject) => {
      // Create a timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Step timed out after ${step.timeout_ms}ms`))
      }, step.timeout_ms)

      heartbeatEngine.triggerChat(
        step.agent_id,
        prompt,
        undefined, // departmentId -- heartbeat will look it up from agent
        {
          onComplete: (result: string) => {
            clearTimeout(timeout)
            fullOutput = result
            // resolve happens when triggerChat's promise resolves
          },
          onError: (error: string) => {
            clearTimeout(timeout)
            reject(new Error(error))
          },
        }
      ).then((runId) => {
        resolve(fullOutput || runId)
      }).catch((err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    const result = await outputPromise

    // Token counts and costs are tracked by the heartbeat engine via cost-tracker.
    // We return zeros here to avoid double-counting -- the authoritative cost data
    // lives in the cost_events table, not in routine_runs.step_results.
    return {
      output: typeof result === "string" ? result : fullOutput,
      tokens: 0,
      costCents: 0,
    }
  }

  /**
   * Check concurrency policy before starting a run.
   * Returns true if the run should proceed.
   */
  private async checkConcurrency(routineId: string, policy: string): Promise<boolean> {
    const activeRuns = await db.getActiveRoutineRuns(routineId)

    if (activeRuns.length === 0) return true

    switch (policy) {
      case "skip":
        // Don't start if already running
        return false

      case "queue":
        // Allow -- it will queue naturally
        return true

      case "replace":
        // Cancel existing runs and start new one
        for (const run of activeRuns) {
          await db.finalizeRoutineRun(run.id as string, {
            status: "cancelled",
            error: "Replaced by new run (concurrency policy: replace)",
          })
        }
        return true

      default:
        return false
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const routineEngine = new RoutineEngine()
