"use client"

import { useState, useEffect, useCallback } from "react"
import { Shell, type View } from "@/components/shell"
import { AgentRoster } from "@/components/agent-roster"
import { ChatPanel } from "@/components/chat-panel"
import { KanbanBoard } from "@/components/kanban-board"
import { TaskDetail } from "@/components/task-detail"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { ModelConfig } from "@/components/model-config"
import { CostDashboard } from "@/components/cost-dashboard"
import { RoutineList } from "@/components/routine-list"
import { RoutineBuilder } from "@/components/routine-builder"
import type {
  Agent,
  Task,
  TaskComment,
  TaskStatus,
  Department,
  Routine,
  RoutineTrigger,
  RoutineStep,
} from "@/types"

interface CompanyInfo {
  name: string
  locale: string
}

export default function DashboardPage() {
  const [view, setView] = useState<View>("dashboard")
  const [selectedAgent, setSelectedAgent] = useState<string>("")
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: "AgentisOrchestra", locale: "en" })

  // Task state
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskComments, setTaskComments] = useState<TaskComment[]>([])
  const [showCreateTask, setShowCreateTask] = useState(false)

  // Routine state
  const [routinesList, setRoutinesList] = useState<(Routine & { triggers?: RoutineTrigger[]; stepCount?: number; runCount?: number })[]>([])
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<{
    routine: Routine
    triggers: RoutineTrigger[]
    steps: RoutineStep[]
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Fetch tasks when department changes or view switches to tasks
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDepartment) params.set("departmentId", selectedDepartment)
      const res = await fetch(`/api/tasks?${params}`)
      if (res.ok) {
        setTasks(await res.json())
      }
    } catch {
      // Tasks will load once DB is ready
    }
  }, [selectedDepartment])

  useEffect(() => {
    if (view === "tasks") {
      fetchTasks()
    }
  }, [view, selectedDepartment, fetchTasks])

  // Fetch single task detail + comments
  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null)
      setTaskComments([])
      return
    }
    async function loadDetail() {
      try {
        const res = await fetch(`/api/tasks/${selectedTaskId}`)
        if (res.ok) {
          const data = await res.json()
          const { comments, ...task } = data
          setSelectedTask(task)
          setTaskComments(comments || [])
        }
      } catch {
        // Will work once task exists
      }
    }
    loadDetail()
  }, [selectedTaskId])

  async function fetchData() {
    try {
      const setupRes = await fetch("/api/setup")
      if (setupRes.ok) {
        const data = await setupRes.json()
        if (data.company) setCompanyInfo(data.company)
      }

      const deptRes = await fetch("/api/departments")
      if (deptRes.ok) {
        const depts = await deptRes.json()
        setDepartments(depts)
      }

      const agentRes = await fetch("/api/agents")
      if (agentRes.ok) {
        const ags = await agentRes.json()
        setAgents(ags)
        const ceo = ags.find((a: Agent) => a.isCeo)
        if (ceo) setSelectedAgent(ceo.id)
        else if (ags.length > 0) setSelectedAgent(ags[0].id)
      }
    } catch {
      // Will work once DB is populated via setup wizard
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    })
    await fetchTasks()
    // Refresh detail if open
    if (selectedTaskId === taskId) {
      const res = await fetch(`/api/tasks/${taskId}`)
      if (res.ok) {
        const data = await res.json()
        const { comments, ...task } = data
        setSelectedTask(task)
        setTaskComments(comments || [])
      }
    }
  }

  async function handleCreateTask(payload: {
    title: string
    departmentId: string | null
    assignedTo: string | null
    priority: string
    phase: string | null
    notes: string
  }) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setShowCreateTask(false)
    await fetchTasks()
  }

  async function handleAddComment(body: string) {
    if (!selectedTaskId) return
    await fetch(`/api/tasks/${selectedTaskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, authorUserId: "admin" }),
    })
    // Refresh comments
    const res = await fetch(`/api/tasks/${selectedTaskId}`)
    if (res.ok) {
      const data = await res.json()
      const { comments, ...task } = data
      setSelectedTask(task)
      setTaskComments(comments || [])
    }
  }

  async function handleNotesChange(notes: string) {
    if (!selectedTaskId) return
    await fetch(`/api/tasks/${selectedTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    })
    await fetchTasks()
  }

  // -------------------------------------------------------------------------
  // Routines
  // -------------------------------------------------------------------------

  const fetchRoutines = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDepartment) params.set("departmentId", selectedDepartment)
      const res = await fetch(`/api/routines?${params}`)
      if (res.ok) {
        setRoutinesList(await res.json())
      }
    } catch {
      // Routines will load once DB is ready
    }
  }, [selectedDepartment])

  useEffect(() => {
    if (view === "routines") {
      fetchRoutines()
    }
  }, [view, selectedDepartment, fetchRoutines])

  async function handleCreateRoutine(data: {
    name: string
    description: string
    departmentId: string | null
    assigneeAgentId: string | null
    status: string
    concurrencyPolicy: string
    catchUpPolicy: string
    maxDurationMs: number
    triggers: unknown[]
    steps: unknown[]
  }) {
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setShowRoutineBuilder(false)
    setEditingRoutine(null)
    await fetchRoutines()
  }

  async function handleRoutineStatusChange(id: string, status: string) {
    await fetch("/api/routines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    await fetchRoutines()
  }

  async function handleRoutineTrigger(id: string) {
    await fetch(`/api/routines/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    await fetchRoutines()
  }

  async function handleRoutineDelete(id: string) {
    await fetch(`/api/routines?id=${id}`, { method: "DELETE" })
    await fetchRoutines()
  }

  async function handleRoutineSelect(id: string) {
    try {
      const res = await fetch(`/api/routines/${id}`)
      if (res.ok) {
        const data = await res.json()
        setEditingRoutine({
          routine: data,
          triggers: data.triggers || [],
          steps: data.steps || [],
        })
        setShowRoutineBuilder(true)
      }
    } catch {
      // will work once routine exists
    }
  }

  const visibleAgents = selectedDepartment
    ? agents.filter((a) => a.departmentId === selectedDepartment)
    : agents

  return (
    <Shell
      currentView={view}
      onViewChange={setView}
      companyName={companyInfo.name}
      departments={departments}
      selectedDepartment={selectedDepartment}
      onDepartmentChange={setSelectedDepartment}
    >
      {view === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          <div className="lg:col-span-1">
            <AgentRoster
              agents={visibleAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={(id) => {
                setSelectedAgent(id)
                setView("chat")
              }}
            />
          </div>
          <div className="lg:col-span-2">
            <ChatPanel
              channel={selectedAgent}
              agentName={agents.find((a) => a.id === selectedAgent)?.name || "Agent"}
            />
          </div>
        </div>
      )}

      {view === "chat" && (
        <div className="flex h-[calc(100vh-64px)]">
          <div className="w-64 border-r border-border p-4 overflow-y-auto">
            <AgentRoster
              agents={visibleAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              compact
            />
          </div>
          <div className="flex-1">
            <ChatPanel
              channel={selectedAgent}
              agentName={agents.find((a) => a.id === selectedAgent)?.name || "Agent"}
              fullHeight
            />
          </div>
        </div>
      )}

      {view === "tasks" && (
        <div className="p-6">
          <KanbanBoard
            tasks={tasks}
            agents={agents}
            departmentId={selectedDepartment}
            departments={departments}
            onStatusChange={handleStatusChange}
            onSelectTask={setSelectedTaskId}
            onCreateTask={() => setShowCreateTask(true)}
          />

          {/* Task detail slide-over */}
          {selectedTask && (
            <TaskDetail
              task={selectedTask}
              comments={taskComments}
              agents={agents}
              onClose={() => setSelectedTaskId(null)}
              onStatusChange={(status) =>
                handleStatusChange(selectedTask.id, status)
              }
              onAddComment={handleAddComment}
              onNotesChange={handleNotesChange}
            />
          )}

          {/* Create task dialog */}
          {showCreateTask && (
            <CreateTaskDialog
              agents={agents}
              departments={departments}
              currentDepartment={selectedDepartment}
              onClose={() => setShowCreateTask(false)}
              onCreate={handleCreateTask}
            />
          )}
        </div>
      )}

      {view === "routines" && (
        <div className="p-6 max-w-4xl">
          <RoutineList
            routines={routinesList}
            onSelect={handleRoutineSelect}
            onCreate={() => {
              setEditingRoutine(null)
              setShowRoutineBuilder(true)
            }}
            onTrigger={handleRoutineTrigger}
            onStatusChange={handleRoutineStatusChange}
            onDelete={handleRoutineDelete}
          />

          {showRoutineBuilder && (
            <RoutineBuilder
              agents={agents}
              departments={departments}
              routine={editingRoutine?.routine}
              triggers={editingRoutine?.triggers}
              steps={editingRoutine?.steps}
              onSave={handleCreateRoutine}
              onCancel={() => {
                setShowRoutineBuilder(false)
                setEditingRoutine(null)
              }}
            />
          )}
        </div>
      )}

      {view === "models" && (
        <div className="p-6 max-w-5xl">
          <ModelConfig />
        </div>
      )}

      {view === "costs" && (
        <div className="p-6 max-w-5xl">
          <CostDashboard />
        </div>
      )}

      {view === "settings" && (
        <div className="p-6 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Company Name</label>
              <input
                type="text"
                defaultValue={companyInfo.name}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Language</label>
              <select
                defaultValue={companyInfo.locale}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="en">English</option>
                <option value="fr">Francais</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
