"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react"

interface OnboardingStep {
  id: string
  label: string
  description: string
  check: () => Promise<boolean>
}

interface OnboardingChecklistProps {
  agentCount: number
  departmentCount: number
  onNavigate: (view: string) => void
  onDismiss: () => void
}

export function OnboardingChecklist({
  agentCount,
  departmentCount,
  onNavigate,
  onDismiss,
}: OnboardingChecklistProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({})
  const [dismissed, setDismissed] = useState(false)

  const steps: { id: string; label: string; description: string; done: boolean; action?: string }[] = [
    {
      id: "department",
      label: "Create a department",
      description: "Departments organize your agents by function (Engineering, Sales, Research...)",
      done: departmentCount > 0,
      action: "settings",
    },
    {
      id: "agents",
      label: "Add agents to your team",
      description: "Each agent gets a persona, model, and schedule. Start with 2-3 agents.",
      done: agentCount > 1, // CEO is auto-created, so >1 means user added agents
      action: "settings",
    },
    {
      id: "chat",
      label: "Chat with an agent",
      description: "Send your first message. The agent uses its persona and tools to respond.",
      done: checkedSteps.chat || false,
      action: "chat",
    },
    {
      id: "task",
      label: "Create a task",
      description: "Tasks are the work units. Assign to an agent with priority and due date.",
      done: checkedSteps.task || false,
      action: "tasks",
    },
    {
      id: "heartbeat",
      label: "Enable a heartbeat",
      description: "Agents can wake on schedule and work autonomously. Try 'Every hour' to start.",
      done: checkedSteps.heartbeat || false,
    },
  ]

  // Check dynamic steps on mount
  useEffect(() => {
    async function checkSteps() {
      const checks: Record<string, boolean> = {}
      try {
        const chatRes = await fetch("/api/chat/messages?channel=ceo&limit=1")
        if (chatRes.ok) {
          const data = await chatRes.json()
          checks.chat = (data.messages?.length || 0) > 0
        }
      } catch { /* */ }
      try {
        const taskRes = await fetch("/api/tasks?limit=1")
        if (taskRes.ok) {
          const tasks = await taskRes.json()
          checks.task = tasks.length > 0
        }
      } catch { /* */ }
      try {
        const agentRes = await fetch("/api/agents")
        if (agentRes.ok) {
          const agents = await agentRes.json()
          checks.heartbeat = agents.some((a: { heartbeatEnabled: boolean }) => a.heartbeatEnabled)
        }
      } catch { /* */ }
      setCheckedSteps(checks)
    }
    checkSteps()
  }, [])

  // Check if dismissed in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem("ao_onboarding_dismissed") === "1")
    }
  }, [])

  const completedCount = steps.filter((s) => s.done).length
  const allDone = completedCount === steps.length

  if (dismissed || allDone) return null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Get started</h3>
            <p className="text-[11px] text-muted-foreground">
              {completedCount} of {steps.length} completed
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed(true)
            localStorage.setItem("ao_onboarding_dismissed", "1")
            onDismiss()
          }}
          className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-border">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => step.action && onNavigate(step.action)}
            disabled={!step.action}
            className={cn(
              "w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors",
              step.action && !step.done && "hover:bg-surface-hover cursor-pointer",
              step.done && "opacity-60"
            )}
          >
            {step.done ? (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Circle size={18} className="text-muted-foreground/40 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={cn("text-sm font-medium", step.done && "line-through")}>{step.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
