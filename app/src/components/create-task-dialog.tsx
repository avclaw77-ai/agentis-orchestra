"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import type { Agent, Department, TaskPhase } from "@/types"

const PRIORITIES = ["low", "medium", "high", "critical"] as const
const PHASES: { value: TaskPhase; label: string }[] = [
  { value: "research", label: "Research" },
  { value: "spec", label: "Spec" },
  { value: "design", label: "Design" },
  { value: "build", label: "Build" },
  { value: "qa", label: "QA" },
  { value: "deploy", label: "Deploy" },
]

interface CreateTaskPayload {
  title: string
  departmentId: string | null
  assignedTo: string | null
  priority: string
  phase: string | null
  dueDate: string | null
  dependencies: string[] | null
  notes: string
}

interface CreateTaskDialogProps {
  agents: Agent[]
  departments: Department[]
  currentDepartment: string | null
  onClose: () => void
  onCreate: (task: CreateTaskPayload) => void
}

export function CreateTaskDialog({
  agents,
  departments,
  currentDepartment,
  onClose,
  onCreate,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [departmentId, setDepartmentId] = useState<string | null>(
    currentDepartment
  )
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [priority, setPriority] = useState("medium")
  const [phase, setPhase] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState("")
  const [dependenciesText, setDependenciesText] = useState("")
  const [notes, setNotes] = useState("")

  const filteredAgents = departmentId
    ? agents.filter((a) => a.departmentId === departmentId)
    : agents

  const selectedAgent = agents.find((a) => a.id === assignedTo)

  function handleCreate() {
    if (!title.trim()) return
    const deps = dependenciesText.trim()
      ? dependenciesText.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : null
    onCreate({
      title: title.trim(),
      departmentId,
      assignedTo,
      priority,
      phase,
      dueDate: dueDate || null,
      dependencies: deps,
      notes,
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold">New Task</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
              />
            </div>

            {/* Department */}
            <div>
              <label className="text-sm font-medium">Department</label>
              <select
                value={departmentId || ""}
                onChange={(e) => {
                  const val = e.target.value || null
                  setDepartmentId(val)
                  setAssignedTo(null) // reset agent when dept changes
                }}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
              >
                <option value="">Company-wide (CEO)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assign to */}
            <div>
              <label className="text-sm font-medium">Assign to</label>
              <select
                value={assignedTo || ""}
                onChange={(e) => setAssignedTo(e.target.value || null)}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
              >
                <option value="">Unassigned</option>
                {filteredAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} -- {a.role}
                  </option>
                ))}
              </select>
              {selectedAgent?.heartbeatEnabled && selectedAgent.heartbeatSchedule && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Agent will pick this up on next heartbeat ({selectedAgent.heartbeatSchedule})
                </p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm font-medium">Priority</label>
              <div className="flex gap-2 mt-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                      priority === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase */}
            <div>
              <label className="text-sm font-medium">Phase</label>
              <select
                value={phase || ""}
                onChange={(e) => setPhase(e.target.value || null)}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
              >
                <option value="">None</option>
                {PHASES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
              />
            </div>

            {/* Dependencies */}
            <div>
              <label className="text-sm font-medium">Dependencies</label>
              <input
                type="text"
                value={dependenciesText}
                onChange={(e) => setDependenciesText(e.target.value)}
                placeholder="TASK-001, TASK-002"
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Comma-separated task IDs this task is blocked by
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional context..."
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                title.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-muted-foreground cursor-not-allowed"
              )}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
