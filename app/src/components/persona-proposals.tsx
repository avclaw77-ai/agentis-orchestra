"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Sparkles,
  FileText,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { PersonaProposal } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_BADGES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  refinement: { label: "Refinement", className: "bg-sky-50 text-sky-600", icon: Sparkles },
  addition: { label: "Addition", className: "bg-emerald-50 text-emerald-600", icon: FileText },
  removal: { label: "Removal", className: "bg-red-50 text-red-600", icon: XCircle },
  guardrail: { label: "Guardrail", className: "bg-amber-50 text-amber-600", icon: Shield },
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-600",
  medium: "bg-amber-50 text-amber-600",
  low: "bg-red-50 text-red-500",
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonaProposalsProps {
  agentId: string
  agentName: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonaProposals({ agentId, agentName }: PersonaProposalsProps) {
  const [proposals, setProposals] = useState<PersonaProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<number | null>(null)

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/proposals?status=pending`)
      if (res.ok) {
        const data = await res.json()
        setProposals(Array.isArray(data) ? data : data.proposals || [])
      }
    } catch {
      // Will show empty state
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  async function handleAction(proposalId: number, status: "approved" | "rejected" | "deferred") {
    setActioning(proposalId)
    try {
      const res = await fetch(`/api/agents/${agentId}/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setProposals((prev) => prev.filter((p) => p.id !== proposalId))
        toast.success(`Proposal ${status}`)
      } else {
        toast.error("Failed to update proposal")
      }
    } catch {
      toast.error("Failed to update proposal")
    } finally {
      setActioning(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
        <p className="text-sm text-muted-foreground">No pending proposals for {agentName}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Pending Proposals
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({proposals.length})
          </span>
        </h3>
      </div>

      {proposals.map((proposal) => {
        const typeBadge = TYPE_BADGES[proposal.proposalType] || TYPE_BADGES.refinement
        const TypeIcon = typeBadge.icon
        const isActioning = actioning === proposal.id

        return (
          <div
            key={proposal.id}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border bg-inset">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                  typeBadge.className
                )}
              >
                <TypeIcon size={10} />
                {typeBadge.label}
              </span>
              {proposal.section && (
                <span className="text-xs text-muted-foreground font-mono">
                  {proposal.section}
                </span>
              )}
              <span
                className={cn(
                  "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                  CONFIDENCE_STYLES[proposal.confidence] || CONFIDENCE_STYLES.medium
                )}
              >
                {proposal.confidence}
              </span>
            </div>

            {/* Diff view */}
            <div className="px-4 py-3 space-y-2">
              {proposal.currentValue && (
                <div className="rounded-lg bg-red-50/50 border border-red-100 px-3 py-2">
                  <p className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-1">
                    Current
                  </p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">
                    {proposal.currentValue}
                  </p>
                </div>
              )}
              <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider mb-1">
                  Proposed
                </p>
                <p className="text-sm text-emerald-700 whitespace-pre-wrap">
                  {proposal.proposedValue}
                </p>
              </div>
            </div>

            {/* Reasoning */}
            <div className="px-4 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground">{proposal.reasoning}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/70">
                <span>{proposal.evidenceCount} evidence point{proposal.evidenceCount !== 1 ? "s" : ""}</span>
                <span>{proposal.source}</span>
                <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 border-t border-border bg-inset flex items-center gap-2 justify-end">
              <button
                onClick={() => handleAction(proposal.id, "deferred")}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                <Clock size={12} />
                Defer
              </button>
              <button
                onClick={() => handleAction(proposal.id, "rejected")}
                disabled={isActioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle size={12} />
                Reject
              </button>
              <button
                onClick={() => handleAction(proposal.id, "approved")}
                disabled={isActioning}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  "bg-emerald-500 text-white hover:bg-emerald-600",
                  isActioning && "opacity-50 cursor-not-allowed"
                )}
              >
                {isActioning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                Approve
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
