"use client"

import { cn } from "@/lib/utils"
import { Check, X, Loader2, Circle, ArrowRight, ChevronDown, ChevronUp } from "lucide-react"
import { AGENT_COLORS } from "@/lib/constants"
import type { Agent, RoutineStep } from "@/types"
import { useState } from "react"

// =============================================================================
// Types
// =============================================================================

interface StepResult {
  stepId: string
  status: string
  output: string
  tokens: number
  costCents: number
  durationMs: number
}

interface RoutinePipelineProps {
  steps: RoutineStep[]
  stepResults: StepResult[]
  agents: Agent[]
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTokens(t: number): string {
  if (t >= 1000) return `${(t / 1000).toFixed(1)}K`
  return String(t)
}

function formatCents(c: number): string {
  if (c >= 100) return `$${(c / 100).toFixed(2)}`
  return `${c}c`
}

// =============================================================================
// Status Icon
// =============================================================================

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
    case "succeeded":
    case "done":
      return (
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check size={13} className="text-emerald-600" />
        </div>
      )
    case "running":
    case "executing":
      return (
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
          <Loader2 size={13} className="text-amber-600 animate-spin" />
        </div>
      )
    case "failed":
    case "error":
      return (
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
          <X size={13} className="text-red-600" />
        </div>
      )
    default:
      return (
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
          <Circle size={11} className="text-gray-400" />
        </div>
      )
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
    case "succeeded":
    case "done":
      return "Done"
    case "running":
    case "executing":
      return "Running..."
    case "failed":
    case "error":
      return "Failed"
    default:
      return "Pending"
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
    case "succeeded":
    case "done":
      return "text-emerald-600"
    case "running":
    case "executing":
      return "text-amber-600"
    case "failed":
    case "error":
      return "text-red-600"
    default:
      return "text-gray-400"
  }
}

// =============================================================================
// Pipeline Step Card
// =============================================================================

function PipelineStepCard({
  step,
  result,
  agent,
  isLast,
}: {
  step: RoutineStep
  result?: StepResult
  agent?: Agent
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const status = result?.status || "pending"
  const agentName = agent?.name || step.agentId
  const promptPreview =
    step.promptTemplate.length > 60
      ? step.promptTemplate.slice(0, 60) + "..."
      : step.promptTemplate

  const isFailed = status === "failed" || status === "error"
  const isDone = status === "completed" || status === "succeeded" || status === "done"
  const isRunning = status === "running" || status === "executing"

  return (
    <div className="flex items-start gap-3">
      {/* Step card */}
      <div
        className={cn(
          "flex-1 bg-card border rounded-xl p-4 transition-colors",
          isRunning && "border-amber-200 shadow-sm shadow-amber-50",
          isFailed && "border-red-200",
          isDone && "border-emerald-100",
          !isRunning && !isFailed && !isDone && "border-border"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <StepStatusIcon status={status} />
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ backgroundColor: AGENT_COLORS[step.agentId] || "#6366f1" }}
            >
              {agentName.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-semibold">{agentName}</span>
          </div>
          <span className={cn("text-xs font-medium ml-auto", statusColor(status))}>
            {statusLabel(status)}
            {isDone && result && ` (${formatDuration(result.durationMs)})`}
          </span>
        </div>

        {/* Prompt preview */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{promptPreview}</p>

        {/* Metrics row */}
        {result && (result.tokens > 0 || result.costCents > 0) && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>{formatTokens(result.tokens)} tokens</span>
            <span>{formatCents(result.costCents)}</span>
            <span>{formatDuration(result.durationMs)}</span>
          </div>
        )}

        {/* Expandable output for completed / failed */}
        {result && (isDone || isFailed) && result.output && (
          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {isFailed ? "Error details" : "Output"}
            </button>
            {expanded && (
              <pre
                className={cn(
                  "mt-1.5 text-[11px] leading-relaxed whitespace-pre-wrap rounded-lg p-2.5 max-h-40 overflow-y-auto",
                  isFailed ? "bg-red-50 text-red-700" : "bg-secondary text-foreground"
                )}
              >
                {result.output}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div className="flex items-center pt-5 shrink-0">
          <ArrowRight size={16} className="text-border" />
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function RoutinePipeline({ steps, stepResults, agents }: RoutinePipelineProps) {
  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)
  const resultMap = new Map(stepResults.map((r) => [r.stepId, r]))
  const agentMap = new Map(agents.map((a) => [a.id, a]))

  // Summary stats
  const totalTokens = stepResults.reduce((sum, r) => sum + r.tokens, 0)
  const totalCost = stepResults.reduce((sum, r) => sum + r.costCents, 0)
  const totalDuration = stepResults.reduce((sum, r) => sum + r.durationMs, 0)
  const completedCount = stepResults.filter(
    (r) => r.status === "completed" || r.status === "succeeded" || r.status === "done"
  ).length

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {sortedSteps.map((step, i) => {
              const result = resultMap.get(step.id)
              const s = result?.status || "pending"
              return (
                <div
                  key={step.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    (s === "completed" || s === "succeeded" || s === "done") && "bg-emerald-500",
                    (s === "running" || s === "executing") && "bg-amber-400 animate-pulse",
                    (s === "failed" || s === "error") && "bg-red-500",
                    s === "pending" && "bg-gray-200"
                  )}
                />
              )
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{sortedSteps.length} steps
          </span>
        </div>
        {totalTokens > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatTokens(totalTokens)} tokens</span>
            <span>{formatCents(totalCost)}</span>
            <span>{formatDuration(totalDuration)}</span>
          </div>
        )}
      </div>

      {/* Pipeline steps -- horizontal on desktop, vertical on mobile */}
      <div className="hidden md:flex items-start gap-0">
        {sortedSteps.map((step, i) => (
          <PipelineStepCard
            key={step.id}
            step={step}
            result={resultMap.get(step.id)}
            agent={agentMap.get(step.agentId)}
            isLast={i === sortedSteps.length - 1}
          />
        ))}
      </div>

      {/* Mobile: vertical layout */}
      <div className="md:hidden space-y-2">
        {sortedSteps.map((step, i) => (
          <div key={step.id}>
            <PipelineStepCard
              step={step}
              result={resultMap.get(step.id)}
              agent={agentMap.get(step.agentId)}
              isLast={true}
            />
            {i < sortedSteps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowRight size={14} className="text-border rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
