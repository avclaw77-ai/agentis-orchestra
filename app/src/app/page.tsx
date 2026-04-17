"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Shell, type View } from "@/components/shell"
import { AgentRoster } from "@/components/agent-roster"
import { AgentProfile } from "@/components/agent-profile"
import { ChatPanel } from "@/components/chat-panel"
import { DashboardHome } from "@/components/dashboard-home"
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
import { DecisionLog } from "@/components/decision-log"
import { ActivityLog } from "@/components/activity-log"
import { TeamManager } from "@/components/team-manager"
import { ConnectorLibrary } from "@/components/connector-library"
import { FileBrowser } from "@/components/file-browser"
import { ModelSandbox } from "@/components/model-sandbox"
import { ProviderKeys } from "@/components/provider-keys"
import type {
  Agent,
  AgentConfig,
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

  // Agent profile state
  const [selectedAgentForProfile, setSelectedAgentForProfile] = useState<string | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)

  // User profile for multi-user
  const [userRole, setUserRole] = useState<"admin" | "member" | "viewer">("admin")
  const [userDepartmentIds, setUserDepartmentIds] = useState<string[]>([])
  const [userName, setUserName] = useState<string>("")

  // Settings sub-tab
  const [settingsTab, setSettingsTab] = useState<"general" | "team" | "connectors" | "approvals" | "skills" | "decisions" | "activity" | "export">("general")
  const [modelsTab, setModelsTab] = useState<"config" | "sandbox" | "keys">("config")

  // Company general form state
  const [companyName, setCompanyName] = useState("")
  const [companyMission, setCompanyMission] = useState("")
  const [companyLocale, setCompanyLocale] = useState("en")
  const [companySaving, setCompanySaving] = useState(false)
  const [companyLoaded, setCompanyLoaded] = useState(false)

  // Password change form state
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const [pwSaving, setPwSaving] = useState(false)

  // Pending approval count for nav badge
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  // Export template metadata
  const [exportTemplateName, setExportTemplateName] = useState("")
  const [exportTemplateDesc, setExportTemplateDesc] = useState("")
  const [exportIndustryTag, setExportIndustryTag] = useState("Technology")
  const [exportAuthor, setExportAuthor] = useState("AgentisLab")

  // Import preview state
  const [importPreview, setImportPreview] = useState<{
    templateName?: string
    templateDescription?: string
    author?: string
    industryTag?: string
    company?: { name: string }
    departments?: unknown[]
    skills?: unknown[]
    routines?: unknown[]
  } | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K -> focus chat (quick access)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setView("chat")
      }
      // Escape -> close panels
      if (e.key === "Escape") {
        if (selectedAgentForProfile) setSelectedAgentForProfile(null)
        else if (selectedTaskId) setSelectedTaskId(null)
        else if (showCreateTask) setShowCreateTask(false)
        else if (showRoutineBuilder) setShowRoutineBuilder(false)
      }
      // Cmd+1-9 for quick nav
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault()
        const views: View[] = ["dashboard", "chat", "tasks", "files", "goals", "routines", "approvals", "costs", "models"]
        const idx = parseInt(e.key) - 1
        if (idx < views.length) setView(views[idx])
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedAgentForProfile, selectedTaskId, showCreateTask, showRoutineBuilder])

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

      // Fetch user profile for multi-user context
      const profileRes = await fetch("/api/auth/me")
      if (profileRes.ok) {
        const profile = await profileRes.json()
        setUserRole(profile.role || "admin")
        setUserDepartmentIds(profile.departmentIds || [])
        setUserName(profile.name || "")
      }

      // Fetch pending approval count for nav badge
      try {
        const approvalsRes = await fetch("/api/approvals?status=pending")
        if (approvalsRes.ok) {
          const pendingApprovals: ApprovalRequest[] = await approvalsRes.json()
          setPendingApprovalCount(pendingApprovals.length)
        }
      } catch {
        // Approvals count will work once DB is ready
      }
    } catch {
      // Will work once DB is populated via setup wizard
    }
  }

  // Fetch company details for settings general tab
  const fetchCompany = useCallback(async () => {
    if (companyLoaded) return
    try {
      const res = await fetch("/api/company")
      if (res.ok) {
        const data = await res.json()
        setCompanyName(data.name || "")
        setCompanyMission(data.mission || "")
        setCompanyLocale(data.locale || "en")
        setExportTemplateName(data.name || "")
        setCompanyLoaded(true)
      }
    } catch {
      // Will work once company exists
    }
  }, [companyLoaded])

  useEffect(() => {
    if (view === "settings" && settingsTab === "general") {
      fetchCompany()
    }
  }, [view, settingsTab, fetchCompany])

  async function handleSaveCompany() {
    setCompanySaving(true)
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          mission: companyMission || null,
          locale: companyLocale,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Company settings saved")
      // Update local company info
      setCompanyInfo({ name: companyName, locale: companyLocale })
    } catch {
      toast.error("Failed to save company settings")
    } finally {
      setCompanySaving(false)
    }
  }

  async function handleChangePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("All password fields are required")
      return
    }
    if (pwNew.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (pwNew !== pwConfirm) {
      toast.error("New passwords do not match")
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to change password")
      }
      toast.success("Password changed")
      setPwCurrent("")
      setPwNew("")
      setPwConfirm("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setPwSaving(false)
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      const statusLabel = newStatus === "in-progress" ? "In Progress" : newStatus.charAt(0).toUpperCase() + newStatus.slice(1)
      toast.success(`Moved ${taskId} to ${statusLabel}`)
      await fetchTasks()
      // Refresh detail if open
      if (selectedTaskId === taskId) {
        const detailRes = await fetch(`/api/tasks/${taskId}`)
        if (detailRes.ok) {
          const data = await detailRes.json()
          const { comments, ...task } = data
          setSelectedTask(task)
          setTaskComments(comments || [])
        }
      }
    } catch {
      toast.error(`Failed to update ${taskId} status`)
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
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success("Task created")
      setShowCreateTask(false)
      await fetchTasks()
    } catch {
      toast.error("Failed to create task")
    }
  }

  async function handleAddComment(body: string) {
    if (!selectedTaskId) return
    try {
      const postRes = await fetch(`/api/tasks/${selectedTaskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, authorUserId: "admin" }),
      })
      if (!postRes.ok) throw new Error()
      toast.success("Comment added")
      // Refresh comments
      const res = await fetch(`/api/tasks/${selectedTaskId}`)
      if (res.ok) {
        const data = await res.json()
        const { comments, ...task } = data
        setSelectedTask(task)
        setTaskComments(comments || [])
      }
    } catch {
      toast.error("Failed to add comment")
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
    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success("Routine created")
      setShowRoutineBuilder(false)
      setEditingRoutine(null)
      await fetchRoutines()
    } catch {
      toast.error("Failed to create routine")
    }
  }

  async function handleRoutineStatusChange(id: string, status: string) {
    try {
      const res = await fetch("/api/routines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error()
      const label = status === "active" ? "activated" : status
      toast.success(`Routine ${label}`)
      await fetchRoutines()
    } catch {
      toast.error("Failed to update routine status")
    }
  }

  async function handleRoutineTrigger(id: string) {
    try {
      const res = await fetch(`/api/routines/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) throw new Error()
      toast.success("Routine triggered")
      await fetchRoutines()
    } catch {
      toast.error("Failed to trigger routine")
    }
  }

  async function handleRoutineDelete(id: string) {
    try {
      const res = await fetch(`/api/routines?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Routine deleted")
      await fetchRoutines()
    } catch {
      toast.error("Failed to delete routine")
    }
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
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success("Goal created")
      await fetchGoals()
    } catch {
      toast.error("Failed to create goal")
    }
  }

  async function handleUpdateGoal(
    id: string,
    data: { title?: string; description?: string; status?: string }
  ) {
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      })
      if (!res.ok) throw new Error()
      toast.success("Goal updated")
      await fetchGoals()
    } catch {
      toast.error("Failed to update goal")
    }
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
    if (view === "approvals" || (view === "settings" && settingsTab === "approvals")) {
      fetchApprovals()
    }
  }, [view, settingsTab, selectedDepartment, fetchApprovals])

  async function handleApprove(id: number, note: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "approved", decisionNote: note, decidedByUserId: "admin" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Approved")
      await fetchApprovals()
    } catch {
      toast.error("Failed to approve")
    }
  }

  async function handleReject(id: number, note: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected", decisionNote: note, decidedByUserId: "admin" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Rejected")
      await fetchApprovals()
    } catch {
      toast.error("Failed to reject")
    }
  }

  async function handleRequestRevision(id: number, note: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "revision_requested", decisionNote: note, decidedByUserId: "admin" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Revision requested")
      await fetchApprovals()
    } catch {
      toast.error("Failed to request revision")
    }
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
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success("Skill created")
      await fetchSkills()
    } catch {
      toast.error("Failed to create skill")
    }
  }

  async function handleUpdateSkill(
    id: number,
    data: { name?: string; description?: string; isActive?: boolean; definition?: Record<string, unknown> }
  ) {
    try {
      const res = await fetch("/api/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      })
      if (!res.ok) throw new Error()
      toast.success("Skill updated")
      await fetchSkills()
    } catch {
      toast.error("Failed to update skill")
    }
  }

  // -------------------------------------------------------------------------
  // Agent Profile
  // -------------------------------------------------------------------------

  // Fetch config when profile opens
  useEffect(() => {
    if (!selectedAgentForProfile) {
      setAgentConfig(null)
      return
    }
    async function loadConfig() {
      try {
        const res = await fetch(`/api/agents/${selectedAgentForProfile}/config`)
        if (res.ok) {
          const data = await res.json()
          setAgentConfig(data)
        }
      } catch {
        // Config will load once available
      }
    }
    loadConfig()
  }, [selectedAgentForProfile])

  async function handleSaveAgentConfig(config: Partial<AgentConfig>) {
    if (!selectedAgentForProfile) return
    try {
      const res = await fetch(`/api/agents/${selectedAgentForProfile}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        const updated = await res.json()
        setAgentConfig(updated)
        toast.success("Agent config saved")
      } else {
        toast.error("Failed to save agent config")
      }
    } catch {
      toast.error("Failed to save agent config")
    }
  }

  async function handleSaveHeartbeat(schedule: string, enabled: boolean) {
    if (!selectedAgentForProfile) return
    try {
      const res = await fetch(`/api/agents/${selectedAgentForProfile}/heartbeat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule, enabled }),
      })
      if (res.ok) {
        toast.success("Heartbeat config saved")
        // Refresh agents to pick up new schedule
        const agentRes = await fetch("/api/agents")
        if (agentRes.ok) {
          setAgents(await agentRes.json())
        }
      } else {
        toast.error("Failed to save heartbeat config")
      }
    } catch {
      toast.error("Failed to save heartbeat config")
    }
  }

  function handleOpenProfile(agentId: string) {
    setSelectedAgentForProfile(agentId)
  }

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

  async function handleExport() {
    try {
      const res = await fetch("/api/company/export")
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Add template metadata
      data.templateName = exportTemplateName || companyInfo.name
      data.templateDescription = exportTemplateDesc || ""
      data.author = exportAuthor || "AgentisLab"
      data.industryTag = exportIndustryTag || "Technology"
      data.agentCount = (data.departments || []).reduce((sum: number, d: { agents?: unknown[] }) => sum + (d.agents?.length || 0), 0)
      data.departmentCount = (data.departments || []).length
      data.createdAt = new Date().toISOString()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(exportTemplateName || companyInfo.name).toLowerCase().replace(/\s+/g, "-")}-template.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Company config exported")
    } catch {
      toast.error("Failed to export config")
    }
  }

  function handleImportPreview(file: File) {
    setImportFile(file)
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text)
        setImportPreview(parsed)
      } catch {
        toast.error("Invalid JSON file")
        setImportFile(null)
      }
    })
  }

  async function handleImportConfirm() {
    if (!importFile) return
    try {
      const text = await importFile.text()
      const template = JSON.parse(text)
      const res = await fetch("/api/company/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      })
      if (!res.ok) throw new Error()
      toast.success("Template imported")
      setImportPreview(null)
      setImportFile(null)
      await fetchData()
    } catch {
      toast.error("Import failed")
    }
  }

  const handleAgentsUpdate = useCallback((updated: Agent[]) => {
    setAgents(updated)
  }, [])

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
      userRole={userRole}
      userDepartmentIds={userDepartmentIds}
      userName={userName}
      pendingApprovalCount={pendingApprovalCount}
    >
      {view === "dashboard" && (
        <>
          <DashboardHome
            agents={visibleAgents}
            departments={departments}
            onSelectAgent={handleOpenProfile}
          />

          {/* Agent profile slide-over */}
          {selectedAgentForProfile && agents.find((a) => a.id === selectedAgentForProfile) && (
            <AgentProfile
              agent={agents.find((a) => a.id === selectedAgentForProfile)!}
              config={agentConfig}
              agents={agents}
              departments={departments}
              onClose={() => setSelectedAgentForProfile(null)}
              onSave={handleSaveAgentConfig}
              onSaveHeartbeat={handleSaveHeartbeat}
            />
          )}
        </>
      )}

      {view === "chat" && (
        <div className="flex flex-col md:flex-row h-full">
          <div className="md:w-64 md:border-r border-b md:border-b-0 border-border p-2 md:p-4 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2 md:gap-0 shrink-0">
            <AgentRoster
              agents={visibleAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              onAgentsUpdate={handleAgentsUpdate}
              compact
            />
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel
              channel={selectedAgent}
              agentName={agents.find((a) => a.id === selectedAgent)?.name || "Agent"}
              agentDisplayName={agents.find((a) => a.id === selectedAgent)?.displayName || undefined}
              departmentId={selectedDepartment}
              fullHeight
            />
          </div>
        </div>
      )}

      {view === "tasks" && (
        <div className="p-3 md:p-6">
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

      {view === "files" && (
        <FileBrowser agents={visibleAgents} />
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
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setModelsTab("config")}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                modelsTab === "config" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Configuration
            </button>
            <button
              onClick={() => setModelsTab("sandbox")}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                modelsTab === "sandbox" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Sandbox
            </button>
            <button
              onClick={() => setModelsTab("keys")}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                modelsTab === "keys" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              API Keys
            </button>
          </div>
          {modelsTab === "config" && <ModelConfig />}
          {modelsTab === "sandbox" && <ModelSandbox />}
          {modelsTab === "keys" && <ProviderKeys />}
        </div>
      )}

      {view === "approvals" && (
        <div className="p-6 max-w-4xl">
          <ApprovalFeed
            approvals={approvalsList}
            comments={approvalComments}
            onApprove={handleApprove}
            onReject={handleReject}
            onRequestRevision={handleRequestRevision}
            onComment={handleApprovalComment}
          />
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
          <div className="flex flex-wrap items-center gap-1 bg-secondary rounded-lg p-0.5 mb-6">
            {(
              [
                { key: "general", label: "General" },
                { key: "team", label: "Team" },
                { key: "connectors", label: "Connectors" },
                { key: "activity", label: "Activity" },
                { key: "decisions", label: "Decisions" },
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
            <>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-2xl">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Mission</label>
                <textarea
                  value={companyMission}
                  onChange={(e) => setCompanyMission(e.target.value)}
                  placeholder="Your company mission statement..."
                  rows={3}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Language</label>
                <select
                  value={companyLocale}
                  onChange={(e) => setCompanyLocale(e.target.value)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="en">English</option>
                  <option value="fr">Francais</option>
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveCompany}
                  disabled={companySaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {companySaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-2xl mt-6">
              <h3 className="text-sm font-semibold">Change Password</h3>
              <div>
                <label className="text-sm font-medium">Current Password</label>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                  autoComplete="new-password"
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className="text-sm font-medium">Confirm New Password</label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {pwSaving ? "Saving..." : "Change Password"}
                </button>
              </div>
            </div>
            </>
          )}

          {settingsTab === "team" && (
            <TeamManager departments={departments} />
          )}

          {settingsTab === "connectors" && (
            <ConnectorLibrary departments={departments} onConnectorCreated={() => fetchData()} />
          )}

          {settingsTab === "activity" && (
            <ActivityLog departmentId={selectedDepartment} />
          )}

          {settingsTab === "decisions" && (
            <DecisionLog
              departments={departments}
              selectedDepartment={selectedDepartment}
            />
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
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Template Name</label>
                    <input
                      type="text"
                      value={exportTemplateName}
                      onChange={(e) => setExportTemplateName(e.target.value)}
                      placeholder={companyInfo.name}
                      className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <input
                      type="text"
                      value={exportTemplateDesc}
                      onChange={(e) => setExportTemplateDesc(e.target.value)}
                      placeholder="One-line description of this template..."
                      className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Industry</label>
                      <select
                        value={exportIndustryTag}
                        onChange={(e) => setExportIndustryTag(e.target.value)}
                        className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                      >
                        {["Technology", "Manufacturing", "Insurance", "Finance", "Healthcare", "Retail", "Education", "Consulting", "Real Estate", "Logistics", "Other"].map((ind) => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Author</label>
                      <input
                        type="text"
                        value={exportAuthor}
                        onChange={(e) => setExportAuthor(e.target.value)}
                        placeholder="AgentisLab"
                        className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
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

                {importPreview ? (
                  <div className="space-y-4">
                    <div className="bg-inset rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">
                          {importPreview.templateName || importPreview.company?.name || "Unnamed Template"}
                        </h4>
                        {importPreview.industryTag && (
                          <span className="text-[10px] font-medium bg-secondary px-2 py-0.5 rounded-full">
                            {importPreview.industryTag}
                          </span>
                        )}
                      </div>
                      {importPreview.templateDescription && (
                        <p className="text-xs text-muted-foreground">{importPreview.templateDescription}</p>
                      )}
                      {importPreview.author && (
                        <p className="text-[10px] text-muted-foreground">By {importPreview.author}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span>{importPreview.departments?.length || 0} departments</span>
                        <span>
                          {(importPreview.departments as Array<{ agents?: unknown[] }>)?.reduce(
                            (sum: number, d: { agents?: unknown[] }) => sum + (d.agents?.length || 0), 0
                          ) || 0} agents
                        </span>
                        <span>{importPreview.routines?.length || 0} routines</span>
                        <span>{importPreview.skills?.length || 0} skills</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleImportConfirm}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Import
                      </button>
                      <button
                        onClick={() => { setImportPreview(null); setImportFile(null) }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors cursor-pointer">
                    Choose File
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImportPreview(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  )
}
