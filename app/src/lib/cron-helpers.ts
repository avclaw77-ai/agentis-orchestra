// =============================================================================
// Natural language <-> cron expression converter
// Guided config UX for heartbeat scheduling
// =============================================================================

import type { SchedulePreset } from "@/types"

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  { label: "Every hour", cron: "0 * * * *", description: "Checks in at the top of every hour" },
  { label: "Every 30 minutes", cron: "*/30 * * * *", description: "Checks in twice per hour" },
  { label: "Every weekday at 9am", cron: "0 9 * * 1-5", description: "Monday-Friday mornings" },
  { label: "Twice a day", cron: "0 9,17 * * *", description: "Morning and end of day" },
  { label: "Every Monday morning", cron: "0 9 * * 1", description: "Weekly check-in" },
  { label: "Every 15 minutes", cron: "*/15 * * * *", description: "Frequent monitoring" },
  { label: "Every morning at 8am", cron: "0 8 * * *", description: "Daily morning task" },
  { label: "Every evening at 6pm", cron: "0 18 * * *", description: "Daily evening wrap-up" },
]

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// ---------------------------------------------------------------------------
// cronToHuman -- convert 5-field cron to readable string
// ---------------------------------------------------------------------------

export function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Check presets first for exact matches
  const preset = SCHEDULE_PRESETS.find((p) => p.cron === cron.trim())
  if (preset) return preset.label

  // */N minute patterns
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = parseInt(minute.slice(2))
    if (interval === 1) return "Every minute"
    return `Every ${interval} minutes`
  }

  // */N hour patterns
  if (minute !== "*" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = parseInt(hour.slice(2))
    return `Every ${interval} hours at :${minute.padStart(2, "0")}`
  }

  // Specific minute, every hour
  if (!minute.includes("*") && !minute.includes("/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const m = parseInt(minute)
    if (m === 0) return "Every hour"
    return `Every hour at :${minute.padStart(2, "0")}`
  }

  // Specific time patterns
  if (!minute.includes("*") && !hour.includes("*") && dayOfMonth === "*" && month === "*") {
    const timeStr = formatTime(hour, minute)

    // Specific days of week
    if (dayOfWeek !== "*") {
      const days = parseDayOfWeek(dayOfWeek)
      if (days === "Monday-Friday") return `Every weekday at ${timeStr}`
      if (days === "Saturday-Sunday") return `Every weekend at ${timeStr}`
      return `Every ${days} at ${timeStr}`
    }

    // Multiple hours (comma-separated)
    if (hour.includes(",")) {
      const hours = hour.split(",").map((h) => formatTime(h, minute))
      return `Daily at ${hours.join(" and ")}`
    }

    return `Every day at ${timeStr}`
  }

  // Fallback
  return cron
}

function formatTime(hour: string, minute: string): string {
  // Handle comma-separated hours
  if (hour.includes(",")) {
    return hour.split(",").map((h) => formatTime(h, minute)).join(" and ")
  }
  const h = parseInt(hour)
  const m = parseInt(minute)
  const period = h >= 12 ? "PM" : "AM"
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`
}

function parseDayOfWeek(dow: string): string {
  if (dow === "1-5") return "Monday-Friday"
  if (dow === "0,6" || dow === "6,0") return "Saturday-Sunday"
  if (dow === "*") return "day"

  const parts = dow.split(",")
  if (parts.length === 1) {
    // Could be a range like "1-3" or a single day
    if (dow.includes("-")) {
      const [start, end] = dow.split("-").map(Number)
      return `${DAY_NAMES[start]}-${DAY_NAMES[end]}`
    }
    return DAY_NAMES[parseInt(dow)] || dow
  }

  return parts.map((p) => DAY_NAMES[parseInt(p)] || p).join(", ")
}

// ---------------------------------------------------------------------------
// getNextRuns -- calculate next N run times from a cron expression
// ---------------------------------------------------------------------------

export function getNextRuns(cron: string, count: number = 3): Date[] {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return []

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts
  const results: Date[] = []
  const now = new Date()
  // Start from next minute
  const cursor = new Date(now)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  // Scan up to 10080 minutes (7 days) to find next runs
  const maxIterations = 10080
  for (let i = 0; i < maxIterations && results.length < count; i++) {
    if (
      matchesField(cursor.getMinutes(), minuteExpr, 0, 59) &&
      matchesField(cursor.getHours(), hourExpr, 0, 23) &&
      matchesField(cursor.getDate(), domExpr, 1, 31) &&
      matchesField(cursor.getMonth() + 1, monthExpr, 1, 12) &&
      matchesField(cursor.getDay(), dowExpr, 0, 6)
    ) {
      results.push(new Date(cursor))
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  return results
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
    // Range with step
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

// ---------------------------------------------------------------------------
// isValidCron -- validate a cron expression
// ---------------------------------------------------------------------------

export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const ranges: [number, number][] = [
    [0, 59],  // minute
    [0, 23],  // hour
    [1, 31],  // day of month
    [1, 12],  // month
    [0, 7],   // day of week (0 and 7 = Sunday)
  ]

  return parts.every((part, i) => isValidField(part, ranges[i][0], ranges[i][1]))
}

function isValidField(field: string, min: number, max: number): boolean {
  if (field === "*") return true

  // Split on comma for lists
  const segments = field.split(",")
  return segments.every((segment) => {
    let base = segment
    let step: number | null = null

    if (segment.includes("/")) {
      const [b, s] = segment.split("/")
      base = b
      step = parseInt(s)
      if (isNaN(step) || step < 1) return false
    }

    if (base === "*") return true

    if (base.includes("-")) {
      const [start, end] = base.split("-").map(Number)
      if (isNaN(start) || isNaN(end)) return false
      return start >= min && end <= max && start <= end
    }

    const val = parseInt(base)
    if (isNaN(val)) return false
    return val >= min && val <= max
  })
}

// ---------------------------------------------------------------------------
// getDefaultSchedule -- smart defaults based on agent role
// ---------------------------------------------------------------------------

export function getDefaultSchedule(role: string): { cron: string; label: string } {
  const lower = role.toLowerCase()

  if (lower.includes("software") || lower.includes("develop") || lower.includes("engineer") || lower.includes("dev")) {
    return { cron: "0 9-17 * * 1-5", label: "Every hour during business hours (weekdays)" }
  }

  if (lower.includes("test") || lower.includes("review") || lower.includes("qa") || lower.includes("quality")) {
    return { cron: "0 9,17 * * 1-5", label: "Twice a day on weekdays (review cycles)" }
  }

  if (lower.includes("research") || lower.includes("prototyp") || lower.includes("r&d") || lower.includes("rnd")) {
    return { cron: "0 9,17 * * *", label: "Twice a day" }
  }

  if (lower.includes("infrastructure") || lower.includes("deploy") || lower.includes("ops") || lower.includes("devops")) {
    return { cron: "*/30 * * * *", label: "Every 30 minutes" }
  }

  if (lower.includes("ceo") || lower.includes("assistant") || lower.includes("exec")) {
    return { cron: "0 * * * *", label: "Every hour" }
  }

  if (lower.includes("design") || lower.includes("ux") || lower.includes("ui")) {
    return { cron: "0 9,13,17 * * 1-5", label: "Three times daily on weekdays" }
  }

  // Default: every hour
  return { cron: "0 * * * *", label: "Every hour" }
}
