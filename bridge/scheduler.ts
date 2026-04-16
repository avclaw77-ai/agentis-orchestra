/**
 * Scheduler -- cron-based routine trigger engine.
 *
 * Runs a 30-second tick loop that checks all active routines with cron
 * triggers and fires them when the cron expression matches the current
 * minute. Uses simple interval-based scheduling (no external deps).
 */

import { routineEngine } from "./routine-engine.js"
import * as db from "./db.js"

// =============================================================================
// Types
// =============================================================================

interface ScheduledRoutine {
  routineId: string
  routineName: string
  cronExpression: string
  triggerId: string
}

// =============================================================================
// Cron matcher -- checks if a 5-field cron expression matches a given Date
// =============================================================================

function cronMatchesNow(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts

  return (
    matchesField(now.getMinutes(), minuteExpr, 0, 59) &&
    matchesField(now.getHours(), hourExpr, 0, 23) &&
    matchesField(now.getDate(), domExpr, 1, 31) &&
    matchesField(now.getMonth() + 1, monthExpr, 1, 12) &&
    matchesField(now.getDay(), dowExpr, 0, 6)
  )
}

function matchesField(value: number, expr: string, min: number, max: number): boolean {
  if (expr === "*") return true

  // Handle lists: "1,3,5"
  if (expr.includes(",")) {
    return expr.split(",").some((part) => matchesField(value, part.trim(), min, max))
  }

  // Handle step: "*/5" or "1-10/2"
  if (expr.includes("/")) {
    const [rangeExpr, stepStr] = expr.split("/")
    const step = parseInt(stepStr)
    if (rangeExpr === "*") {
      return (value - min) % step === 0
    }
    if (rangeExpr.includes("-")) {
      const [start, end] = rangeExpr.split("-").map(Number)
      return value >= start && value <= end && (value - start) % step === 0
    }
    return false
  }

  // Handle range: "1-5"
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map(Number)
    return value >= start && value <= end
  }

  // Exact match
  return value === parseInt(expr)
}

// =============================================================================
// Scheduler
// =============================================================================

class Scheduler {
  private tickTimer: NodeJS.Timeout | null = null
  private schedules: ScheduledRoutine[] = []
  private lastTickMinute = -1 // prevent double-firing within same minute
  private running = false

  isRunning(): boolean {
    return this.running
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    // Load schedules from DB
    await this.reload()

    // Tick every 30 seconds
    this.tickTimer = setInterval(() => this.tick(), 30_000)
    console.log(`[scheduler] Started (${this.schedules.length} routines loaded)`)

    // Run first tick immediately
    this.tick()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.schedules = []
    console.log("[scheduler] Stopped")
  }

  /**
   * Reload schedules from the database.
   * Called on startup and when routines are created/updated.
   */
  async reload(): Promise<void> {
    try {
      const rows = await db.getActiveRoutineCronTriggers()
      this.schedules = rows.map((r: Record<string, unknown>) => ({
        routineId: r.routine_id as string,
        routineName: r.routine_name as string,
        cronExpression: r.cron_expression as string,
        triggerId: r.trigger_id as string,
      }))
      console.log(`[scheduler] Reloaded ${this.schedules.length} cron schedules`)
    } catch (err) {
      console.error("[scheduler] Reload error:", err)
    }
  }

  /**
   * Main tick -- runs every 30 seconds. Checks if any cron expression
   * matches the current minute and triggers matching routines.
   */
  private async tick(): Promise<void> {
    if (!this.running) return

    const now = new Date()
    const currentMinute = now.getHours() * 60 + now.getMinutes()

    // Only fire once per minute
    if (currentMinute === this.lastTickMinute) return
    this.lastTickMinute = currentMinute

    for (const schedule of this.schedules) {
      try {
        if (cronMatchesNow(schedule.cronExpression, now)) {
          console.log(`[scheduler] Triggering routine "${schedule.routineName}" (${schedule.cronExpression})`)
          const runId = await routineEngine.executeRun(
            schedule.routineId,
            "cron"
          )
          if (runId) {
            console.log(`[scheduler] Run ${runId} started for "${schedule.routineName}"`)
          }
        }
      } catch (err) {
        console.error(`[scheduler] Error triggering ${schedule.routineName}:`, err)
      }
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const scheduler = new Scheduler()
