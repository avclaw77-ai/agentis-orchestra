"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronUp, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { AGENT_COLORS } from "@/lib/constants"
import type { Decision, Department } from "@/types"

interface DecisionLogProps {
  departments: Department[]
  selectedDepartment: string | null
}

export function DecisionLog({ departments, selectedDepartment }: DecisionLogProps) {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterDept, setFilterDept] = useState<string | null>(selectedDepartment)

  const fetchDecisions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterDept) params.set("departmentId", filterDept)
      params.set("limit", "50")
      const res = await fetch(`/api/decisions?${params}`)
      if (res.ok) {
        setDecisions(await res.json())
      }
    } catch {
      // Will load once DB is ready
    }
  }, [filterDept])

  useEffect(() => {
    fetchDecisions()
  }, [fetchDecisions])

  // Sync external department filter
  useEffect(() => {
    setFilterDept(selectedDepartment)
  }, [selectedDepartment])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Decision Log</h3>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={filterDept || ""}
            onChange={(e) => setFilterDept(e.target.value || null)}
            className="bg-inset rounded-lg px-2 py-1 text-xs outline-none"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No decisions logged yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Agent decisions will appear here as they work
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {decisions.map((d) => {
            const isExpanded = expandedId === d.id
            return (
              <div key={d.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-surface-hover transition-colors"
                >
                  {/* Date */}
                  <div className="w-20 shrink-0">
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDate(d.createdAt)}
                    </span>
                  </div>

                  {/* Agent dot + name */}
                  <div className="flex items-center gap-2 w-20 shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: AGENT_COLORS[d.agent] || "#6366f1" }}
                    />
                    <span className="text-xs font-medium truncate capitalize">{d.agent}</span>
                  </div>

                  {/* Decision text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{d.decision}</p>
                  </div>

                  {/* Expand */}
                  {(d.reasoning || d.context) && (
                    <div className="shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={14} className="text-muted-foreground" />
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (d.reasoning || d.context) && (
                  <div className="px-4 pb-3 ml-[104px] space-y-2">
                    {d.reasoning && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                          Reasoning
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">{d.reasoning}</p>
                      </div>
                    )}
                    {d.context && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                          Context
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">{d.context}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}
