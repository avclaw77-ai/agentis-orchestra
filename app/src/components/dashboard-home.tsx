"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users,
  ListTodo,
  Activity,
  DollarSign,
  Clock,
  Repeat,
  Pause,
  Play,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AGENT_COLORS, STATUS_COLORS } from "@/lib/constants"
import type { Agent, Department } from "@/types"

interface DashboardHomeProps {
  agents: Agent[]
  departments: Department[]
  onSelectAgent?: (id: string) => void
  onAgentToggle?: (agentId: string, enabled: boolean) => void
}

interface ActivityEntry {
  id: number
  departmentId: string | null
  agent: string
  action: string
  task: string | null
  durationMs: number | null
  metadata: Record<string, unknown>
  createdAt: string
}

interface RoutineSummary {
  id: string
  name: string
  status: string
  lastTriggeredAt: string | null
  triggers?: Array<{ type: string }>
}

interface CostData {
  totalCents: number
}

interface TaskData {
  id: string
  status: string
}

export function DashboardHome({ agents, departments, onSelectAgent, onAgentToggle }: DashboardHomeProps) {
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [routines, setRoutines] = useState<RoutineSummary[]>([])
  const [monthlyCost, setMonthlyCost] = useState(0)
  const [todaysRuns, setTodaysRuns] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)

  const activeAgentCount = agents.filter((a) => a.status !== "idle").length

  const fetchDashboardData = useCallback(async () => {
    // Activity feed
    try {
      const res = await fetch("/api/activity?limit=20")
      if (res.ok) setActivity(await res.json())
    } catch {
      // will populate once DB has data
    }

    // Costs (current month)
    try {
      const res = await fetch("/api/costs")
      if (res.ok) {
        const data: CostData = await res.json()
        setMonthlyCost(data.totalCents)
      }
    } catch {
      // costs not available yet
    }

    // Tasks in progress
    try {
      const res = await fetch("/api/tasks?status=in-progress")
      if (res.ok) {
        const tasks: TaskData[] = await res.json()
        setInProgressCount(tasks.length)
      }
    } catch {
      // tasks not available yet
    }

    // Routines
    try {
      const res = await fetch("/api/routines")
      if (res.ok) setRoutines(await res.json())
    } catch {
      // routines not available yet
    }

    // Today's heartbeat runs -- count from activity log
    try {
      const today = new Date().toISOString().split("T")[0]
      const res = await fetch(`/api/activity?action=heartbeat_run&limit=100`)
      if (res.ok) {
        const entries: ActivityEntry[] = await res.json()
        const todayEntries = entries.filter((e) =>
          e.createdAt.startsWith(today)
        )
        setTodaysRuns(todayEntries.length)
      }
    } catch {
      // runs not available yet
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 10000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  const activeRoutines = routines.filter((r) => r.status === "active")

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Agents"
          value={activeAgentCount}
          icon={<Users size={18} />}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Tasks In Progress"
          value={inProgressCount}
          icon={<ListTodo size={18} />}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Today's Runs"
          value={todaysRuns}
          icon={<Activity size={18} />}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Monthly Spend"
          value={`$${(monthlyCost / 100).toFixed(2)}`}
          icon={<DollarSign size={18} />}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      {/* Agent team */}
      {agents.length > 0 && (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Agent Team</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1 p-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors group"
              >
                <button
                  onClick={() => onSelectAgent?.(agent.id)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: AGENT_COLORS[agent.id] || "#6366f1" }}
                  >
                    {(agent.displayName || agent.name).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{agent.displayName || agent.name}</span>
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          agent.status === "active" && "agent-pulse",
                          agent.status === "thinking" && "thinking-pulse"
                        )}
                        style={{ backgroundColor: STATUS_COLORS[agent.status] }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {agent.currentTask || agent.role}
                    </p>
                  </div>
                </button>
                {agent.heartbeatSchedule && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAgentToggle?.(agent.id, !agent.heartbeatEnabled)
                    }}
                    className={cn(
                      "p-1.5 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-all",
                      agent.heartbeatEnabled
                        ? "text-amber-500 hover:bg-amber-50"
                        : "text-emerald-500 hover:bg-emerald-50"
                    )}
                    title={agent.heartbeatEnabled ? "Pause agent" : "Resume agent"}
                  >
                    {agent.heartbeatEnabled ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom: Activity Feed + Active Routines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {activity.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No activity yet. Agent actions will appear here.
              </div>
            )}
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>

        {/* Active Routines sidebar */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Active Routines</h3>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {activeRoutines.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active routines.
              </div>
            )}
            {activeRoutines.map((routine) => (
              <div
                key={routine.id}
                className="px-4 py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Repeat size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {routine.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {routine.triggers?.map((t, i) => (
                    <span
                      key={i}
                      className={cn(
                        "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
                        t.type === "cron"
                          ? "bg-blue-50 text-blue-700"
                          : t.type === "webhook"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {t.type}
                    </span>
                  ))}
                  {routine.lastTriggeredAt && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock size={10} />
                      {formatRelativeTime(routine.lastTriggeredAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  iconColor,
  iconBg,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            iconBg,
            iconColor
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const actionLabel = formatAction(entry.action)
  const accentColor = AGENT_COLORS[entry.agent] || "#6b7280"

  return (
    <div className="px-4 py-2.5 border-b border-border last:border-0 flex items-start gap-3">
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{entry.agent}</span>
          <span className="text-sm text-muted-foreground">{actionLabel}</span>
          {entry.task && (
            <span className="text-sm font-mono text-muted-foreground">
              {entry.task}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(entry.createdAt)}
          </span>
          {entry.durationMs != null && entry.durationMs > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {formatDuration(entry.durationMs)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAction(action: string): string {
  const map: Record<string, string> = {
    task_created: "created task",
    task_started: "started",
    task_completed: "completed",
    task_reassigned: "reassigned",
    task_deleted: "deleted task",
    heartbeat_run: "heartbeat run",
    routine_triggered: "triggered routine",
    chat_message: "sent message",
    agent_error: "encountered error",
  }
  return map[action] || action.replace(/_/g, " ")
}

function formatRelativeTime(iso: string): string {
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
