"use client"

import { useState, useEffect } from "react"
import {
  Cpu,
  Key,
  Check,
  X,
  Zap,
  Search,
  Code,
  MessageSquare,
  Eye,
  Brain,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"

// =============================================================================
// Types (mirroring bridge/models.ts for the frontend)
// =============================================================================

type Provider = "claude-cli" | "openrouter" | "perplexity" | "openai"
type CostTier = "free" | "cheap" | "standard" | "premium"
type TaskType = "code" | "code-review" | "research" | "writing" | "analysis" | "quick" | "vision" | "conversation" | "orchestration"

interface ModelDef {
  id: string
  provider: Provider
  model: string
  name: string
  strengths: TaskType[]
  costTier: CostTier
  mode: "cli" | "api"
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
  notes?: string
}

interface ProviderStatus {
  provider: Provider
  name: string
  configured: boolean
  mode: "cli" | "api"
  icon: React.ReactNode
  description: string
  color: string
}

// =============================================================================
// Provider metadata
// =============================================================================

const PROVIDER_INFO: Omit<ProviderStatus, "configured">[] = [
  {
    provider: "claude-cli",
    name: "Claude (CLI)",
    mode: "cli",
    icon: <Terminal size={16} />,
    description: "Pro subscription -- flat monthly cost, no per-token billing",
    color: "#d97706",
  },
  {
    provider: "openrouter",
    name: "OpenRouter",
    mode: "api",
    icon: <Cpu size={16} />,
    description: "100+ models -- GPT, Gemini, Llama, DeepSeek, Qwen, and more",
    color: "#6366f1",
  },
  {
    provider: "perplexity",
    name: "Perplexity",
    mode: "api",
    icon: <Search size={16} />,
    description: "Web search with citations -- research and fact-checking",
    color: "#0ea5e9",
  },
  {
    provider: "openai",
    name: "OpenAI",
    mode: "api",
    icon: <Brain size={16} />,
    description: "GPT-4o, o3 -- structured output and reasoning",
    color: "#10b981",
  },
]

const TASK_ICONS: Record<TaskType, React.ReactNode> = {
  code: <Code size={14} />,
  "code-review": <Code size={14} />,
  research: <Search size={14} />,
  writing: <MessageSquare size={14} />,
  analysis: <Brain size={14} />,
  quick: <Zap size={14} />,
  vision: <Eye size={14} />,
  conversation: <MessageSquare size={14} />,
  orchestration: <Brain size={14} />,
}

const COST_BADGES: Record<CostTier, { label: string; color: string }> = {
  free: { label: "FREE", color: "#34c759" },
  cheap: { label: "$", color: "#ffb340" },
  standard: { label: "$$", color: "#ff9500" },
  premium: { label: "$$$", color: "#ff3b30" },
}

// =============================================================================
// Component
// =============================================================================

export function ModelConfig() {
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([])
  const [models, setModels] = useState<ModelDef[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider | "all">("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const res = await fetch("/api/models")
      if (res.ok) {
        const data = await res.json()
        setProviderStatus(data.providers)
        setModels(data.models)
      }
    } catch {
      // Fallback: show provider info without live status
      setProviderStatus(
        PROVIDER_INFO.map((p) => ({ ...p, configured: p.provider === "claude-cli" }))
      )
    } finally {
      setLoading(false)
    }
  }

  const filteredModels =
    selectedProvider === "all"
      ? models
      : models.filter((m) => m.provider === selectedProvider)

  return (
    <div className="space-y-6">
      {/* Provider Cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Providers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(providerStatus.length > 0 ? providerStatus : PROVIDER_INFO.map((p) => ({ ...p, configured: false }))).map(
            (p) => (
              <button
                key={p.provider}
                onClick={() =>
                  setSelectedProvider(
                    selectedProvider === p.provider ? "all" : p.provider
                  )
                }
                className={cn(
                  "bg-card border rounded-xl p-4 text-left transition-all",
                  selectedProvider === p.provider
                    ? "border-primary ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: p.color }}
                  >
                    {p.icon}
                    {p.name}
                  </div>
                  {p.configured ? (
                    <div className="flex items-center gap-1 text-xs text-status-active">
                      <Check size={12} />
                      Active
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <X size={12} />
                      No key
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
                <div className="mt-2">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      p.mode === "cli"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {p.mode === "cli" ? "Pro Subscription" : "API Key"}
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      </div>

      {/* Model List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">
            Models{" "}
            {selectedProvider !== "all" && (
              <span className="text-muted-foreground font-normal">
                -- {selectedProvider}
              </span>
            )}
          </h2>
          <span className="text-xs text-muted-foreground">
            {filteredModels.length} models
          </span>
        </div>

        <div className="space-y-2">
          {filteredModels.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-8 text-center">
              {models.length === 0
                ? "Connect to the bridge to see available models"
                : "No models for this provider"}
            </div>
          )}

          {filteredModels.map((model) => {
            const cost = COST_BADGES[model.costTier]
            return (
              <div
                key={model.id}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4"
              >
                {/* Name + provider */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {model.name}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: cost.color + "18",
                        color: cost.color,
                      }}
                    >
                      {cost.label}
                    </span>
                  </div>
                  {model.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {model.notes}
                    </p>
                  )}
                </div>

                {/* Strengths */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {model.strengths.slice(0, 3).map((s) => (
                    <div
                      key={s}
                      className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md"
                      title={s}
                    >
                      {TASK_ICONS[s]}
                      <span className="hidden xl:inline">{s}</span>
                    </div>
                  ))}
                </div>

                {/* Context window */}
                <div className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                  {(model.contextWindow / 1000).toFixed(0)}k
                </div>

                {/* Capabilities */}
                <div className="flex items-center gap-2 shrink-0">
                  {model.supportsVision && (
                    <Eye size={14} className="text-muted-foreground" title="Vision" />
                  )}
                  {model.supportsTools && (
                    <Zap size={14} className="text-muted-foreground" title="Tools" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
