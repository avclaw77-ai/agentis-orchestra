"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { AGENT_COLORS, STATUS_COLORS } from "@/lib/constants"
import type { Agent, AgentStatus } from "@/types"

interface AgentRosterProps {
  agents: Agent[]
  selectedAgent: string
  onSelectAgent: (id: string) => void
  compact?: boolean
  onAgentsUpdate?: (agents: Agent[]) => void
}

function StatusDot({ status }: { status: AgentStatus }) {
  return (
    <div
      className={cn(
        "w-2.5 h-2.5 rounded-full shrink-0",
        status === "active" && "agent-pulse",
        status === "thinking" && "thinking-pulse"
      )}
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  )
}

function formatLastActive(iso: string | null): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentRoster({ agents, selectedAgent, onSelectAgent, compact, onAgentsUpdate }: AgentRosterProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll agent statuses every 10 seconds, only when document is visible
  useEffect(() => {
    async function pollAgents() {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch("/api/agents")
        if (res.ok) {
          const updated: Agent[] = await res.json()
          onAgentsUpdate?.(updated)
        }
      } catch {
        // polling failed, will retry
      }
    }

    intervalRef.current = setInterval(pollAgents, 10000)

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        pollAgents() // immediate poll on tab re-focus
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [onAgentsUpdate])

  return (
    <div className={cn("space-y-1", !compact && "bg-card rounded-xl border border-border p-4")}>
      {!compact && (
        <h2 className="text-sm font-semibold text-foreground mb-3">Agent Team</h2>
      )}

      {agents.map((agent) => {
        const lastActive = formatLastActive(agent.lastActive)

        return (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
              selectedAgent === agent.id
                ? "bg-secondary"
                : "hover:bg-surface-hover"
            )}
          >
            {/* Agent avatar */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: AGENT_COLORS[agent.id] || "#6366f1" }}
            >
              {agent.name.slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{agent.name}</span>
                <StatusDot status={agent.status} />
              </div>
              {!compact && (
                <p className="text-xs text-muted-foreground truncate">
                  {agent.currentTask || agent.role}
                </p>
              )}
              {!compact && lastActive && agent.status === "idle" && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Last active {lastActive}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
