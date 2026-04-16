"use client"

import { cn } from "@/lib/utils"
import type { DepartmentTemplate } from "@/lib/templates"

interface DepartmentData {
  id: string
  name: string
  description: string
  color: string
  template: string | null
}

interface DepartmentStepProps {
  department: DepartmentData
  templates: DepartmentTemplate[]
  onChange: (d: DepartmentData) => void
}

const TEMPLATE_META: Record<
  string,
  { key: string; agentCount: number }
> = {
  Engineering: { key: "engineering", agentCount: 3 },
  Research: { key: "research", agentCount: 1 },
  Design: { key: "design", agentCount: 1 },
  Operations: { key: "operations", agentCount: 1 },
  Sales: { key: "sales", agentCount: 1 },
  Support: { key: "support", agentCount: 1 },
}

const PRESET_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#6366f1",
]

export function DepartmentStep({
  department,
  templates,
  onChange,
}: DepartmentStepProps) {
  function selectTemplate(tpl: DepartmentTemplate) {
    onChange({
      ...department,
      name: tpl.name,
      description: tpl.description,
      color: tpl.color,
      template: tpl.name.toLowerCase(),
    })
  }

  function update(field: keyof DepartmentData, value: string | null) {
    onChange({ ...department, [field]: value })
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5">
          Step 5 of 7
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
          Create your first department
        </h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Departments group agents by function. Pick a template or define your
          own.
        </p>
      </div>

      {/* Template grid -- 2x3 */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {templates.map((tpl) => {
          const meta = TEMPLATE_META[tpl.name]
          const isSelected =
            department.template === (meta?.key ?? tpl.name.toLowerCase())

          return (
            <button
              key={tpl.name}
              onClick={() => selectTemplate(tpl)}
              className={cn(
                "p-3.5 border-[1.5px] rounded-xl cursor-pointer text-center transition-all",
                isSelected
                  ? "border-primary bg-sky-50/60 ring-[3px] ring-primary/10"
                  : "border-border hover:border-slate-300 hover:-translate-y-px hover:shadow-sm"
              )}
            >
              <div
                className="w-8 h-8 rounded-lg mx-auto mb-2"
                style={{ background: tpl.color }}
              />
              <div className="text-[13px] font-bold mb-0.5">{tpl.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {tpl.agents.length} agent{tpl.agents.length !== 1 ? "s" : ""}
              </div>
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3.5 my-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="flex-1 h-px bg-border" />
        or create custom
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Custom form */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Department name
        </label>
        <input
          type="text"
          value={department.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Product"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Description
        </label>
        <input
          type="text"
          value={department.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What does this department do?"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="mb-2">
        <label className="block text-[13px] font-semibold text-foreground mb-2">
          Color
        </label>
        <div className="flex gap-2 items-center">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => update("color", c)}
              className={cn(
                "w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                department.color === c
                  ? "border-foreground ring-2 ring-white ring-offset-2 ring-offset-foreground"
                  : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
