// =============================================================================
// AgentisOrchestra constants
// =============================================================================

export const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:3847"
export const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || ""
export const AUTH_TOKEN = process.env.AUTH_TOKEN || ""

export const AGENT_COLORS: Record<string, string> = {
  cio: "var(--primary)",
  dev: "#3b82f6",
  uiux: "#8b5cf6",
  qa: "#10b981",
  rnd: "#f59e0b",
  ops: "#6366f1",
  maxx: "#ec4899",
}

export const STATUS_COLORS: Record<string, string> = {
  idle: "var(--status-idle)",
  active: "var(--status-active)",
  thinking: "var(--status-thinking)",
  error: "var(--status-error)",
}

export const TASK_COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "in-progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const

// i18n labels -- Phase 1 scaffold
export const LABELS = {
  en: {
    agents: "Agents",
    tasks: "Tasks",
    chat: "Chat",
    workflows: "Workflows",
    settings: "Settings",
    workspace: "Workspace",
    newAgent: "New Agent",
    newTask: "New Task",
    send: "Send",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    status: "Status",
    idle: "Idle",
    active: "Active",
    thinking: "Thinking",
  },
  fr: {
    agents: "Agents",
    tasks: "Taches",
    chat: "Chat",
    workflows: "Workflows",
    settings: "Parametres",
    workspace: "Espace de travail",
    newAgent: "Nouvel agent",
    newTask: "Nouvelle tache",
    send: "Envoyer",
    cancel: "Annuler",
    save: "Sauvegarder",
    delete: "Supprimer",
    status: "Statut",
    idle: "Inactif",
    active: "Actif",
    thinking: "En reflexion",
  },
} as const

export type LabelKey = keyof (typeof LABELS)["en"]
