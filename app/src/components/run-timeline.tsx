"use client"

import { useState } from "react"
import { Clock, Webhook, MessageSquare, Play, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2, Timer, XCircle, CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HeartbeatRun } from "@/types"

interface RunTimelineProps {
  agentId: string
  runs: HeartbeatRun[]
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  queued: {
    color: "text-gray-500",
    bg: "bg-gray-100",
    icon: <CircleDot size={14} />,
    label: "Queued",
  },
  claimed: {
    color: "text-blue-500",
    bg: "bg-blue-50",
    icon: <Loader2 size={14} className="animate-spin" />,
    label: "Claimed",
  },
  executing: {
    color: "text-amber-500",
    bg: "bg-amber-50",
    icon: <Loader2 size={14} className="animate-spin" />,
    label: "Executing",
  },
  succeeded: {
    color: "text-green-600",
    bg: "bg-green-50",
    icon: <CheckCircle2 size={14} />,
    label: "Succeeded",
  },
  failed: {
    color: "text-red-500",
    bg: "bg-red-50",
    icon: <XCircle size={14} />,
    label: "Failed",
  },
  cancelled: {
    color: "text-gray-400",
    bg: "bg-gray-50",
    icon: <XCircle size={14} />,
    label: "Cancelled",
  },
  timed_out: {
    color: "text-orange-500",
    bg: "bg-orange-50",
    icon: <Timer size={14} />,
    label: "Timed Out",
  },
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  cron: <Clock size={14} />,
  webhook: <Webhook size={14} />,
  chat: <MessageSquare size={14} />,
  manual: <Play size={14} />,
  assignment: <AlertCircle size={14} />,
}

export function RunTimeline({ agentId, runs }: RunTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (runs.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Run History</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Clock size={24} className="mb-2 opacity-50" />
          <p className="text-sm">No runs yet</p>
          <p className="text-xs mt-1">Heartbeat runs will appear here once the agent starts executing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Run History</h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[72px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-1">
          {runs.map((run, idx) => {
            const status = STATUS_CONFIG[run.status] || STATUS_CONFIG.queued
            const isExpanded = expandedId === run.id
            const duration = computeDuration(run.startedAt, run.finishedAt)
            const timestamp = run.startedAt || run.createdAt

            return (
              <div key={run.id} className="relative">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                  className="w-full flex items-start gap-3 text-left hover:bg-surface-hover rounded-lg px-2 py-2 transition-colors"
                >
                  {/* Time column */}
                  <div className="w-16 shrink-0 text-right">
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTimestamp(timestamp)}
                    </span>
                  </div>

                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10",
                      status.bg,
                      status.color
                    )}
                  >
                    {status.icon}
                  </div>

                  {/* Run card */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status badge */}
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded",
                          status.bg,
                          status.color
                        )}
                      >
                        {status.label}
                      </span>

                      {/* Source icon */}
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        {SOURCE_ICONS[run.wakeupSource] || SOURCE_ICONS.manual}
                        {run.wakeupSource}
                      </span>

                      {/* Model */}
                      {run.modelId && (
                        <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                          {run.modelId}
                        </span>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {(run.inputTokens > 0 || run.outputTokens > 0) && (
                          <span>
                            {formatTokens(run.inputTokens + run.outputTokens)} tokens
                          </span>
                        )}
                        {run.costCents > 0 && (
                          <span>${(run.costCents / 100).toFixed(3)}</span>
                        )}
                        {duration && <span>{duration}</span>}
                      </div>

                      {/* Expand indicator */}
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="ml-[88px] mr-2 mb-2 bg-inset rounded-lg p-4 space-y-3">
                    {/* Token breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Input tokens</p>
                        <p className="text-sm font-mono">{run.inputTokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Output tokens</p>
                        <p className="text-sm font-mono">{run.outputTokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cost</p>
                        <p className="text-sm font-mono">${(run.costCents / 100).toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Duration</p>
                        <p className="text-sm font-mono">{duration || "---"}</p>
                      </div>
                    </div>

                    {/* Prompt */}
                    {run.prompt && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Prompt</p>
                        <pre className="text-xs text-foreground bg-secondary rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                          {run.prompt}
                        </pre>
                      </div>
                    )}

                    {/* Error */}
                    {run.error && (
                      <div>
                        <p className="text-[10px] font-medium text-red-500 uppercase tracking-wider mb-1">Error</p>
                        <pre className="text-xs text-red-600 bg-red-50 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                          {run.error}
                        </pre>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Created: {formatFull(run.createdAt)}</span>
                      {run.startedAt && <span>Started: {formatFull(run.startedAt)}</span>}
                      {run.finishedAt && <span>Finished: {formatFull(run.finishedAt)}</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatFull(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function computeDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count.toString()
}
