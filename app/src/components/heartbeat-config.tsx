"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Clock,
  Zap,
  MessageSquare,
  Save,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  DollarSign,
  Info,
  Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SCHEDULE_PRESETS,
  cronToHuman,
  getNextRuns,
  isValidCron,
  getDefaultSchedule,
} from "@/lib/cron-helpers"

type HeartbeatMode = "chat-only" | "scheduled" | "events"

interface HeartbeatConfigProps {
  agentId: string
  agentRole: string
  agentModel: string
  schedule: string | null
  enabled: boolean
  onSave: (schedule: string, enabled: boolean) => void
}

// =============================================================================
// Token cost estimation
// =============================================================================

/** Estimated tokens per heartbeat run by task type */
const TOKENS_PER_RUN: Record<string, { input: number; output: number; label: string }> = {
  "check-tasks": { input: 2000, output: 500, label: "Check for tasks" },
  "code-generation": { input: 3000, output: 4000, label: "Code generation" },
  "code-review": { input: 4000, output: 1500, label: "Code review" },
  "research": { input: 2000, output: 3000, label: "Research query" },
  "monitoring": { input: 1500, output: 500, label: "Status check" },
  "report": { input: 2000, output: 2000, label: "Generate report" },
}

/** Cost per 1M tokens in cents */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-cli:opus": { input: 0, output: 0 },
  "claude-cli:sonnet": { input: 0, output: 0 },
  "claude-cli:haiku": { input: 0, output: 0 },
  "openai:gpt-4o": { input: 250, output: 1000 },
  "openai:gpt-4o-mini": { input: 15, output: 60 },
  "perplexity:sonar-pro": { input: 300, output: 1500 },
  "perplexity:sonar": { input: 100, output: 100 },
  "openrouter:deepseek-v3": { input: 14, output: 28 },
  "openrouter:gemini-2.5-pro": { input: 125, output: 1000 },
}

function isCliModel(model: string): boolean {
  return model.startsWith("claude-cli:")
}

function estimateRunsPerMonth(cron: string): number {
  // Rough estimation based on cron frequency
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return 0
  const [min, hour, dom, , dow] = parts

  let runsPerDay = 1
  if (min === "*") runsPerDay = 1440 // every minute
  else if (min.startsWith("*/")) runsPerDay = Math.floor(1440 / parseInt(min.slice(2)))
  else if (hour === "*") runsPerDay = 24
  else if (hour.startsWith("*/")) runsPerDay = Math.floor(24 / parseInt(hour.slice(2)))
  else if (hour.includes(",")) runsPerDay = hour.split(",").length
  else runsPerDay = 1

  let daysPerMonth = 30
  if (dow !== "*") {
    // Count weekdays in the dow field
    const days = dow.split(",")
    if (dow === "1-5") daysPerMonth = 22
    else daysPerMonth = Math.round((days.length / 7) * 30)
  }
  if (dom !== "*" && dom !== "?") {
    const days = dom.split(",")
    daysPerMonth = days.length
  }

  return runsPerDay * daysPerMonth
}

function estimateMonthlyCost(
  cron: string,
  model: string,
  taskType: string = "check-tasks"
): { runs: number; tokens: number; costCents: number; isFree: boolean } {
  const runs = estimateRunsPerMonth(cron)
  const task = TOKENS_PER_RUN[taskType] || TOKENS_PER_RUN["check-tasks"]
  const totalInput = runs * task.input
  const totalOutput = runs * task.output
  const totalTokens = totalInput + totalOutput

  const pricing = MODEL_COSTS[model]
  if (!pricing || isCliModel(model)) {
    return { runs, tokens: totalTokens, costCents: 0, isFree: true }
  }

  const costCents = Math.round(
    (totalInput / 1_000_000) * pricing.input +
    (totalOutput / 1_000_000) * pricing.output
  )

  return { runs, tokens: totalTokens, costCents, isFree: false }
}

/** Format cost in dollars */
function formatCost(cents: number): string {
  if (cents === 0) return "$0"
  if (cents < 100) return `$0.${String(cents).padStart(2, "0")}`
  return `$${(cents / 100).toFixed(2)}`
}

// =============================================================================
// Cost guidance tips
// =============================================================================

interface CostTip {
  type: "success" | "info" | "warning" | "danger"
  message: string
}

function getCostGuidance(
  cron: string,
  model: string,
  agentRole: string
): CostTip[] {
  const tips: CostTip[] = []
  const est = estimateMonthlyCost(cron, model)

  // CLI model = free
  if (isCliModel(model)) {
    tips.push({
      type: "success",
      message: "This agent uses the CLI (Pro subscription). All heartbeat runs are free -- no per-token cost.",
    })
  }

  // High frequency warnings
  if (est.runs > 1000 && !est.isFree) {
    tips.push({
      type: "danger",
      message: `${est.runs.toLocaleString()} runs/month on a paid model. Consider using a CLI model instead, or reduce frequency.`,
    })
  } else if (est.runs > 500 && !est.isFree) {
    tips.push({
      type: "warning",
      message: `${est.runs.toLocaleString()} runs/month will generate significant API costs. CLI models are free.`,
    })
  }

  // Cost thresholds for API models
  if (est.costCents > 5000) {
    tips.push({
      type: "danger",
      message: `Estimated ${formatCost(est.costCents)}/month. Consider switching to a CLI model or reducing frequency.`,
    })
  } else if (est.costCents > 1000 && !est.isFree) {
    tips.push({
      type: "warning",
      message: `Estimated ${formatCost(est.costCents)}/month. This is manageable but worth monitoring.`,
    })
  }

  // Role-specific guidance
  const roleLower = agentRole.toLowerCase()
  if (roleLower.includes("monitor") || roleLower.includes("ops") || roleLower.includes("infra")) {
    if (est.runs < 48) {
      tips.push({
        type: "info",
        message: "Monitoring agents typically run every 15-30 minutes. Your current schedule may be too infrequent for real-time monitoring.",
      })
    }
  }

  if (roleLower.includes("research") || roleLower.includes("rnd")) {
    if (est.runs > 100) {
      tips.push({
        type: "info",
        message: "Research agents don't need high frequency. Twice a day or weekly is usually sufficient -- each run does deep work.",
      })
    }
  }

  if (roleLower.includes("qa") || roleLower.includes("review") || roleLower.includes("test")) {
    tips.push({
      type: "info",
      message: "QA agents work best on-demand (chat or events) rather than scheduled. Consider 'Chat only' mode unless you need periodic quality sweeps.",
    })
  }

  // General best practices
  if (est.runs > 0 && tips.length === 0) {
    if (est.isFree) {
      tips.push({
        type: "success",
        message: `~${est.runs} runs/month, ~${(est.tokens / 1000).toFixed(0)}K tokens. All free via CLI.`,
      })
    } else {
      tips.push({
        type: "info",
        message: `~${est.runs} runs/month, estimated ${formatCost(est.costCents)}/month.`,
      })
    }
  }

  return tips
}

// =============================================================================
// Component
// =============================================================================

export function HeartbeatConfig({
  agentId,
  agentRole,
  agentModel,
  schedule,
  enabled,
  onSave,
}: HeartbeatConfigProps) {
  const defaultSchedule = useMemo(() => getDefaultSchedule(agentRole), [agentRole])

  const [mode, setMode] = useState<HeartbeatMode>(
    enabled && schedule ? "scheduled" : "chat-only"
  )
  const [selectedCron, setSelectedCron] = useState(schedule || defaultSchedule.cron)
  const [customCron, setCustomCron] = useState("")
  const [isCustom, setIsCustom] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const matchedPreset = SCHEDULE_PRESETS.find((p) => p.cron === selectedCron)

  useEffect(() => {
    if (schedule && !SCHEDULE_PRESETS.find((p) => p.cron === schedule)) {
      setIsCustom(true)
      setCustomCron(schedule)
    }
  }, [schedule])

  const activeCron = isCustom ? customCron : selectedCron
  const cronValid = isValidCron(activeCron)
  const nextRuns = useMemo(
    () => (cronValid ? getNextRuns(activeCron, 3) : []),
    [activeCron, cronValid]
  )

  // Cost estimation
  const costEstimate = useMemo(
    () => cronValid ? estimateMonthlyCost(activeCron, agentModel) : null,
    [activeCron, agentModel, cronValid]
  )
  const costTips = useMemo(
    () => cronValid ? getCostGuidance(activeCron, agentModel, agentRole) : [],
    [activeCron, agentModel, agentRole, cronValid]
  )

  function handlePresetClick(cron: string) {
    setIsCustom(false)
    setSelectedCron(cron)
  }

  function handleCustomToggle() {
    setIsCustom(true)
    setCustomCron(selectedCron)
  }

  function handleSave() {
    if (mode === "chat-only") {
      onSave("", false)
    } else if (mode === "scheduled" && cronValid) {
      onSave(activeCron, true)
    }
  }

  const hasChanges =
    (mode === "chat-only" && enabled) ||
    (mode === "scheduled" && (!enabled || activeCron !== schedule)) ||
    (mode === "chat-only" && schedule !== null && schedule !== "")

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          When should this agent check in?
        </h3>
        {isCliModel(agentModel) && (
          <span className="text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
            CLI -- FREE
          </span>
        )}
      </div>

      {/* Mode selection */}
      <div className="space-y-2">
        {/* Chat only */}
        <label
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
            mode === "chat-only"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-surface-hover"
          )}
        >
          <input
            type="radio"
            name={`heartbeat-mode-${agentId}`}
            checked={mode === "chat-only"}
            onChange={() => setMode("chat-only")}
            className="accent-primary"
          />
          <MessageSquare size={16} className="text-muted-foreground shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium">Only when I message</span>
            <p className="text-xs text-muted-foreground">No autonomous runs. Zero cost. Respond only to direct chat.</p>
          </div>
          <span className="text-[10px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full shrink-0">
            $0/mo
          </span>
        </label>

        {/* Scheduled */}
        <label
          className={cn(
            "flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
            mode === "scheduled"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-surface-hover"
          )}
        >
          <input
            type="radio"
            name={`heartbeat-mode-${agentId}`}
            checked={mode === "scheduled"}
            onChange={() => setMode("scheduled")}
            className="accent-primary mt-0.5"
          />
          <Clock size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">On a schedule</span>
            <p className="text-xs text-muted-foreground">Runs automatically at set intervals</p>
          </div>
          {costEstimate && mode === "scheduled" && (
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
              costEstimate.isFree
                ? "bg-green-50 text-green-700"
                : costEstimate.costCents > 1000
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
            )}>
              {costEstimate.isFree ? "$0/mo" : `~${formatCost(costEstimate.costCents)}/mo`}
            </span>
          )}
        </label>

        {/* Schedule configuration */}
        {mode === "scheduled" && (
          <div className="ml-8 space-y-4">
            {/* Preset pills with cost labels */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map((preset) => {
                  const est = estimateMonthlyCost(preset.cron, agentModel)
                  return (
                    <button
                      key={preset.cron}
                      onClick={() => handlePresetClick(preset.cron)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        !isCustom && selectedCron === preset.cron
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      )}
                      title={`${preset.description} (~${est.runs} runs/mo, ${est.isFree ? "free" : formatCost(est.costCents) + "/mo"})`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
                <button
                  onClick={handleCustomToggle}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    isCustom
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Custom cron input */}
            {isCustom && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Cron expression
                </label>
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 * * * *"
                  className={cn(
                    "mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm font-mono outline-none",
                    customCron && !cronValid && "ring-1 ring-red-400"
                  )}
                />
                {customCron && !cronValid && (
                  <p className="text-xs text-red-500 mt-1">
                    Invalid cron. Format: minute hour day month weekday
                  </p>
                )}
              </div>
            )}

            {/* Schedule summary with cost */}
            <div className="bg-inset rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Schedule</span>
                <span className="text-sm font-medium">{cronToHuman(activeCron)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Cron</span>
                <code className="text-xs font-mono text-muted-foreground">{activeCron}</code>
              </div>
              {costEstimate && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Runs / month</span>
                    <span className="text-sm tabular-nums">~{costEstimate.runs.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Tokens / month</span>
                    <span className="text-sm tabular-nums">~{(costEstimate.tokens / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Est. cost</span>
                    <span className={cn(
                      "text-sm font-semibold tabular-nums",
                      costEstimate.isFree ? "text-green-600" : costEstimate.costCents > 1000 ? "text-red-600" : "text-foreground"
                    )}>
                      {costEstimate.isFree ? "$0 (CLI)" : `${formatCost(costEstimate.costCents)}/mo`}
                    </span>
                  </div>
                </>
              )}
              {cronValid && nextRuns.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Next runs</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {nextRuns.map((date, i) => (
                      <span
                        key={i}
                        className="text-xs bg-secondary px-2 py-0.5 rounded font-mono"
                      >
                        {formatRunTime(date)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cost guidance tips */}
            {costTips.length > 0 && (
              <div className="space-y-2">
                {costTips.map((tip, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-xs leading-relaxed",
                      tip.type === "success" && "bg-green-50 text-green-800",
                      tip.type === "info" && "bg-blue-50 text-blue-800",
                      tip.type === "warning" && "bg-amber-50 text-amber-800",
                      tip.type === "danger" && "bg-red-50 text-red-800"
                    )}
                  >
                    {tip.type === "success" && <DollarSign size={14} className="shrink-0 mt-0.5" />}
                    {tip.type === "info" && <Lightbulb size={14} className="shrink-0 mt-0.5" />}
                    {tip.type === "warning" && <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                    {tip.type === "danger" && <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                    <span>{tip.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Best practices accordion */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info size={12} />
              {showAdvanced ? "Hide" : "Show"} scheduling best practices
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showAdvanced && (
              <div className="bg-inset rounded-lg px-4 py-3 space-y-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground mb-1">Start conservative, increase later</p>
                  <p>Begin with longer intervals (every few hours or daily). If you find the agent isn't catching work fast enough, increase frequency. It's easier to speed up than to realize you've burned tokens on idle checks.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">CLI models are free -- use them</p>
                  <p>Agents using Claude CLI (Pro subscription) cost $0 per run. Use CLI models for high-frequency agents like monitors. Reserve API models (OpenRouter, Perplexity) for specialized tasks like research.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Business hours only</p>
                  <p>Most agents don't need to run at 3 AM. Use "Every weekday at 9am" instead of "Every hour" to cut runs by 85% with no impact on work that happens during the day.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Event-driven is coming</p>
                  <p>Soon agents will trigger on events (task assigned, code pushed) instead of polling. This eliminates idle runs entirely. Design with this in mind -- a daily schedule is often enough when events handle the urgent work.</p>
                </div>
              </div>
            )}

            {/* Smart default hint */}
            {!schedule && (
              <p className="text-xs text-muted-foreground">
                Suggested for {agentRole}: <strong>{defaultSchedule.label}</strong>
              </p>
            )}
          </div>
        )}

        {/* Events (coming soon) */}
        <label
          className={cn(
            "flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors opacity-60",
            "border-border"
          )}
        >
          <input
            type="radio"
            name={`heartbeat-mode-${agentId}`}
            disabled
            className="accent-primary mt-0.5"
          />
          <Zap size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">On events</span>
              <span className="text-[10px] font-medium bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                Coming soon
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Triggered by task assignments, webhooks, or external events. Zero idle cost -- agents only run when something happens.
            </p>
          </div>
          <span className="text-[10px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full shrink-0">
            Lowest cost
          </span>
        </label>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || (mode === "scheduled" && !cronValid)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            hasChanges && (mode !== "scheduled" || cronValid)
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Save size={14} />
          Save
        </button>
      </div>
    </div>
  )
}

function formatRunTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
