"use client"

import { cn } from "@/lib/utils"
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  Webhook,
  Hand,
  Repeat,
  ChevronRight,
  Zap,
} from "lucide-react"
import type { Routine, RoutineTrigger } from "@/types"

// =============================================================================
// Types
// =============================================================================

interface RoutineWithMeta extends Routine {
  triggers?: RoutineTrigger[]
  stepCount?: number
  runCount?: number
}

interface RoutineListProps {
  routines: RoutineWithMeta[]
  onSelect: (id: string) => void
  onCreate: () => void
  onTrigger: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

// =============================================================================
// Helpers
// =============================================================================

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  paused: { bg: "bg-amber-50", text: "text-amber-700", label: "Paused" },
  archived: { bg: "bg-gray-50", text: "text-gray-400", label: "Archived" },
}

function getTriggerIcon(type: string) {
  switch (type) {
    case "cron":
      return <Clock size={12} />
    case "webhook":
      return <Webhook size={12} />
    default:
      return <Hand size={12} />
  }
}

function getTriggerLabel(trigger: RoutineTrigger) {
  if (trigger.type === "cron") {
    return trigger.cronHumanLabel || trigger.cronExpression || "Schedule"
  }
  if (trigger.type === "webhook") {
    return trigger.webhookPath || "Webhook"
  }
  return "Manual"
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

// =============================================================================
// Component
// =============================================================================

export function RoutineList({
  routines,
  onSelect,
  onCreate,
  onTrigger,
  onStatusChange,
  onDelete,
}: RoutineListProps) {
  if (routines.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Repeat size={24} className="text-primary" />
        </div>
        <h3 className="text-sm font-semibold mb-1">No routines yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create multi-step agent workflows with scheduling and triggers.
        </p>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Create Routine
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Routines</h2>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          New Routine
        </button>
      </div>

      <div className="space-y-2">
        {routines.map((routine) => {
          const status = STATUS_STYLES[routine.status] || STATUS_STYLES.draft
          const trigger = routine.triggers?.[0]

          return (
            <div
              key={routine.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => onSelect(routine.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Repeat size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium truncate">
                        {routine.name}
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                          status.bg,
                          status.text
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {trigger && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getTriggerIcon(trigger.type)}
                          {getTriggerLabel(trigger)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {routine.stepCount || 0} step
                        {(routine.stepCount || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {routine.runCount || 0} run
                        {(routine.runCount || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Last: {formatTimeAgo(routine.lastTriggeredAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-3">
                  {/* Quick actions */}
                  {routine.status === "active" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusChange(routine.id, "paused")
                      }}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                      title="Pause"
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {(routine.status === "draft" || routine.status === "paused") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusChange(routine.id, "active")
                      }}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                      title="Activate"
                    >
                      <Play size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTrigger(routine.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                    title="Trigger Now"
                  >
                    <Zap size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete routine "${routine.name}"?`)) {
                        onDelete(routine.id)
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={14} className="text-muted-foreground ml-1" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
