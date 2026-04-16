"use client"

import { useState } from "react"
import { Building2, Globe, Sparkles, Loader2, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface CompanyData {
  name: string
  mission: string
  website: string
  industry: string
  description: string
}

interface ProposedAgent {
  id: string
  name: string
  role: string
  persona: string
  model: string
  suggestedSchedule: string | null
  suggestedScheduleLabel: string | null
}

interface ProposedDepartment {
  id: string
  name: string
  description: string
  color: string
  agents: ProposedAgent[]
}

interface ProposedRoutine {
  name: string
  description: string
  steps: Array<{ agentId: string; prompt: string }>
  schedule: string | null
}

export interface CompanyProposal {
  summary: string
  departments: ProposedDepartment[]
  suggestedRoutines: ProposedRoutine[]
}

interface CompanyStepProps {
  data: CompanyData
  onChange: (d: CompanyData) => void
  onProposalReceived?: (proposal: CompanyProposal) => void
  proposal?: CompanyProposal | null
}

const INDUSTRIES = [
  "Technology",
  "Manufacturing",
  "Insurance",
  "Banking & Finance",
  "Retail & E-commerce",
  "Logistics & Supply Chain",
  "Healthcare",
  "Construction",
  "Professional Services",
  "Education",
  "Real Estate",
  "Food & Beverage",
  "Other",
]

type AnalysisState = "idle" | "researching" | "generating" | "done" | "error"

export function CompanyStep({ data, onChange, onProposalReceived, proposal }: CompanyStepProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>(proposal ? "done" : "idle")
  const [analysisMessage, setAnalysisMessage] = useState("")
  const [error, setError] = useState("")

  function update(field: keyof CompanyData, value: string) {
    onChange({ ...data, [field]: value })
    // Reset analysis if company info changes after proposal
    if (proposal && analysisState === "done") {
      setAnalysisState("idle")
    }
  }

  async function handleAnalyze() {
    if (!data.name.trim()) return

    setAnalysisState("researching")
    setAnalysisMessage(`Researching ${data.name}...`)
    setError("")

    try {
      const res = await fetch("/api/setup/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.name,
          website: data.website,
          industry: data.industry,
          description: data.description || data.mission,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error("Analysis failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("event: progress")) continue
          if (line.startsWith("event: proposal")) continue
          if (line.startsWith("event: error")) continue

          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6))

              // Progress events
              if (parsed.step === "research" || parsed.step === "research_done" || parsed.step === "research_skip" || parsed.step === "research_fallback") {
                setAnalysisState("researching")
                setAnalysisMessage(parsed.message)
              }
              if (parsed.step === "generating") {
                setAnalysisState("generating")
                setAnalysisMessage(parsed.message)
              }
              if (parsed.step === "complete") {
                setAnalysisState("done")
                setAnalysisMessage("Proposal ready")
              }

              // Proposal result
              if (parsed.summary && parsed.departments) {
                onProposalReceived?.(parsed as CompanyProposal)
                setAnalysisState("done")
              }

              // Error
              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Analysis failed") {
                // JSON parse error, skip
              }
            }
          }
        }
      }
    } catch (err) {
      setAnalysisState("error")
      setError(err instanceof Error ? err.message : "Analysis failed")
    }
  }

  const canAnalyze = data.name.trim().length > 0 && analysisState !== "researching" && analysisState !== "generating"

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5">
          Step 3 of 7
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
          About your organization
        </h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Tell us about your company and we'll propose an AI agent team tailored to your business.
        </p>
      </div>

      {/* Company name */}
      <div className="mb-4">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Company name
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Acme Manufacturing"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Website */}
      <div className="mb-4">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Website
          <span className="font-normal text-muted-foreground ml-1.5">(helps us research your business)</span>
        </label>
        <div className="relative">
          <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="url"
            value={data.website}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://yourcompany.com"
            className="w-full pl-9 pr-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Industry */}
      <div className="mb-4">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Industry
        </label>
        <select
          value={data.industry}
          onChange={(e) => update("industry", e.target.value)}
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10"
        >
          <option value="">Select industry...</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>

      {/* Description / Mission */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          What does your company do?
          <span className="font-normal text-muted-foreground ml-1.5">(1-2 sentences)</span>
        </label>
        <textarea
          value={data.description || data.mission}
          onChange={(e) => {
            update("description", e.target.value)
            update("mission", e.target.value)
          }}
          rows={2}
          placeholder="We manufacture precision CNC parts for the aerospace industry..."
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50 resize-y min-h-[60px]"
        />
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all",
          canAnalyze
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {analysisState === "idle" && (
          <>
            <Sparkles size={16} />
            Analyze & Propose Agent Team
          </>
        )}
        {(analysisState === "researching" || analysisState === "generating") && (
          <>
            <Loader2 size={16} className="animate-spin" />
            {analysisMessage}
          </>
        )}
        {analysisState === "done" && (
          <>
            <Check size={16} />
            Proposal Ready -- Continue to Review
          </>
        )}
        {analysisState === "error" && (
          <>
            <AlertCircle size={16} />
            Try Again
          </>
        )}
      </button>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      {/* Proposal preview */}
      {proposal && analysisState === "done" && (
        <div className="mt-5 p-4 bg-muted/50 rounded-xl border border-border">
          <p className="text-sm text-foreground mb-3">{proposal.summary}</p>
          <div className="space-y-2">
            {proposal.departments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: dept.color }}
                />
                <span className="text-sm font-medium">{dept.name}</span>
                <span className="text-xs text-muted-foreground">
                  {dept.agents.length} agent{dept.agents.length !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
          {proposal.suggestedRoutines.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              + {proposal.suggestedRoutines.length} suggested routine{proposal.suggestedRoutines.length !== 1 ? "s" : ""}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            You can customize everything in the next steps.
          </p>
        </div>
      )}

      {/* Skip option */}
      {analysisState === "idle" && (
        <p className="text-center text-xs text-muted-foreground mt-3">
          Or skip analysis and configure manually with templates
        </p>
      )}
    </div>
  )
}
