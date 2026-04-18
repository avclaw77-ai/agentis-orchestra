"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Webhook,
  Hand,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react"
import {
  SCHEDULE_PRESETS,
  cronToHuman,
  getNextRuns,
  isValidCron,
} from "@/lib/cron-helpers"
import type {
  Agent,
  Department,
  Routine,
  RoutineTrigger,
  RoutineStep,
} from "@/types"

// =============================================================================
// Types
// =============================================================================

interface StepDraft {
  agentId: string
  promptTemplate: string
  modelOverride: string | null
  timeoutMs: number
  dependsOnStepId: string | null
}

interface TriggerDraft {
  type: "cron" | "webhook" | "manual"
  cronExpression: string
  cronHumanLabel: string
  webhookPath: string
  webhookSecret: string
}

interface RoutineBuilderProps {
  agents: Agent[]
  departments: Department[]
  routine?: Routine
  triggers?: RoutineTrigger[]
  steps?: RoutineStep[]
  onSave: (data: {
    name: string
    description: string
    departmentId: string | null
    assigneeAgentId: string | null
    status: string
    concurrencyPolicy: string
    catchUpPolicy: string
    maxDurationMs: number
    triggers: TriggerDraft[]
    steps: StepDraft[]
  }) => void
  onCancel: () => void
}

// =============================================================================
// Constants
// =============================================================================

const CONCURRENCY_OPTIONS = [
  { value: "skip", label: "Skip if running", description: "Don't start a new run if one is active" },
  { value: "queue", label: "Queue", description: "Queue new runs behind the active one" },
  { value: "replace", label: "Replace", description: "Cancel active run and start fresh" },
]

const TIMEOUT_OPTIONS = [
  { value: 60000, label: "1 minute" },
  { value: 300000, label: "5 minutes" },
  { value: 600000, label: "10 minutes" },
  { value: 1800000, label: "30 minutes" },
  { value: 3600000, label: "1 hour" },
]

const STEP_TIMEOUT_OPTIONS = [
  { value: 60000, label: "1 min" },
  { value: 120000, label: "2 min" },
  { value: 300000, label: "5 min" },
  { value: 600000, label: "10 min" },
]

// =============================================================================
// Component
// =============================================================================

export function RoutineBuilder({
  agents,
  departments,
  routine,
  triggers: existingTriggers,
  steps: existingSteps,
  onSave,
  onCancel,
}: RoutineBuilderProps) {
  const [name, setName] = useState(routine?.name || "")
  const [description, setDescription] = useState(routine?.description || "")
  const [departmentId, setDepartmentId] = useState<string | null>(
    routine?.departmentId || null
  )
  const [assigneeAgentId, setAssigneeAgentId] = useState<string | null>(
    routine?.assigneeAgentId || null
  )
  const [concurrencyPolicy, setConcurrencyPolicy] = useState(
    routine?.concurrencyPolicy || "skip"
  )
  const [maxDurationMs, setMaxDurationMs] = useState(
    routine?.maxDurationMs || 600000
  )
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Trigger state
  const initTrigger = existingTriggers?.[0]
  const [triggerType, setTriggerType] = useState<"manual" | "cron" | "webhook">(
    (initTrigger?.type as "manual" | "cron" | "webhook") || "manual"
  )
  const [cronExpression, setCronExpression] = useState(
    initTrigger?.cronExpression || "0 9 * * 1-5"
  )
  const [cronPreset, setCronPreset] = useState("")
  const [webhookPath, setWebhookPath] = useState(
    initTrigger?.webhookPath?.replace("/hooks/", "") || ""
  )

  // Steps state
  const [steps, setSteps] = useState<StepDraft[]>(
    existingSteps?.map((s) => ({
      agentId: s.agentId,
      promptTemplate: s.promptTemplate,
      modelOverride: s.modelOverride,
      timeoutMs: s.timeoutMs,
      dependsOnStepId: s.dependsOnStepId,
    })) || [
      {
        agentId: agents[0]?.id || "",
        promptTemplate: "",
        modelOverride: null,
        timeoutMs: 300000,
        dependsOnStepId: null,
      },
    ]
  )

  // Helpers
  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return "Company-wide"
    return departments.find((d) => d.id === deptId)?.name || deptId
  }

  const getAgentLabel = (agent: Agent) => {
    const dept = departments.find((d) => d.id === agent.departmentId)
    return `${agent.displayName || agent.name} (${dept?.name || "CEO"})`
  }

  const addStep = () => {
    setSteps([
      ...steps,
      {
        agentId: agents[0]?.id || "",
        promptTemplate: "",
        modelOverride: null,
        timeoutMs: 300000,
        dependsOnStepId: null,
      },
    ])
  }

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx))
  }

  const updateStep = (idx: number, updates: Partial<StepDraft>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...updates } : s)))
  }

  const moveStep = (idx: number, dir: "up" | "down") => {
    const target = dir === "up" ? idx - 1 : idx + 1
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setSteps(next)
  }

  const handleSave = (saveStatus: string) => {
    const triggers: TriggerDraft[] = []

    if (triggerType === "cron") {
      triggers.push({
        type: "cron",
        cronExpression,
        cronHumanLabel: cronToHuman(cronExpression),
        webhookPath: "",
        webhookSecret: "",
      })
    } else if (triggerType === "webhook") {
      triggers.push({
        type: "webhook",
        cronExpression: "",
        cronHumanLabel: "",
        webhookPath: `/hooks/${webhookPath}`,
        webhookSecret: "",
      })
    } else {
      triggers.push({
        type: "manual",
        cronExpression: "",
        cronHumanLabel: "",
        webhookPath: "",
        webhookSecret: "",
      })
    }

    onSave({
      name,
      description,
      departmentId,
      assigneeAgentId,
      status: saveStatus,
      concurrencyPolicy,
      catchUpPolicy: "skip",
      maxDurationMs,
      triggers,
      steps,
    })
  }

  const cronValid = triggerType !== "cron" || isValidCron(cronExpression)
  const canSave = name.trim() && steps.length > 0 && steps.every((s) => s.agentId && s.promptTemplate.trim()) && cronValid

  // Next runs preview
  const nextRuns = triggerType === "cron" && cronValid ? getNextRuns(cronExpression, 3) : []

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onCancel} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mb-12">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold">
              {routine ? "Edit Routine" : "Create Routine"}
            </h2>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Name & Description */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Daily Research Roundup"
                  autoFocus
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this routine do?"
                  rows={2}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <select
                  value={departmentId || ""}
                  onChange={(e) => setDepartmentId(e.target.value || null)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
                >
                  <option value="">Company-wide</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trigger */}
            <div>
              <label className="text-sm font-medium mb-2 block">Trigger</label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(["manual", "cron", "webhook"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTriggerType(t)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border",
                        triggerType === t
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      {t === "manual" && <Hand size={14} />}
                      {t === "cron" && <Clock size={14} />}
                      {t === "webhook" && <Webhook size={14} />}
                      <span className="capitalize">{t === "cron" ? "Schedule" : t}</span>
                    </button>
                  ))}
                </div>

                {triggerType === "cron" && (
                  <div className="pl-1 space-y-2">
                    <select
                      value={cronPreset}
                      onChange={(e) => {
                        const preset = SCHEDULE_PRESETS.find(
                          (p) => p.cron === e.target.value
                        )
                        if (preset) {
                          setCronExpression(preset.cron)
                          setCronPreset(preset.cron)
                        }
                      }}
                      className="w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
                    >
                      <option value="">Custom schedule...</option>
                      {SCHEDULE_PRESETS.map((p) => (
                        <option key={p.cron} value={p.cron}>
                          {p.label} -- {p.description}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10 shrink-0">
                        Cron:
                      </span>
                      <input
                        type="text"
                        value={cronExpression}
                        onChange={(e) => {
                          setCronExpression(e.target.value)
                          setCronPreset("")
                        }}
                        placeholder="0 9 * * 1-5"
                        className={cn(
                          "flex-1 bg-inset rounded-lg px-3 py-1.5 text-sm font-mono outline-none border",
                          cronValid ? "border-border" : "border-red-400"
                        )}
                      />
                    </div>
                    {cronValid && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{cronToHuman(cronExpression)}</span>
                        {nextRuns.length > 0 && (
                          <span className="ml-2">
                            Next:{" "}
                            {nextRuns.map((d, i) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                {d.toLocaleString(undefined, {
                                  weekday: "short",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {!cronValid && (
                      <p className="text-xs text-red-500">
                        Invalid cron expression. Use 5 fields: minute hour day month weekday
                      </p>
                    )}
                  </div>
                )}

                {triggerType === "webhook" && (
                  <div className="pl-1 space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">/hooks/</span>
                      <input
                        type="text"
                        value={webhookPath}
                        onChange={(e) =>
                          setWebhookPath(
                            e.target.value.replace(/[^a-zA-Z0-9-_]/g, "")
                          )
                        }
                        placeholder="daily-report"
                        className="flex-1 bg-inset rounded-lg px-3 py-1.5 text-sm outline-none border border-border"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      POST to this URL to trigger the routine. Body is passed as trigger payload.
                    </p>
                  </div>
                )}

                {triggerType === "manual" && (
                  <p className="text-xs text-muted-foreground pl-1">
                    This routine can only be triggered manually from the dashboard.
                  </p>
                )}
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Steps</label>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info size={12} />
                  <span>
                    Use {"{{prev_output}}"} and {"{{trigger_payload}}"} in prompts
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const agent = agents.find((a) => a.id === step.agentId)
                  return (
                    <div
                      key={idx}
                      className="border border-border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                            {idx + 1}
                          </span>
                          <select
                            value={step.agentId}
                            onChange={(e) =>
                              updateStep(idx, { agentId: e.target.value })
                            }
                            className="bg-inset rounded-lg px-3 py-1.5 text-sm outline-none border border-border"
                          >
                            <option value="">Select agent...</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {getAgentLabel(a)}
                              </option>
                            ))}
                          </select>
                          {agent && (
                            <span className="text-xs text-muted-foreground">
                              {agent.role}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveStep(idx, "up")}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-secondary transition-colors disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => moveStep(idx, "down")}
                            disabled={idx === steps.length - 1}
                            className="p-1 rounded hover:bg-secondary transition-colors disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                          {steps.length > 1 && (
                            <button
                              onClick={() => removeStep(idx)}
                              className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        value={step.promptTemplate}
                        onChange={(e) =>
                          updateStep(idx, { promptTemplate: e.target.value })
                        }
                        placeholder={
                          idx === 0
                            ? "What should this agent do?"
                            : "Use {{prev_output}} to reference the previous step's output"
                        }
                        rows={3}
                        className="w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border resize-none"
                      />

                      {/* Step options row */}
                      <div className="flex items-center gap-3 text-xs">
                        <select
                          value={step.timeoutMs}
                          onChange={(e) =>
                            updateStep(idx, {
                              timeoutMs: parseInt(e.target.value),
                            })
                          }
                          className="bg-inset rounded px-2 py-1 outline-none border border-border text-xs"
                        >
                          {STEP_TIMEOUT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              Timeout: {o.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={step.modelOverride || ""}
                          onChange={(e) =>
                            updateStep(idx, {
                              modelOverride: e.target.value || null,
                            })
                          }
                          className="bg-inset rounded px-2 py-1 outline-none border border-border text-xs"
                        >
                          <option value="">Model: Auto</option>
                          <option value="claude-sonnet-4-6">Claude Sonnet</option>
                          <option value="claude-opus-4-6">Claude Opus</option>
                          <option value="gpt-4.1">GPT-4o</option>
                          <option value="perplexity-sonar-pro">Perplexity Sonar Pro</option>
                        </select>

                        {idx > 0 && (
                          <label className="flex items-center gap-1 text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={!!step.dependsOnStepId}
                              onChange={(e) =>
                                updateStep(idx, {
                                  dependsOnStepId: e.target.checked
                                    ? `step-${idx - 1}`
                                    : null,
                                })
                              }
                              className="rounded"
                            />
                            Depends on step {idx}
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={addStep}
                className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border w-full justify-center"
              >
                <Plus size={14} />
                Add Step
              </button>
            </div>

            {/* Advanced */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAdvanced ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                Advanced
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pl-1">
                  <div>
                    <label className="text-sm font-medium">Concurrency</label>
                    <select
                      value={concurrencyPolicy}
                      onChange={(e) => setConcurrencyPolicy(e.target.value)}
                      className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
                    >
                      {CONCURRENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label} -- {o.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Max Duration (routine timeout)
                    </label>
                    <select
                      value={maxDurationMs}
                      onChange={(e) =>
                        setMaxDurationMs(parseInt(e.target.value))
                      }
                      className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
                    >
                      {TIMEOUT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave("draft")}
              disabled={!canSave}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                canSave
                  ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSave("active")}
              disabled={!canSave}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                canSave
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              Save & Activate
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
