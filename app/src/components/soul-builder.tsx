"use client"

import { useState } from "react"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Check,
  Plus,
  X as XIcon,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Agent, StructuredPersona } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TONE_PRESETS = ["Professional", "Casual", "Technical", "Friendly"] as const

const TOOL_OPTIONS = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Grep",
  "WebSearch",
  "WebFetch",
] as const

const STEPS = [
  {
    id: "role",
    question: "What does this agent do day-to-day?",
    placeholder: "Describe the agent's main responsibilities, typical tasks, and daily workflow...",
  },
  {
    id: "priorities",
    question: "What are its top priorities?",
    placeholder: "Add a priority and press Enter...",
  },
  {
    id: "guardrails",
    question: "What should it never do?",
    placeholder: "Add a guardrail and press Enter...",
  },
  {
    id: "tone",
    question: "How should it communicate?",
    placeholder: "Describe the communication style or pick a preset...",
  },
  {
    id: "tools",
    question: "What tools does it need?",
    placeholder: "",
  },
  {
    id: "hierarchy",
    question: "Who does it report to?",
    placeholder: "",
  },
  {
    id: "review",
    question: "Review & Save",
    placeholder: "",
  },
] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SoulBuilderProps {
  agentId: string
  agentName: string
  currentPersona?: string
  agents: Agent[]
  onClose: () => void
  onSave: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SoulBuilder({
  agentId,
  agentName,
  currentPersona,
  agents,
  onClose,
  onSave,
}: SoulBuilderProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form state
  const [role, setRole] = useState("")
  const [priorities, setPriorities] = useState<string[]>([])
  const [priorityInput, setPriorityInput] = useState("")
  const [guardrails, setGuardrails] = useState<string[]>([])
  const [guardrailInput, setGuardrailInput] = useState("")
  const [tone, setTone] = useState("")
  const [tools, setTools] = useState<string[]>([])
  const [reportsTo, setReportsTo] = useState("")

  const currentStep = STEPS[step]
  const isReview = step === STEPS.length - 1
  const isFirst = step === 0
  const isLast = isReview

  // Build the structured persona from current state
  function buildPersona(): StructuredPersona {
    return {
      role,
      priorities,
      guardrails,
      tone,
      tools,
      hierarchy: {
        reportsTo: reportsTo || undefined,
      },
    }
  }

  function handleAddPriority() {
    const val = priorityInput.trim()
    if (!val || priorities.includes(val)) return
    setPriorities((prev) => [...prev, val])
    setPriorityInput("")
  }

  function handleRemovePriority(idx: number) {
    setPriorities((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleAddGuardrail() {
    const val = guardrailInput.trim()
    if (!val || guardrails.includes(val)) return
    setGuardrails((prev) => [...prev, val])
    setGuardrailInput("")
  }

  function handleRemoveGuardrail(idx: number) {
    setGuardrails((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleTool(tool: string) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }

  function structuredToText(p: ReturnType<typeof buildPersona>): string {
    const lines: string[] = []
    lines.push(`## Role\n${p.role}`)
    if (p.priorities.length) lines.push(`\n## Priorities\n${p.priorities.map((pr) => `- ${pr}`).join("\n")}`)
    if (p.guardrails.length) lines.push(`\n## Guardrails\n${p.guardrails.map((g) => `- ${g}`).join("\n")}`)
    if (p.tone) lines.push(`\n## Tone\n${p.tone}`)
    if (p.tools.length) lines.push(`\n## Tools\n${p.tools.join(", ")}`)
    if (p.hierarchy.reportsTo) lines.push(`\n## Reports To\n${p.hierarchy.reportsTo}`)
    if (p.context) lines.push(`\n## Context\n${p.context}`)
    return lines.join("\n")
  }

  async function handleSave() {
    setSaving(true)
    try {
      const persona = buildPersona()
      const personaText = structuredToText(persona)
      const res = await fetch(`/api/agents/${agentId}/persona`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaText,
          structuredPersona: persona,
          changeSource: "soul_builder",
          changeSummary: `Soul Builder: configured role, ${priorities.length} priorities, ${guardrails.length} guardrails, ${tools.length} tools`,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to save persona")
        return
      }
      toast.success("Persona saved successfully")
      onSave()
    } catch {
      toast.error("Failed to save persona")
    } finally {
      setSaving(false)
    }
  }

  // Can advance to next step?
  function canProceed(): boolean {
    switch (step) {
      case 0: return role.trim().length > 0
      case 1: return priorities.length > 0
      case 2: return true // guardrails are optional but recommended
      case 3: return tone.trim().length > 0
      case 4: return true // tools optional
      case 5: return true // hierarchy optional
      default: return true
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[560px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h2 className="text-base font-semibold">Soul Builder</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Building persona for <span className="font-medium text-foreground">{agentName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mt-4">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { if (i <= step) setStep(i) }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === step
                    ? "w-6 bg-primary"
                    : i < step
                    ? "bg-primary/40 cursor-pointer"
                    : "bg-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-semibold mb-1">{currentStep.question}</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Step {step + 1} of {STEPS.length}
          </p>

          {/* Step 0: Role */}
          {step === 0 && (
            <textarea
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={currentStep.placeholder}
              rows={6}
              className="w-full bg-inset rounded-lg px-3 py-2.5 text-sm outline-none resize-y border border-border focus:border-primary transition-colors"
              autoFocus
            />
          )}

          {/* Step 1: Priorities */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {priorities.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg"
                  >
                    <span className="text-xs font-bold text-primary/50">{i + 1}.</span>
                    {p}
                    <button
                      onClick={() => handleRemovePriority(i)}
                      className="hover:text-red-500 transition-colors ml-0.5"
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={priorityInput}
                  onChange={(e) => setPriorityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddPriority()
                    }
                  }}
                  placeholder={currentStep.placeholder}
                  className="flex-1 bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary transition-colors"
                  autoFocus
                />
                <button
                  onClick={handleAddPriority}
                  disabled={!priorityInput.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    priorityInput.trim()
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-muted-foreground"
                  )}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Guardrails */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {guardrails.map((g, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-sm bg-red-50 text-red-700 px-3 py-1.5 rounded-lg"
                  >
                    {g}
                    <button
                      onClick={() => handleRemoveGuardrail(i)}
                      className="hover:text-red-500 transition-colors ml-0.5"
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={guardrailInput}
                  onChange={(e) => setGuardrailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddGuardrail()
                    }
                  }}
                  placeholder={currentStep.placeholder}
                  className="flex-1 bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary transition-colors"
                  autoFocus
                />
                <button
                  onClick={handleAddGuardrail}
                  disabled={!guardrailInput.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    guardrailInput.trim()
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "text-muted-foreground"
                  )}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Tone */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TONE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setTone(preset)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                      tone === preset
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Or type a custom communication style..."
                className="w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
            </div>
          )}

          {/* Step 4: Tools */}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-2">
              {TOOL_OPTIONS.map((tool) => (
                <label
                  key={tool}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border",
                    tools.includes(tool)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30 bg-inset"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={tools.includes(tool)}
                    onChange={() => toggleTool(tool)}
                    className="rounded border-border accent-primary"
                  />
                  <span className="text-sm font-medium">{tool}</span>
                </label>
              ))}
            </div>
          )}

          {/* Step 5: Hierarchy */}
          {step === 5 && (
            <select
              value={reportsTo}
              onChange={(e) => setReportsTo(e.target.value)}
              className="w-full bg-inset rounded-lg px-3 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors"
            >
              <option value="">None (autonomous)</option>
              {agents
                .filter((a) => a.id !== agentId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName || a.name} -- {a.role}
                  </option>
                ))}
            </select>
          )}

          {/* Step 6: Review */}
          {isReview && (
            <div className="space-y-4">
              <ReviewSection label="Role" value={role} />
              <ReviewSection
                label="Priorities"
                value={
                  priorities.length > 0
                    ? priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")
                    : "None set"
                }
              />
              <ReviewSection
                label="Guardrails"
                value={
                  guardrails.length > 0
                    ? guardrails.map((g) => `- ${g}`).join("\n")
                    : "None set"
                }
              />
              <ReviewSection label="Tone" value={tone || "Not set"} />
              <ReviewSection
                label="Tools"
                value={tools.length > 0 ? tools.join(", ") : "None selected"}
              />
              <ReviewSection
                label="Reports To"
                value={
                  reportsTo
                    ? agents.find((a) => a.id === reportsTo)?.name || reportsTo
                    : "None (autonomous)"
                }
              />
            </div>
          )}
        </div>

        {/* Footer: Back / Next / Save */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isFirst
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <ChevronLeft size={14} />
            Back
          </button>

          {isReview ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                saving && "opacity-50 cursor-not-allowed"
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save Persona
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canProceed()}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                canProceed()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Next
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Review section helper
// ---------------------------------------------------------------------------

function ReviewSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-inset rounded-lg px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  )
}
