"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { RefreshCw, Filter } from "lucide-react"

interface LogEntry {
  timestamp: string
  level: string
  message: string
  source: string
}

const LEVEL_STYLES: Record<string, string> = {
  info: "text-blue-600 bg-blue-50",
  warn: "text-amber-600 bg-amber-50",
  error: "text-red-600 bg-red-50",
}

const SOURCE_COLORS: Record<string, string> = {
  bridge: "text-purple-600",
  heartbeat: "text-emerald-600",
  scheduler: "text-blue-600",
  router: "text-amber-600",
  system: "text-muted-foreground",
}

export function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (levelFilter !== "all") params.set("level", levelFilter)
      if (sourceFilter !== "all") params.set("source", sourceFilter)

      const res = await fetch(`/api/logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch {
      // logs not available
    } finally {
      setLoading(false)
    }
  }, [levelFilter, sourceFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const sources = [...new Set(logs.map((l) => l.source))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">System Logs</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-muted-foreground" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-xs bg-inset rounded px-2 py-1 outline-none border border-border"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="text-xs bg-inset rounded px-2 py-1 outline-none border border-border"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {logs.length} entries
        </span>
      </div>

      {/* Log entries */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
          {logs.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No logs available. Bridge logs appear here once the service is running.
            </div>
          )}
          {logs.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 px-3 py-1.5 border-b border-border/50 last:border-0 hover:bg-secondary/30",
                entry.level === "error" && "bg-red-50/50"
              )}
            >
              <span className="text-[10px] text-muted-foreground shrink-0 w-[70px] tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "text-[9px] font-bold uppercase px-1 py-0.5 rounded shrink-0 w-[42px] text-center",
                  LEVEL_STYLES[entry.level] || "text-muted-foreground bg-secondary"
                )}
              >
                {entry.level}
              </span>
              <span
                className={cn(
                  "text-[10px] shrink-0 w-[70px] truncate",
                  SOURCE_COLORS[entry.source] || "text-muted-foreground"
                )}
              >
                {entry.source}
              </span>
              <span className="text-foreground/80 break-all">
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
