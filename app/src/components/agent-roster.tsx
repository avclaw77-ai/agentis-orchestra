"use client"

import { cn } from "@/lib/utils"
import { AGENT_COLORS, STATUS_COLORS } from "@/lib/constants"
import type { Agent, AgentStatus } from "@/types"

interface AgentRosterProps {
  agents: Agent[]
  selectedAgent: string
  onSelectAgent: (id: string) => void
  compact?: boolean
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

export function AgentRoster({ agents, selectedAgent, onSelectAgent, compact }: AgentRosterProps) {
  return (
    <div className={cn("space-y-1", !compact && "bg-card rounded-xl border border-border p-4")}>
      {!compact && (
        <h2 className="text-sm font-semibold text-foreground mb-3">Agent Team</h2>
      )}

      {agents.map((agent) => (
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
          </div>
        </button>
      ))}
    </div>
  )
}
