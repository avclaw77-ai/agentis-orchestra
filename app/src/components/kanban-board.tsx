"use client"

import { cn } from "@/lib/utils"
import { TASK_COLUMNS } from "@/lib/constants"
import { Lock, Plus, Circle } from "lucide-react"
import type { Task, Agent, TaskStatus } from "@/types"

// ---------------------------------------------------------------------------
// Priority dot colors
// ---------------------------------------------------------------------------
const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-500",
  high: "text-amber-500",
  medium: "text-blue-500",
  low: "text-gray-400",
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const PHASE_LABELS: Record<string, string> = {
  research: "Research",
  spec: "Spec",
  design: "Design",
  build: "Build",
  qa: "QA",
  deploy: "Deploy",
}

// ---------------------------------------------------------------------------
// Task card (inline)
// ---------------------------------------------------------------------------
function TaskCard({
  task,
  agents,
  onClick,
}: {
  task: Task
  agents: Agent[]
  onClick: () => void
}) {
  const agent = agents.find((a) => a.id === task.assignedTo)

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border border-border bg-card px-3 py-2",
        "hover:shadow-sm transition-shadow cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-primary/40"
      )}
    >
      <div className="flex items-start gap-2">
        <Circle
          size={7}
          className={cn("mt-1 shrink-0 fill-current", PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium)}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {agent && (
              <span className="text-[11px] text-muted-foreground truncate">
                {agent.displayName || agent.name}
              </span>
            )}
            {task.phase && (
              <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                {PHASE_LABELS[task.phase] || task.phase}
              </span>
            )}
            {task.executionLockedAt && (
              <Lock size={12} className="text-amber-500 shrink-0" />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Kanban column
// ---------------------------------------------------------------------------
function KanbanColumn({
  column,
  tasks,
  agents,
  departmentColors,
  isCeoView,
  onSelectTask,
}: {
  column: (typeof TASK_COLUMNS)[number]
  tasks: Task[]
  agents: Agent[]
  departmentColors: Record<string, string>
  isCeoView: boolean
  onSelectTask: (id: string) => void
}) {
  return (
    <div className="bg-secondary/30 rounded-xl border border-border min-h-[300px] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">
          {column.label}{" "}
          <span className="text-muted-foreground font-normal">({tasks.length})</span>
        </h3>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-260px)]">
        {tasks.length === 0 ? (
          <div
            className={cn(
              "border border-dashed border-border rounded-lg p-6",
              "flex items-center justify-center text-xs text-muted-foreground"
            )}
          >
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="relative">
              {isCeoView && task.departmentId && (
                <div
                  className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full z-10"
                  style={{
                    backgroundColor:
                      departmentColors[task.departmentId] || "#6b7280",
                  }}
                  title={task.departmentId}
                />
              )}
              <TaskCard
                task={task}
                agents={agents}
                onClick={() => onSelectTask(task.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KanbanBoard (main export)
// ---------------------------------------------------------------------------
interface KanbanBoardProps {
  tasks: Task[]
  agents: Agent[]
  departmentId: string | null
  departments?: { id: string; name: string; color: string }[]
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onSelectTask: (taskId: string) => void
  onCreateTask: () => void
}

export function KanbanBoard({
  tasks,
  agents,
  departmentId,
  departments = [],
  onStatusChange,
  onSelectTask,
  onCreateTask,
}: KanbanBoardProps) {
  const isCeoView = departmentId === null
  const departmentColors = Object.fromEntries(
    departments.map((d) => [d.id, d.color])
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Task Board</h2>
        <button
          onClick={onCreateTask}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          )}
        >
          <Plus size={16} />
          New Task
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {TASK_COLUMNS.map((col) => {
          const colTasks = tasks
            .filter((t) => t.status === col.key)
            .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
          return (
            <KanbanColumn
              key={col.key}
              column={col}
              tasks={colTasks}
              agents={agents}
              departmentColors={departmentColors}
              isCeoView={isCeoView}
              onSelectTask={onSelectTask}
            />
          )
        })}
      </div>
    </div>
  )
}
