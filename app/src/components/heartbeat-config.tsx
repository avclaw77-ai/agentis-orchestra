"use client"

import { useState, useEffect, useMemo } from "react"
import { Clock, Zap, MessageSquare, Save, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { SCHEDULE_PRESETS, cronToHuman, getNextRuns, isValidCron, getDefaultSchedule } from "@/lib/cron-helpers"

type HeartbeatMode = "chat-only" | "scheduled" | "events"

interface HeartbeatConfigProps {
  agentId: string
  agentRole: string
  schedule: string | null
  enabled: boolean
  onSave: (schedule: string, enabled: boolean) => void
}

export function HeartbeatConfig({
  agentId,
  agentRole,
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

  // Determine if current cron matches a preset
  const matchedPreset = SCHEDULE_PRESETS.find((p) => p.cron === selectedCron)

  // Check if initial schedule is custom (not in presets)
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
      <h3 className="text-sm font-semibold text-foreground">
        When should this agent check in?
      </h3>

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
          <div>
            <span className="text-sm font-medium">Only when I message</span>
            <p className="text-xs text-muted-foreground">Chat only -- no autonomous runs</p>
          </div>
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
            <p className="text-xs text-muted-foreground">Runs automatically at set times</p>
          </div>
        </label>

        {/* Schedule config (shown when scheduled is selected) */}
        {mode === "scheduled" && (
          <div className="ml-8 space-y-4">
            {/* Preset pills */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.cron}
                    onClick={() => handlePresetClick(preset.cron)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      !isCustom && selectedCron === preset.cron
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    )}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                ))}
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
                    Invalid cron expression. Use 5 fields: minute hour day month weekday
                  </p>
                )}
              </div>
            )}

            {/* Current selection summary */}
            <div className="bg-inset rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Selected</span>
                <span className="text-sm font-medium">{cronToHuman(activeCron)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Cron</span>
                <code className="text-xs font-mono text-muted-foreground">{activeCron}</code>
              </div>
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

            {/* Smart default hint */}
            {!schedule && (
              <p className="text-xs text-muted-foreground">
                Suggested for {agentRole}: {defaultSchedule.label}
              </p>
            )}
          </div>
        )}

        {/* Events (coming soon) */}
        <label
          className={cn(
            "flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors opacity-60",
            mode === "events"
              ? "border-primary bg-primary/5"
              : "border-border"
          )}
        >
          <input
            type="radio"
            name={`heartbeat-mode-${agentId}`}
            checked={mode === "events"}
            onChange={() => setMode("events")}
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
              Triggered by task assignments, code reviews, etc.
            </p>

            {/* Event checkboxes (disabled preview) */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Preview event triggers
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" disabled className="accent-primary" />
                  New task assigned
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" disabled className="accent-primary" />
                  Code review requested
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" disabled className="accent-primary" />
                  Dependency completed
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" disabled className="accent-primary" />
                  Error threshold reached
                </label>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={
            !hasChanges ||
            (mode === "scheduled" && !cronValid)
          }
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
