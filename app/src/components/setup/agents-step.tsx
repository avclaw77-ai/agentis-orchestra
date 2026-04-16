"use client"

import { useState } from "react"
import { X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AgentSetup {
  id: string
  name: string
  role: string
  model: string
}

export interface ModelOption {
  id: string
  name: string
  costTier: string
}

interface AgentsStepProps {
  departmentName: string
  departmentColor?: string
  agents: AgentSetup[]
  modelOptions: ModelOption[]
  onAdd: (agent: AgentSetup) => void
  onRemove: (index: number) => void
  onChange: (index: number, agent: AgentSetup) => void
}

const COST_BADGE_STYLES: Record<string, string> = {
  FREE: "bg-emerald-50 text-emerald-600",
  $: "bg-sky-50 text-sky-600",
  $$: "bg-amber-50 text-amber-600",
  $$$: "bg-red-50 text-red-500",
}

export function AgentsStep({
  departmentName,
  departmentColor = "#3b82f6",
  agents,
  modelOptions,
  onAdd,
  onRemove,
  onChange,
}: AgentsStepProps) {
  const [newName, setNewName] = useState("")

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    onAdd({
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      role: "Custom",
      model: modelOptions[0]?.id ?? "claude-cli:sonnet",
    })
    setNewName("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5">
          Step 6 of 7
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
          Add agents to{" "}
          <span style={{ color: departmentColor }}>{departmentName}</span>
        </h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Each agent has a role and a preferred model. You can always change
          these later.
        </p>
      </div>

      {/* Agent list */}
      <div className="flex flex-col gap-2 mb-4">
        {agents.map((agent, i) => {
          const selectedModel = modelOptions.find((m) => m.id === agent.model)
          return (
            <div
              key={agent.id}
              className="flex items-center gap-2.5 px-3.5 py-2.5 bg-muted rounded-lg animate-in fade-in duration-200"
            >
              {/* Color dot */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: departmentColor }}
              />

              {/* Name */}
              <input
                type="text"
                value={agent.name}
                onChange={(e) =>
                  onChange(i, { ...agent, name: e.target.value })
                }
                className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
                placeholder="Agent name"
              />

              {/* Role */}
              <input
                type="text"
                value={agent.role}
                onChange={(e) =>
                  onChange(i, { ...agent, role: e.target.value })
                }
                className="flex-1 min-w-0 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                placeholder="Role"
              />

              {/* Model dropdown */}
              <div className="relative flex items-center">
                <select
                  value={agent.model}
                  onChange={(e) =>
                    onChange(i, { ...agent, model: e.target.value })
                  }
                  className="appearance-none pl-2 pr-6 py-1 border-[1.5px] border-border rounded-md font-sans text-xs bg-white text-foreground outline-none max-w-[160px] cursor-pointer"
                >
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {selectedModel && (
                  <span
                    className={cn(
                      "absolute right-7 text-[10px] font-bold px-1 py-0.5 rounded pointer-events-none",
                      COST_BADGE_STYLES[selectedModel.costTier] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {selectedModel.costTier}
                  </span>
                )}
              </div>

              {/* Remove */}
              <button
                onClick={() => onRemove(i)}
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                title="Remove agent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add agent row */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Agent name..."
          className="flex-1 px-3 py-2 border-[1.5px] border-dashed border-border rounded-lg font-sans text-[13px] outline-none transition-all focus:border-primary focus:border-solid placeholder:text-muted-foreground/50"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg border-[1.5px] text-[13px] font-semibold transition-all",
            newName.trim()
              ? "border-border text-foreground hover:border-primary hover:text-primary"
              : "border-border text-muted-foreground opacity-50 cursor-not-allowed"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
    </div>
  )
}
