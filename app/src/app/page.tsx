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
import { GoalTree } from "@/components/goal-tree"
import { ApprovalFeed } from "@/components/approval-feed"
import { SkillLibrary } from "@/components/skill-library"
import type {
  Agent,
  Task,
  TaskComment,
  TaskStatus,
  Department,
  Routine,
  RoutineTrigger,
  RoutineStep,
  Goal,
  ApprovalRequest,
  ApprovalComment,
  CompanySkill,
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

  // Goals state
  const [goalsList, setGoalsList] = useState<Goal[]>([])

  // Approvals state
  const [approvalsList, setApprovalsList] = useState<ApprovalRequest[]>([])
  const [approvalComments, setApprovalComments] = useState<Record<number, ApprovalComment[]>>({})

  // Skills state
  const [skillsList, setSkillsList] = useState<CompanySkill[]>([])

  // Settings sub-tab
  const [settingsTab, setSettingsTab] = useState<"general" | "approvals" | "skills" | "export">("general")

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

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  const fetchGoals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDepartment) params.set("departmentId", selectedDepartment)
      const res = await fetch(`/api/goals?${params}`)
      if (res.ok) {
        setGoalsList(await res.json())
      }
    } catch {
      // Goals will load once DB is ready
    }
  }, [selectedDepartment])

  useEffect(() => {
    if (view === "goals") {
      fetchGoals()
      fetchTasks() // need tasks for goal-tree linking
    }
  }, [view, selectedDepartment, fetchGoals, fetchTasks])

  async function handleCreateGoal(data: {
    title: string
    description: string
    departmentId: string | null
    parentId: string | null
  }) {
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    await fetchGoals()
  }

  async function handleUpdateGoal(
    id: string,
    data: { title?: string; description?: string; status?: string }
  ) {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    })
    await fetchGoals()
  }

  // -------------------------------------------------------------------------
  // Approvals
  // -------------------------------------------------------------------------

  const fetchApprovals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDepartment) params.set("departmentId", selectedDepartment)
      const res = await fetch(`/api/approvals?${params}`)
      if (res.ok) {
        const data: ApprovalRequest[] = await res.json()
        setApprovalsList(data)
        // Fetch comments for each approval
        const commentsMap: Record<number, ApprovalComment[]> = {}
        for (const a of data) {
          try {
            const cRes = await fetch(`/api/approvals/${a.id}/comments`)
            if (cRes.ok) {
              commentsMap[a.id] = await cRes.json()
            }
          } catch {
            commentsMap[a.id] = []
          }
        }
        setApprovalComments(commentsMap)
      }
    } catch {
      // Approvals will load once DB is ready
    }
  }, [selectedDepartment])

  useEffect(() => {
    if (view === "settings" && settingsTab === "approvals") {
      fetchApprovals()
    }
  }, [view, settingsTab, selectedDepartment, fetchApprovals])

  async function handleApprove(id: number, note: string) {
    await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "approved", decisionNote: note, decidedByUserId: "admin" }),
    })
    await fetchApprovals()
  }

  async function handleReject(id: number, note: string) {
    await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "rejected", decisionNote: note, decidedByUserId: "admin" }),
    })
    await fetchApprovals()
  }

  async function handleRequestRevision(id: number, note: string) {
    await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "revision_requested", decisionNote: note, decidedByUserId: "admin" }),
    })
    await fetchApprovals()
  }

  async function handleApprovalComment(id: number, body: string) {
    await fetch(`/api/approvals/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, authorUserId: "admin" }),
    })
    // Refresh comments for this approval
    try {
      const res = await fetch(`/api/approvals/${id}/comments`)
      if (res.ok) {
        const updatedComments = await res.json()
        setApprovalComments((prev) => ({ ...prev, [id]: updatedComments }))
      }
    } catch {
      // will work once comment exists
    }
  }

  // -------------------------------------------------------------------------
  // Skills
  // -------------------------------------------------------------------------

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills")
      if (res.ok) {
        setSkillsList(await res.json())
      }
    } catch {
      // Skills will load once DB is ready
    }
  }, [])

  useEffect(() => {
    if (view === "settings" && settingsTab === "skills") {
      fetchSkills()
    }
  }, [view, settingsTab, fetchSkills])

  async function handleCreateSkill(data: {
    key: string
    name: string
    description: string
    sourceType: string
    sourceRef: string
    definition: Record<string, unknown>
  }) {
    await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    await fetchSkills()
  }

  async function handleUpdateSkill(
    id: number,
    data: { name?: string; description?: string; isActive?: boolean; definition?: Record<string, unknown> }
  ) {
    await fetch("/api/skills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    })
    await fetchSkills()
  }

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

  async function handleExport() {
    try {
      const res = await fetch("/api/company/export")
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `company-template-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // Export failed
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      const template = JSON.parse(text)
      const res = await fetch("/api/company/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      })
      if (res.ok) {
        const result = await res.json()
        alert(`Import complete: ${JSON.stringify(result.summary, null, 2)}`)
        // Refresh data
        await fetchData()
      }
    } catch {
      alert("Import failed. Check the file format.")
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
        <div className="flex h-full">
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

      {view === "goals" && (
        <div className="p-6 max-w-4xl">
          <GoalTree
            goals={goalsList}
            tasks={tasks}
            departments={departments}
            onCreateGoal={handleCreateGoal}
            onUpdateGoal={handleUpdateGoal}
          />
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
        <div className="p-6 max-w-4xl">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>

          {/* Settings tabs */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 mb-6 w-fit">
            {(
              [
                { key: "general", label: "General" },
                { key: "approvals", label: "Approvals" },
                { key: "skills", label: "Skills" },
                { key: "export", label: "Export / Import" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSettingsTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  settingsTab === tab.key
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {settingsTab === "general" && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-2xl">
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
          )}

          {settingsTab === "approvals" && (
            <ApprovalFeed
              approvals={approvalsList}
              comments={approvalComments}
              onApprove={handleApprove}
              onReject={handleReject}
              onRequestRevision={handleRequestRevision}
              onComment={handleApprovalComment}
            />
          )}

          {settingsTab === "skills" && (
            <SkillLibrary
              skills={skillsList}
              onCreateSkill={handleCreateSkill}
              onUpdateSkill={handleUpdateSkill}
            />
          )}

          {settingsTab === "export" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-2">Export Company Template</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Download a JSON template of your company configuration including departments, agents, goals, skills, and routines.
                  Excludes user data, chat history, cost events, and secrets.
                </p>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Export Template
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-2">Import Company Template</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a JSON template to create departments, agents, goals, skills, and routines.
                  Items that already exist (by id/key) will be skipped.
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors cursor-pointer">
                  Choose File
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImport(file)
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  )
}
