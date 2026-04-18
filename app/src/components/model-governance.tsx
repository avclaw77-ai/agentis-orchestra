"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check, Shield, Cpu, Info } from "lucide-react"
import { toast } from "sonner"

interface ProviderInfo {
  provider: string
  name: string
  configured: boolean
  mode: string
  color: string
}

interface RegistryModel {
  id: string
  provider: string
  model: string
  name: string
  costTier: string
  mode: string
}

interface AllowedModel {
  id: string
  provider: string
  name: string
}

interface ModelGovernanceProps {
  onUpdate?: () => void
}

const COST_BADGE: Record<string, string> = {
  subscription: "bg-violet-50 text-violet-600",
  cheap: "bg-sky-50 text-sky-600",
  standard: "bg-amber-50 text-amber-600",
  premium: "bg-red-50 text-red-500",
}

const COST_LABELS: Record<string, string> = {
  subscription: "SUB",
  cheap: "$",
  standard: "$$",
  premium: "$$$",
}

// Models that exist natively via direct API (not through OpenRouter)
const NATIVE_MODEL_PREFIXES: Record<string, string[]> = {
  "claude-cli": ["claude"],
  openai: ["gpt-", "o1", "o3", "o4"],
  perplexity: ["sonar"],
}

export function ModelGovernance({ onUpdate }: ModelGovernanceProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [registryModels, setRegistryModels] = useState<RegistryModel[]>([])
  const [liveOpenAIModels, setLiveOpenAIModels] = useState<string[]>([])
  const [allowedModels, setAllowedModels] = useState<AllowedModel[]>([])
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Fetch models + allowed list
  useEffect(() => {
    async function load() {
      try {
        const [modelsRes, allowedRes] = await Promise.all([
          fetch("/api/models"),
          fetch("/api/models/allowed"),
        ])
        if (modelsRes.ok) {
          const data = await modelsRes.json()
          setProviders(data.providers || [])
          setRegistryModels(data.models || [])
          setLiveOpenAIModels(data.liveOpenAIModels || [])
        }
        if (allowedRes.ok) {
          const data = await allowedRes.json()
          setAllowedModels(data.allowedModels || [])
        }
      } catch { /* */ }
      setLoaded(true)
    }
    load()
  }, [])

  // Determine which providers have native access to which model families
  const nativeProviders = useMemo(() => {
    const configured = new Set(providers.filter((p) => p.configured).map((p) => p.provider))
    return configured
  }, [providers])

  // Check if a model is available natively (not via OpenRouter)
  function isAvailableNatively(modelName: string, checkProvider: string): boolean {
    if (checkProvider !== "openrouter") return false
    // Check if any native provider covers this model
    for (const [provider, prefixes] of Object.entries(NATIVE_MODEL_PREFIXES)) {
      if (nativeProviders.has(provider) && prefixes.some((p) => modelName.toLowerCase().includes(p))) {
        return true
      }
    }
    return false
  }

  function isAllowed(modelId: string): boolean {
    return allowedModels.some((m) => m.id === modelId)
  }

  function toggleModel(model: RegistryModel) {
    setAllowedModels((prev) => {
      if (prev.some((m) => m.id === model.id)) {
        return prev.filter((m) => m.id !== model.id)
      }
      return [...prev, { id: model.id, provider: model.provider, name: model.name }]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/models/allowed", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedModels }),
      })
      if (res.ok) {
        toast.success(`${allowedModels.length} models allowed for the organization`)
        onUpdate?.()
      } else {
        toast.error("Failed to save model configuration")
      }
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  // Group models by provider
  const grouped = new Map<string, RegistryModel[]>()
  for (const model of registryModels) {
    const arr = grouped.get(model.provider) || []
    arr.push(model)
    grouped.set(model.provider, arr)
  }

  // Add live OpenAI models not in registry
  const registryOpenAIIds = new Set(registryModels.filter((m) => m.provider === "openai").map((m) => m.model))
  const extraOpenAI = liveOpenAIModels
    .filter((id) => !registryOpenAIIds.has(id))
    .map((id): RegistryModel => ({
      id: `openai:${id}`,
      provider: "openai",
      model: id,
      name: id,
      costTier: "standard",
      mode: "api",
    }))
  if (extraOpenAI.length > 0) {
    const existing = grouped.get("openai") || []
    grouped.set("openai", [...existing, ...extraOpenAI])
  }

  const providerOrder = ["claude-cli", "openai", "perplexity", "openrouter"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            Model Governance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select which models are available to agents in your organization.
            Users will only see models you allow here.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : `Save (${allowedModels.length} selected)`}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>
          Models are sourced from the provider with the direct API key first.
          If a model is available natively (e.g., Claude via Anthropic key), it will be greyed out in OpenRouter to avoid duplicate billing.
        </span>
      </div>

      {providerOrder.map((providerKey) => {
        const models = grouped.get(providerKey) || []
        const provider = providers.find((p) => p.provider === providerKey)
        if (!provider || !provider.configured || models.length === 0) return null

        return (
          <div key={providerKey} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: provider.color }}
              />
              <h4 className="text-sm font-semibold">{provider.name}</h4>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {models.filter((m) => isAllowed(m.id)).length} / {models.length} selected
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {models.map((model) => {
                const nativeBlock = isAvailableNatively(model.name, providerKey)
                const allowed = isAllowed(model.id)

                return (
                  <button
                    key={model.id}
                    onClick={() => !nativeBlock && toggleModel(model)}
                    disabled={nativeBlock}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      nativeBlock
                        ? "opacity-40 cursor-not-allowed"
                        : allowed
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-secondary"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      allowed
                        ? "border-primary bg-primary"
                        : "border-border"
                    )}>
                      {allowed && <Check size={12} className="text-white" />}
                    </div>
                    <Cpu size={14} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{model.name}</span>
                      {nativeBlock && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          (available via direct API key)
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
                      COST_BADGE[model.costTier] || "bg-muted text-muted-foreground"
                    )}>
                      {COST_LABELS[model.costTier] || model.costTier}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
