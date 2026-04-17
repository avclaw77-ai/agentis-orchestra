"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DollarSign,
  CheckCircle2,
  Zap,
  PiggyBank,
  AlertTriangle,
  Plus,
  Shield,
  TrendingUp,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CostSummary, BudgetPolicy, BudgetIncident } from "@/types"

// =============================================================================
// Formatting helpers
// =============================================================================

function formatCents(cents: number): string {
  if (cents >= 100) return `$${(cents / 100).toFixed(2)}`
  return `${cents}c`
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function scopeLabel(scopeType: string, scopeId: string | null): string {
  if (scopeType === "company") return "Company"
  if (scopeType === "department") return scopeId || "Department"
  return scopeId || "Agent"
}

function budgetBarColor(percent: number): string {
  if (percent < 60) return "bg-emerald-500"
  if (percent < 80) return "bg-amber-500"
  return "bg-red-500"
}

function budgetTextColor(percent: number): string {
  if (percent < 60) return "text-emerald-600"
  if (percent < 80) return "text-amber-600"
  return "text-red-600"
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string
  value: string
  icon: React.ReactNode
  subtitle?: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  )
}

function BudgetBar({
  label,
  usedCents,
  limitCents,
  percent,
}: {
  label: string
  usedCents: number
  limitCents: number
  percent: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("text-xs font-medium", budgetTextColor(percent))}>
          {formatDollars(usedCents)} / {formatDollars(limitCents)} ({percent}%)
        </span>
      </div>
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", budgetBarColor(percent))}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// Budget Form
// =============================================================================

interface BudgetFormProps {
  onSubmit: (policy: Omit<BudgetPolicy, "id" | "isActive">) => void
  onCancel: () => void
}

function BudgetForm({ onSubmit, onCancel }: BudgetFormProps) {
  const [scopeType, setScopeType] = useState<"company" | "department" | "agent">("company")
  const [scopeId, setScopeId] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [warnPercent, setWarnPercent] = useState(80)
  const [hardStop, setHardStop] = useState(true)

  function handleSubmit() {
    const amount = parseFloat(amountDollars)
    if (isNaN(amount) || amount <= 0) return
    onSubmit({
      scopeType,
      scopeId: scopeType === "company" ? null : scopeId || null,
      amountCents: Math.round(amount * 100),
      warnPercent,
      hardStopEnabled: hardStop,
      windowKind: "calendar_month",
    })
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        New Budget Policy
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Scope</label>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as any)}
            className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
          >
            <option value="company">Company-wide</option>
            <option value="department">Department</option>
            <option value="agent">Agent</option>
          </select>
        </div>

        {scopeType !== "company" && (
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              {scopeType === "department" ? "Department ID" : "Agent ID"}
            </label>
            <input
              type="text"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={scopeType === "department" ? "e.g. engineering" : "e.g. dev"}
              className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground font-medium">Monthly Budget ($)</label>
          <input
            type="number"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            placeholder="100.00"
            min="0"
            step="1"
            className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium">Warn at (%)</label>
          <input
            type="number"
            value={warnPercent}
            onChange={(e) => setWarnPercent(Number(e.target.value))}
            min="1"
            max="100"
            className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={hardStop}
          onChange={(e) => setHardStop(e.target.checked)}
          id="hard-stop"
          className="rounded"
        />
        <label htmlFor="hard-stop" className="text-sm">
          Hard stop when budget reached
        </label>
        <div className="relative group ml-1">
          <Info size={14} className="text-muted-foreground cursor-help" />
          <div className="absolute left-6 top-0 w-52 bg-card border border-border rounded-lg p-2 text-xs text-muted-foreground hidden group-hover:block shadow-lg z-10">
            When enabled, agents are blocked from executing once budget is fully consumed. Otherwise, only a warning is raised.
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          Create Policy
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function CostDashboard() {
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [budgetData, setBudgetData] = useState<{
    policies: Array<BudgetPolicy & { usedCents: number; percentUsed: number }>
    incidents: BudgetIncident[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBudgetForm, setShowBudgetForm] = useState(false)

  const now = new Date()
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const fetchData = useCallback(async () => {
    try {
      const [costRes, budgetRes] = await Promise.all([
        fetch("/api/costs"),
        fetch("/api/costs/budget"),
      ])
      if (costRes.ok) setSummary(await costRes.json())
      if (budgetRes.ok) setBudgetData(await budgetRes.json())
    } catch {
      // Will populate once data exists
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleCreatePolicy(policy: Omit<BudgetPolicy, "id" | "isActive">) {
    await fetch("/api/costs/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    })
    setShowBudgetForm(false)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading cost data...
      </div>
    )
  }

  const s = summary ?? {
    totalCents: 0,
    cliCents: 0,
    apiCents: 0,
    cliSavings: 0,
    byAgent: [],
    byModel: [],
    byDay: [],
    byDepartment: [],
    tasksCompleted: 0,
    totalRuns: 0,
  }

  const openIncidents = budgetData?.incidents ?? []
  const policies = budgetData?.policies ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cost & ROI</h2>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
      </div>

      {/* Alert banner for open incidents */}
      {openIncidents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {openIncidents.length} budget {openIncidents.length === 1 ? "alert" : "alerts"} active
            </p>
            <ul className="text-xs text-red-700 mt-1 space-y-0.5">
              {openIncidents.slice(0, 3).map((inc) => (
                <li key={inc.id}>
                  {inc.thresholdType === "hard_stop" ? "HARD STOP" : "Warning"}:{" "}
                  {scopeLabel(inc.scopeType, inc.scopeId)} at{" "}
                  {formatDollars(inc.amountObserved)} / {formatDollars(inc.amountLimit)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Spent"
          value={formatDollars(s.totalCents)}
          icon={<DollarSign size={18} />}
          subtitle={`${formatDollars(s.apiCents)} API + ${formatDollars(s.cliCents)} CLI`}
        />
        <StatCard
          label="Tasks Completed"
          value={String(s.tasksCompleted)}
          icon={<CheckCircle2 size={18} />}
        />
        <StatCard
          label="Runs"
          value={String(s.totalRuns)}
          icon={<Zap size={18} />}
          subtitle={s.totalRuns > 0 ? `~${formatCents(Math.round(s.totalCents / s.totalRuns))}/run` : undefined}
        />
        <StatCard
          label="CLI Savings"
          value={formatDollars(s.cliSavings)}
          icon={<PiggyBank size={18} />}
          subtitle="vs API pricing"
        />
      </div>

      {/* Daily Spend Chart */}
      {s.byDay.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Daily Spend</h3>
          <div className="h-32 flex items-end gap-1">
            {s.byDay.map((day, i) => {
              const maxCents = Math.max(...s.byDay.map(d => d.cents), 1)
              const heightPct = (day.cents / maxCents) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: ${formatDollars(day.cents)}`}>
                  <div className="w-full bg-primary/20 rounded-t relative" style={{ height: `${Math.max(heightPct, 2)}%` }}>
                    <div className="w-full h-full bg-primary rounded-t" />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1st</span>
            <span className="text-[10px] text-muted-foreground">15th</span>
            <span className="text-[10px] text-muted-foreground">30th</span>
          </div>
        </div>
      )}

      {/* CLI Savings callout card */}
      {s.cliSavings > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-green-600" />
            <h3 className="text-sm font-semibold text-green-800">CLI Savings</h3>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatDollars(s.cliSavings)}</p>
          <p className="text-xs text-green-600 mt-1">saved this month vs API pricing</p>
          <p className="text-xs text-muted-foreground mt-2">
            {s.totalRuns} runs on CLI models (free). Equivalent API cost: {formatDollars(s.cliSavings)}
          </p>
        </div>
      )}

      {/* Two-column layout: Department + Model breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Department */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">By Department</h3>
          {s.byDepartment.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cost data yet</p>
          ) : (
            <div className="space-y-3">
              {s.byDepartment.map((d) => (
                <div key={d.departmentId} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">{formatDollars(d.cents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Model */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">By Model</h3>
          {s.byModel.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cost data yet</p>
          ) : (
            <div className="space-y-3">
              {s.byModel.map((m) => {
                const isCli = m.modelId.startsWith("claude-cli:")
                return (
                  <div key={m.modelId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isCli
                            ? "bg-emerald-500"
                            : m.modelId.startsWith("openai:")
                              ? "bg-violet-500"
                              : m.modelId.startsWith("perplexity:")
                                ? "bg-sky-500"
                                : "bg-orange-500"
                        )}
                      />
                      <span className="font-medium">{m.modelId.split(":")[1] || m.modelId}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">{formatDollars(m.cents)}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({(m.tokens / 1000).toFixed(0)}k tok)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* By Agent */}
      {s.byAgent.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">By Agent</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {s.byAgent.map((a) => (
              <div
                key={a.agentId}
                className="flex items-center justify-between text-sm border border-border rounded-lg p-3"
              >
                <div>
                  <p className="font-medium">{a.agentName}</p>
                  <p className="text-xs text-muted-foreground">{a.runs} runs</p>
                </div>
                <span className="font-mono text-muted-foreground">{formatDollars(a.cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Budget Status</h3>
          <button
            onClick={() => setShowBudgetForm(!showBudgetForm)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Add Policy
          </button>
        </div>

        {showBudgetForm && (
          <div className="mb-4">
            <BudgetForm
              onSubmit={handleCreatePolicy}
              onCancel={() => setShowBudgetForm(false)}
            />
          </div>
        )}

        {policies.length === 0 ? (
          <div className="text-center py-8">
            <Shield size={32} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No budget policies configured</p>
            <p className="text-xs text-muted-foreground">
              Set monthly spending limits at the company, department, or agent level.
              Agents will be warned or stopped when limits are reached.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map((p) => (
              <BudgetBar
                key={p.id ?? `${p.scopeType}-${p.scopeId}`}
                label={scopeLabel(p.scopeType, p.scopeId)}
                usedCents={p.usedCents}
                limitCents={p.amountCents}
                percent={p.percentUsed}
              />
            ))}
          </div>
        )}
      </div>

      {/* CLI Savings callout */}
      {s.cliSavings > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <TrendingUp size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              CLI agents saved {formatDollars(s.cliSavings)} vs API pricing this month
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Claude Code CLI runs through the Pro subscription at no per-token cost.
              The equivalent API usage would have cost {formatDollars(s.cliSavings)}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
