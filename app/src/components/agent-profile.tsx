"use client"

import { useState, useEffect } from "react"
import { X, Save, Plus, X as XIcon, Sparkles, Loader2, Play } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AGENT_COLORS, STATUS_COLORS } from "@/lib/constants"
import { HeartbeatConfig } from "@/components/heartbeat-config"
import { RunTimeline } from "@/components/run-timeline"
import { SoulBuilder } from "@/components/soul-builder"
import { PersonaHistory } from "@/components/persona-history"
import { PersonaProposals } from "@/components/persona-proposals"
import type { Agent, AgentConfig, HeartbeatRun, Department } from "@/types"

// ---------------------------------------------------------------------------
// Model options (shared with setup)
// ---------------------------------------------------------------------------

const MODEL_OPTIONS = [
  { id: "claude-cli:opus", name: "Claude Opus 4.6 (CLI)", costTier: "SUB" },
  { id: "claude-cli:sonnet", name: "Claude Sonnet 4.6 (CLI)", costTier: "SUB" },
  { id: "claude-cli:haiku", name: "Claude Haiku 4.5 (CLI)", costTier: "SUB" },
  { id: "anthropic:opus", name: "Claude Opus 4.6 (API)", costTier: "$$$" },
  { id: "anthropic:sonnet", name: "Claude Sonnet 4.6 (API)", costTier: "$$" },
  { id: "anthropic:haiku", name: "Claude Haiku 4.5 (API)", costTier: "$" },
  { id: "perplexity:sonar-pro", name: "Perplexity Sonar Pro", costTier: "$$" },
  { id: "perplexity:sonar", name: "Perplexity Sonar", costTier: "$" },
  { id: "openai:gpt-4.1", name: "GPT-4.1", costTier: "$$" },
  { id: "openai:gpt-4.1-mini", name: "GPT-4.1 Mini", costTier: "$" },
  { id: "openai:gpt-4.1-nano", name: "GPT-4.1 Nano", costTier: "$" },
  { id: "openai:o4-mini", name: "OpenAI o4-mini", costTier: "$$" },
  { id: "openai:o3", name: "OpenAI o3", costTier: "$$$" },
  { id: "openrouter:deepseek-v3", name: "DeepSeek V3", costTier: "$" },
  { id: "openrouter:gemini-2.5-pro", name: "Gemini 2.5 Pro", costTier: "$$" },
  { id: "openrouter:llama-4-maverick", name: "Llama 4 Maverick", costTier: "$" },
  { id: "openrouter:qwen-3-235b", name: "Qwen 3 235B", costTier: "$" },
]

const ADAPTER_OPTIONS = [
  { id: "sdk", label: "SDK" },
  { id: "cli", label: "CLI" },
  { id: "api", label: "API" },
  { id: "http", label: "HTTP" },
]

const COST_BADGE_STYLES: Record<string, string> = {
  SUB: "bg-violet-50 text-violet-600",
  $: "bg-sky-50 text-sky-600",
  $$: "bg-amber-50 text-amber-600",
  $$$: "bg-red-50 text-red-500",
}

type Tab = "overview" | "config" | "heartbeat" | "runs" | "soul"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentProfileProps {
  agent: Agent
  config: AgentConfig | null
  agents: Agent[]
  departments: Department[]
  onClose: () => void
  onSave: (config: Partial<AgentConfig>) => void
  onSaveHeartbeat: (schedule: string, enabled: boolean) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentProfile({
  agent,
  config,
  agents,
  departments,
  onClose,
  onSave,
  onSaveHeartbeat,
}: AgentProfileProps) {
  const [tab, setTab] = useState<Tab>("overview")

  // Config form state
  const [displayName, setDisplayName] = useState(agent.displayName || "")
  const [persona, setPersona] = useState(config?.persona || "")
  const [model, setModel] = useState(config?.model || "claude-cli:sonnet")
  const [adapterType, setAdapterType] = useState(config?.adapterType || "sdk")
  const [guardrails, setGuardrails] = useState(config?.guardrails || "")
  const [dataSources, setDataSources] = useState<string[]>(config?.dataSources || [])
  const [newDataSource, setNewDataSource] = useState("")
  const [reportsTo, setReportsTo] = useState(config?.reportsTo || "")
  const [budget, setBudget] = useState(config?.budget ? (config.budget / 100).toString() : "")
  const [toolPermissions, setToolPermissions] = useState<string[]>(config?.toolPermissions || [])
  const [saving, setSaving] = useState(false)

  // AI configure state
  const [aiDescription, setAiDescription] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)

  // Runs state
  const [runs, setRuns] = useState<HeartbeatRun[]>([])
  const [runsLoaded, setRunsLoaded] = useState(false)
  const [triggering, setTriggering] = useState(false)

  async function handleTrigger() {
    setTriggering(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/trigger`, { method: "POST" })
      if (res.ok) {
        toast.success(`${agent.displayName || agent.name} triggered -- running now`)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to trigger agent")
      }
    } catch {
      toast.error("Failed to trigger agent")
    } finally {
      setTriggering(false)
    }
  }

  // Runtime stats
  const [runtimeStats, setRuntimeStats] = useState<{
    totalTokens: number
    totalCostCents: number
    tasksCompleted: number
  } | null>(null)

  // Sync form when config changes
  useEffect(() => {
    setPersona(config?.persona || "")
    setModel(config?.model || "claude-cli:sonnet")
    setAdapterType(config?.adapterType || "sdk")
    setGuardrails(config?.guardrails || "")
    setDataSources(config?.dataSources || [])
    setReportsTo(config?.reportsTo || "")
    setBudget(config?.budget ? (config.budget / 100).toString() : "")
    setToolPermissions(config?.toolPermissions || [])
  }, [config])

  // Fetch runs when switching to runs tab
  useEffect(() => {
    if (tab === "runs" && !runsLoaded) {
      fetchRuns()
    }
  }, [tab, runsLoaded])

  // Fetch runtime stats on mount
  useEffect(() => {
    fetchRuntimeStats()
  }, [agent.id])

  async function fetchRuns() {
    try {
      const res = await fetch(`/api/agents/${agent.id}/runs?limit=50`)
      if (res.ok) {
        const data = await res.json()
        setRuns(data.runs || [])
        setRunsLoaded(true)
      }
    } catch {
      // Runs will load once available
    }
  }

  async function fetchRuntimeStats() {
    try {
      const res = await fetch(`/api/agents/${agent.id}/stats`)
      if (res.ok) {
        setRuntimeStats(await res.json())
      }
    } catch {
      // Stats will be available once agent has run
    }
  }

  function handleAddDataSource() {
    const val = newDataSource.trim()
    if (!val || dataSources.includes(val)) return
    setDataSources((prev) => [...prev, val])
    setNewDataSource("")
  }

  function handleRemoveDataSource(idx: number) {
    setDataSources((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleAiGenerate() {
    if (!aiDescription.trim()) return
    setAiGenerating(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "AI generation failed")
        return
      }
      const data = await res.json()
      if (data.persona) setPersona(data.persona)
      if (data.guardrails) {
        const rules = Array.isArray(data.guardrails) ? data.guardrails.join("\n") : data.guardrails
        setGuardrails(rules)
      }
      if (data.model) setModel(data.model)
      toast.success("Config generated -- review and save")
    } catch {
      toast.error("Failed to generate config")
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleSaveConfig() {
    setSaving(true)
    // Save displayName on the agent record itself
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName || null }),
      })
    } catch {
      // Non-blocking -- config save continues
    }
    const budgetCents = budget ? Math.round(parseFloat(budget) * 100) : null
    onSave({
      agentId: agent.id,
      persona: persona || null,
      model,
      adapterType: adapterType as AgentConfig["adapterType"],
      guardrails: guardrails || null,
      dataSources,
      reportsTo: reportsTo || null,
      budget: budgetCents,
      toolPermissions: toolPermissions.length > 0 ? toolPermissions : null,
    })
    setSaving(false)
  }

  const dept = departments.find((d) => d.id === agent.departmentId)
  const modelOption = MODEL_OPTIONS.find((m) => m.id === model)
  const totalTokens = runtimeStats?.totalTokens ?? 0
  const totalCostCents = runtimeStats?.totalCostCents ?? 0
  const tasksCompleted = runtimeStats?.tasksCompleted ?? 0

  const [showSoulBuilder, setShowSoulBuilder] = useState(false)

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "config", label: "Config" },
    { key: "soul", label: "Soul" },
    { key: "heartbeat", label: "Heartbeat" },
    { key: "runs", label: "Runs" },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[560px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Agent avatar */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: AGENT_COLORS[agent.id] || "#6366f1" }}
              >
                {(agent.displayName || agent.name).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-semibold">{agent.displayName || agent.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {agent.displayName ? `${agent.name} — ${agent.role}` : agent.role}
                </p>
                {dept && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: dept.color }}
                    />
                    {dept.name}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        agent.status === "active" && "agent-pulse",
                        agent.status === "thinking" && "thinking-pulse"
                      )}
                      style={{ backgroundColor: STATUS_COLORS[agent.status] }}
                    />
                    <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
                  </div>
                  <button
                    onClick={handleTrigger}
                    disabled={triggering || agent.status === "active"}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      "bg-primary/10 text-primary hover:bg-primary/20",
                      (triggering || agent.status === "active") && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {triggering ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    {triggering ? "Running..." : "Run Now"}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-secondary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ============================================================= */}
          {/* OVERVIEW TAB                                                   */}
          {/* ============================================================= */}
          {tab === "overview" && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-inset rounded-lg px-4 py-3">
                  <p className="text-lg font-semibold tabular-nums">{tasksCompleted}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tasks</p>
                </div>
                <div className="bg-inset rounded-lg px-4 py-3">
                  <p className="text-lg font-semibold tabular-nums">{formatTokens(totalTokens)}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tokens</p>
                </div>
                <div className="bg-inset rounded-lg px-4 py-3">
                  <p className="text-lg font-semibold tabular-nums">${(totalCostCents / 100).toFixed(2)}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Spend</p>
                </div>
              </div>

              {/* Model badge */}
              <div className="bg-inset rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Model</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {modelOption?.name || config?.model || "Not configured"}
                    </span>
                    {modelOption && (
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          COST_BADGE_STYLES[modelOption.costTier] || "bg-muted text-muted-foreground"
                        )}
                      >
                        {modelOption.costTier}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Heartbeat</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {agent.heartbeatSchedule || "Off"}
                    </span>
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        agent.heartbeatEnabled ? "bg-green-500" : "bg-gray-300"
                      )}
                    />
                    <span className="text-xs text-muted-foreground">
                      {agent.heartbeatEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {config?.reportsTo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Reports to</span>
                    <span className="text-sm">{agents.find((a) => a.id === config.reportsTo)?.name || config.reportsTo}</span>
                  </div>
                )}
              </div>

              {/* Data sources */}
              {config?.dataSources && config.dataSources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Data Sources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.dataSources.map((ds, i) => (
                      <span key={i} className="text-xs bg-secondary px-2 py-1 rounded font-mono">
                        {ds}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Current task */}
              {agent.currentTask && (
                <div className="bg-inset rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Current Task</p>
                  <p className="text-sm">{agent.currentTask}</p>
                </div>
              )}
            </>
          )}

          {/* ============================================================= */}
          {/* CONFIG TAB                                                     */}
          {/* ============================================================= */}
          {tab === "config" && (
            <div className="space-y-5">
              {/* AI Configure */}
              <div className="bg-inset rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Describe what this agent should do...
                  </span>
                </div>
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="e.g., I need an agent that monitors our production line for quality issues and alerts the team when defects spike"
                  rows={3}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none resize-y"
                />
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiDescription.trim()}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    (aiGenerating || !aiDescription.trim()) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      Generate Config
                    </>
                  )}
                </button>
              </div>

              {/* Display Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground" title="A friendly name employees see instead of the technical agent ID">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={`Optional friendly name (e.g. "Sophie" instead of "${agent.name}")`}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Helps with change management -- employees engage more with named agents
                </p>
              </div>

              {/* Persona */}
              <div>
                <label className="text-xs font-medium text-muted-foreground" title="Instructions that define the agent's personality, expertise, and behavior. This is the system prompt sent with every interaction.">Persona / System Prompt</label>
                <textarea
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  placeholder="Describe the agent's personality, responsibilities, and behavior..."
                  rows={8}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm font-mono outline-none resize-y"
                />
              </div>

              {/* Model */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Model</label>
                <div className="relative mt-1">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none appearance-none pr-20"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {modelOption && (
                    <span
                      className={cn(
                        "absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1 py-0.5 rounded pointer-events-none",
                        COST_BADGE_STYLES[modelOption.costTier] || "bg-muted text-muted-foreground"
                      )}
                    >
                      {modelOption.costTier}
                    </span>
                  )}
                </div>
              </div>

              {/* Adapter type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Adapter Type</label>
                <select
                  value={adapterType}
                  onChange={(e) => setAdapterType(e.target.value as "sdk" | "cli" | "api" | "http")}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {ADAPTER_OPTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guardrails */}
              <div>
                <label className="text-xs font-medium text-muted-foreground" title="Rules and constraints the agent must follow. One per line. Examples: 'Never delete production data', 'Always ask before spending over $10'">Guardrails</label>
                <textarea
                  value={guardrails}
                  onChange={(e) => setGuardrails(e.target.value)}
                  placeholder="Rules and constraints this agent must follow..."
                  rows={4}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none resize-y"
                />
              </div>

              {/* Data Sources */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Data Sources</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {dataSources.map((ds, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded font-mono"
                    >
                      {ds}
                      <button
                        onClick={() => handleRemoveDataSource(i)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <XIcon size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newDataSource}
                    onChange={(e) => setNewDataSource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddDataSource()
                      }
                    }}
                    placeholder="Add data source..."
                    className="flex-1 bg-inset rounded-lg px-3 py-1.5 text-sm outline-none"
                  />
                  <button
                    onClick={handleAddDataSource}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Reports To */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reports To</label>
                <select
                  value={reportsTo}
                  onChange={(e) => setReportsTo(e.target.value)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="">None</option>
                  {agents
                    .filter((a) => a.id !== agent.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                </select>
              </div>

              {/* Budget */}
              <div>
                <label className="text-xs font-medium text-muted-foreground" title="Maximum monthly API spend for this agent. Auto-paused at 100% of budget.">Monthly Budget (USD)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full bg-inset rounded-lg pl-7 pr-3 py-2 text-sm outline-none tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/month</span>
                </div>
              </div>

              {/* Tool Permissions */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tool Permissions</label>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                  Select which tools this agent is allowed to use
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {["Read", "Write", "Edit", "Bash", "Grep", "WebSearch", "WebFetch"].map((tool) => (
                    <label
                      key={tool}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-inset cursor-pointer hover:bg-secondary transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={toolPermissions.includes(tool)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setToolPermissions((prev) => [...prev, tool])
                          } else {
                            setToolPermissions((prev) => prev.filter((t) => t !== tool))
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm font-medium">{tool}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* HEARTBEAT TAB                                                  */}
          {/* ============================================================= */}
          {tab === "heartbeat" && (
            <HeartbeatConfig
              agentId={agent.id}
              agentRole={agent.role}
              agentModel={config?.model || "claude-cli:sonnet"}
              schedule={agent.heartbeatSchedule}
              enabled={agent.heartbeatEnabled}
              onSave={onSaveHeartbeat}
            />
          )}

          {/* ============================================================= */}
          {/* SOUL TAB                                                       */}
          {/* ============================================================= */}
          {tab === "soul" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Agent Soul</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Persona evolution, feedback signals, and refinement proposals
                  </p>
                </div>
                <button
                  onClick={() => setShowSoulBuilder(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  <Sparkles size={12} />
                  Soul Builder
                </button>
              </div>

              <PersonaProposals agentId={agent.id} agentName={agent.displayName || agent.name} />
              <PersonaHistory agentId={agent.id} />

              {showSoulBuilder && (
                <SoulBuilder
                  agentId={agent.id}
                  agentName={agent.displayName || agent.name}
                  currentPersona={config?.persona || undefined}
                  agents={agents}
                  onClose={() => setShowSoulBuilder(false)}
                  onSave={() => {
                    setShowSoulBuilder(false)
                    toast.success("Persona updated via Soul Builder")
                  }}
                />
              )}
            </div>
          )}

          {/* RUNS TAB                                                       */}
          {/* ============================================================= */}
          {tab === "runs" && (
            <RunTimeline agentId={agent.id} runs={runs} />
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}
