"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Loader2, CheckCircle2, XCircle, Clock, Zap, X } from "lucide-react"

interface RunStatus {
  id: string
  agentId: string
  status: string
  prompt?: string
  result?: string
  error?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  costCents?: number
  startedAt?: string
  completedAt?: string
  durationMs?: number
}

interface LiveRunViewProps {
  runId: string
  agentName: string
  onClose: () => void
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  queued: { icon: <Clock size={14} />, color: "text-muted-foreground", label: "Queued" },
  claimed: { icon: <Loader2 size={14} className="animate-spin" />, color: "text-blue-500", label: "Starting..." },
  executing: { icon: <Loader2 size={14} className="animate-spin" />, color: "text-amber-500", label: "Executing" },
  succeeded: { icon: <CheckCircle2 size={14} />, color: "text-emerald-500", label: "Succeeded" },
  failed: { icon: <XCircle size={14} />, color: "text-red-500", label: "Failed" },
  cancelled: { icon: <XCircle size={14} />, color: "text-muted-foreground", label: "Cancelled" },
  timed_out: { icon: <Clock size={14} />, color: "text-amber-500", label: "Timed Out" },
}

export function LiveRunView({ runId, agentName, onClose }: LiveRunViewProps) {
  const [run, setRun] = useState<RunStatus | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const startTimeRef = useRef(Date.now())

  // SSE stream from bridge via API proxy
  useEffect(() => {
    const controller = new AbortController()

    async function stream() {
      try {
        const res = await fetch(`/api/agents/${runId.split("-")[0]}/runs?runId=${runId}`, {
          signal: controller.signal,
        })
        if (!res.ok) return

        // Fall back to polling since Next.js API routes can't easily proxy SSE
        const pollInterval = setInterval(async () => {
          try {
            // Use the bridge run endpoint via proxy
            const r = await fetch(`/api/agents/_/runs?runId=${runId}`)
            if (r.ok) {
              const data = await r.json()
              const latestRun = data.runs?.find((run: RunStatus) => run.id === runId)
              if (latestRun) {
                setRun(latestRun)
                const terminal = ["succeeded", "failed", "cancelled", "timed_out"]
                if (terminal.includes(latestRun.status)) {
                  setDone(true)
                  clearInterval(pollInterval)
                }
              }
            }
          } catch { /* keep polling */ }
        }, 2000)

        controller.signal.addEventListener("abort", () => clearInterval(pollInterval))
      } catch { /* aborted */ }
    }

    stream()
    return () => controller.abort()
  }, [runId])

  // Elapsed timer
  useEffect(() => {
    if (done) return
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [done])

  const config = STATUS_CONFIG[run?.status || "queued"] || STATUS_CONFIG.queued

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Zap size={16} className="text-primary" />
            <div>
              <p className="text-sm font-semibold">Live Run</p>
              <p className="text-[11px] text-muted-foreground">{agentName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X size={16} />
          </button>
        </div>

        {/* Status */}
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn("shrink-0", config.color)}>{config.icon}</div>
            <div className="flex-1">
              <p className={cn("text-sm font-medium", config.color)}>{config.label}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{runId}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono tabular-nums">
                {run?.durationMs
                  ? `${(run.durationMs / 1000).toFixed(1)}s`
                  : `${elapsed}s`
                }
              </p>
              <p className="text-[10px] text-muted-foreground">elapsed</p>
            </div>
          </div>

          {/* Progress bar */}
          {!done && (
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          )}

          {/* Stats grid */}
          {run && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-inset rounded-lg px-3 py-2 text-center">
                <p className="text-sm font-semibold tabular-nums">
                  {run.inputTokens ? `${(run.inputTokens / 1000).toFixed(1)}K` : "--"}
                </p>
                <p className="text-[10px] text-muted-foreground">Input</p>
              </div>
              <div className="bg-inset rounded-lg px-3 py-2 text-center">
                <p className="text-sm font-semibold tabular-nums">
                  {run.outputTokens ? `${(run.outputTokens / 1000).toFixed(1)}K` : "--"}
                </p>
                <p className="text-[10px] text-muted-foreground">Output</p>
              </div>
              <div className="bg-inset rounded-lg px-3 py-2 text-center">
                <p className="text-sm font-semibold tabular-nums">
                  {run.costCents ? `$${(run.costCents / 100).toFixed(3)}` : "$0"}
                </p>
                <p className="text-[10px] text-muted-foreground">Cost</p>
              </div>
            </div>
          )}

          {/* Result or error */}
          {run?.result && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">Result</p>
              <p className="text-xs text-emerald-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {run.result.slice(0, 500)}
              </p>
            </div>
          )}
          {run?.error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-red-700 mb-1">Error</p>
              <p className="text-xs text-red-600 whitespace-pre-wrap">{run.error}</p>
            </div>
          )}

          {/* Model */}
          {run?.model && (
            <p className="text-[11px] text-muted-foreground">
              Model: <span className="font-mono">{run.model}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
