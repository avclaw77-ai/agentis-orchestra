"use client"

import { useState, useEffect, useCallback } from "react"
import { Puzzle, RefreshCw, CheckCircle2, XCircle, Loader2, StopCircle } from "lucide-react"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// =============================================================================
// Types
// =============================================================================

interface PluginInfo {
  name: string
  version: string
  status: "loading" | "ready" | "error" | "stopped"
  capabilities: string[]
  toolCount: number
  crashCount: number
  error?: string
}

// =============================================================================
// Status badge
// =============================================================================

function StatusBadge({ status, t }: { status: PluginInfo["status"]; t: ReturnType<typeof useT> }) {
  const config = {
    ready: {
      icon: <CheckCircle2 size={12} />,
      label: t("plugins.status_ready"),
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    error: {
      icon: <XCircle size={12} />,
      label: t("plugins.status_error"),
      className: "bg-red-50 text-red-700 border-red-200",
    },
    stopped: {
      icon: <StopCircle size={12} />,
      label: t("plugins.status_stopped"),
      className: "bg-gray-50 text-gray-500 border-gray-200",
    },
    loading: {
      icon: <Loader2 size={12} className="animate-spin" />,
      label: t("plugins.status_loading"),
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
  }[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

// =============================================================================
// Capability badge
// =============================================================================

function CapabilityBadge({ capability }: { capability: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
      {capability}
    </span>
  )
}

// =============================================================================
// Plugin Manager Component
// =============================================================================

export function PluginManager() {
  const t = useT()
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState<string | null>(null)

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch("/api/bridge/plugins")
      if (res.ok) {
        const data = await res.json()
        setPlugins(data.plugins || [])
      }
    } catch {
      // Bridge might not be reachable
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlugins()
  }, [fetchPlugins])

  async function handleRestart(pluginName: string) {
    setRestarting(pluginName)
    try {
      await fetch(`/api/bridge/plugins/${encodeURIComponent(pluginName)}/restart`, {
        method: "POST",
      })
      // Wait a moment for the restart to complete
      await new Promise((r) => setTimeout(r, 1500))
      await fetchPlugins()
    } catch {
      // Restart failed
    } finally {
      setRestarting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 size={18} className="animate-spin mr-2" />
        {t("common.loading")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle size={18} className="text-primary" />
          <h3 className="text-sm font-semibold">{t("plugins.title")}</h3>
          <span className="text-xs text-muted-foreground">
            {t("plugins.installed", { count: String(plugins.length) })}
          </span>
        </div>
        <button
          onClick={fetchPlugins}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Plugin list */}
      {plugins.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Puzzle size={32} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("plugins.no_plugins")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.name}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{plugin.name}</span>
                    <span className="text-xs text-muted-foreground">v{plugin.version}</span>
                    <StatusBadge status={plugin.status} t={t} />
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    {plugin.capabilities.map((cap) => (
                      <CapabilityBadge key={cap} capability={cap} />
                    ))}
                    {plugin.toolCount > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {plugin.toolCount} tools
                      </span>
                    )}
                  </div>

                  {plugin.error && (
                    <p className="text-xs text-red-600 mt-2 truncate">{plugin.error}</p>
                  )}

                  {plugin.crashCount > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {t("plugins.crashes", { count: String(plugin.crashCount) })}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {(plugin.status === "error" || plugin.status === "stopped") && (
                    <button
                      onClick={() => handleRestart(plugin.name)}
                      disabled={restarting === plugin.name}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        "border border-border hover:bg-secondary",
                        restarting === plugin.name && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <RefreshCw
                        size={12}
                        className={restarting === plugin.name ? "animate-spin" : ""}
                      />
                      {t("plugins.restart")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
