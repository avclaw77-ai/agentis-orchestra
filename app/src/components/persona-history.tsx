"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Wrench,
  User,
  Bot,
  History,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PersonaVersion } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  manual: { label: "Manual", className: "bg-sky-50 text-sky-600", icon: User },
  soul_builder: { label: "Soul Builder", className: "bg-violet-50 text-violet-600", icon: Sparkles },
  refinement_engine: { label: "Refined", className: "bg-amber-50 text-amber-600", icon: Wrench },
  self_evolution: { label: "Self-evolved", className: "bg-emerald-50 text-emerald-600", icon: Bot },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonaHistoryProps {
  agentId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonaHistory({ agentId }: PersonaHistoryProps) {
  const [versions, setVersions] = useState<PersonaVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/persona`)
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.versions || []
        // Sort by version descending (newest first)
        list.sort((a: PersonaVersion, b: PersonaVersion) => b.version - a.version)
        setVersions(list)
      }
    } catch {
      // Will show empty state
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  function toggleExpand(id: number) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-12">
        <History size={24} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No persona history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold mb-3">
        Persona History
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          ({versions.length} version{versions.length !== 1 ? "s" : ""})
        </span>
      </h3>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />

        {versions.map((version, idx) => {
          const source = SOURCE_CONFIG[version.changeSource] || SOURCE_CONFIG.manual
          const SourceIcon = source.icon
          const isExpanded = expanded === version.id
          const isLatest = idx === 0

          return (
            <div key={version.id} className="relative pl-10 pb-4">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute left-2.5 top-2.5 w-3 h-3 rounded-full border-2 border-card z-10",
                  isLatest ? "bg-primary" : "bg-border"
                )}
              />

              {/* Card */}
              <button
                onClick={() => toggleExpand(version.id)}
                className={cn(
                  "w-full text-left rounded-lg border transition-colors",
                  isExpanded
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card hover:bg-inset"
                )}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        v{version.version}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                          source.className
                        )}
                      >
                        <SourceIcon size={9} />
                        {source.label}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                          Current
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={14} className="text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {version.approvedBy && (
                      <span className="text-xs text-muted-foreground">
                        Approved by {version.approvedBy}
                      </span>
                    )}
                  </div>

                  {version.changeSummary && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {version.changeSummary}
                    </p>
                  )}
                </div>
              </button>

              {/* Expanded: full persona text */}
              {isExpanded && (
                <div className="mt-2 rounded-lg border border-border bg-inset px-4 py-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Full Persona
                  </p>
                  <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed max-h-80 overflow-y-auto">
                    {version.personaText}
                  </pre>

                  {version.structuredPersona && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Structured Data
                      </p>
                      {version.structuredPersona.role && (
                        <div>
                          <span className="text-[10px] text-muted-foreground font-medium">Role:</span>
                          <p className="text-xs mt-0.5">{version.structuredPersona.role}</p>
                        </div>
                      )}
                      {version.structuredPersona.priorities?.length > 0 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground font-medium">Priorities:</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {version.structuredPersona.priorities.map((p, i) => (
                              <li key={i} className="text-xs text-foreground/80">
                                {i + 1}. {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {version.structuredPersona.tools?.length > 0 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground font-medium">Tools:</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {version.structuredPersona.tools.map((t) => (
                              <span key={t} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
