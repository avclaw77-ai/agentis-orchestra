// =============================================================================
// Core domain types for AgentisOrchestra
// =============================================================================

export type AgentStatus = "idle" | "active" | "thinking"
export type TaskStatus = "backlog" | "in-progress" | "review" | "done"
export type AdapterType = "sdk" | "cli" | "api" | "http"
export type TrustLevel = "standard" | "elevated" | "restricted"
export type Locale = "en" | "fr"
export type Provider = "claude-cli" | "openrouter" | "perplexity" | "openai"

// =============================================================================
// Company & Departments (replaces Workspace)
// =============================================================================

export interface Company {
  id: string
  name: string
  mission: string | null
  locale: Locale
  settings: Record<string, unknown>
  setupCompletedAt: string | null
}

export interface Department {
  id: string
  name: string
  description: string | null
  color: string
  template: string | null
}

export interface ProviderKey {
  id: number
  provider: Provider
  apiKeyEncrypted: string
  isValid: boolean
  testedAt: string | null
}

// =============================================================================
// Setup wizard types
// =============================================================================

export type SetupStep =
  | "welcome"
  | "company"
  | "providers"
  | "department"
  | "agents"
  | "more-departments"
  | "ready"

export interface SetupDepartmentPayload {
  id: string
  name: string
  description: string
  color: string
  template: string | null
  agents: SetupAgentPayload[]
}

export interface SetupAgentPayload {
  id: string
  name: string
  role: string
  model: string
}

export interface SetupProviderPayload {
  provider: Provider
  apiKey: string
}

export interface SetupPayload {
  company: {
    name: string
    mission?: string
    locale: Locale
  }
  departments: SetupDepartmentPayload[]
  providers: SetupProviderPayload[]
}

export interface SetupResult {
  success: boolean
  company: string
  departmentCount: number
  agentCount: number
  providerCount: number
}

export interface DepartmentTemplate {
  name: string
  description: string
  color: string
  agents: {
    id: string
    name: string
    role: string
    model: string
  }[]
}

// =============================================================================
// Agents
// =============================================================================

export interface Agent {
  id: string
  departmentId: string | null
  name: string
  role: string
  status: AgentStatus
  isCeo: boolean
  currentTask: string | null
  lastActive: string | null
  heartbeatSchedule: string | null
  heartbeatEnabled: boolean
}

export interface AgentConfig {
  id: string
  agentId: string
  departmentId: string | null
  persona: string | null
  model: string
  adapterType: AdapterType
  adapterConfig: Record<string, unknown>
  guardrails: string | null
  dataSources: string[]
  reportsTo: string | null
  budget: number | null
  isActive: boolean
}

export interface Skill {
  key: string
  name: string
  description: string | null
  category: string | null
  trustLevel: TrustLevel
  isActive: boolean
}

// =============================================================================
// Tasks
// =============================================================================

export interface Task {
  id: string
  departmentId: string | null
  title: string
  status: TaskStatus
  assignedTo: string | null
  project: string | null
  priority: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

// =============================================================================
// Chat
// =============================================================================

export interface ChatMessage {
  id: number
  departmentId: string | null
  channel: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

// =============================================================================
// Decisions & Activity
// =============================================================================

export interface Decision {
  id: number
  departmentId: string | null
  decision: string
  agent: string
  reasoning: string | null
  context: string | null
  createdAt: string
}

// =============================================================================
// Workflows
// =============================================================================

export interface Workflow {
  id: string
  departmentId: string | null
  name: string
  description: string | null
  steps: WorkflowStep[]
  trigger: WorkflowTrigger
  isActive: boolean
}

export interface WorkflowStep {
  agentId: string
  prompt: string
  dependsOn?: string[] // step IDs
}

export interface WorkflowTrigger {
  type: "manual" | "cron" | "webhook"
  cron?: string // "0 8 * * *"
  webhookPath?: string // "/hooks/my-trigger"
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: "running" | "completed" | "failed" | "cancelled"
  tokensUsed: number
  costCents: number
  startedAt: string
  completedAt: string | null
}

// =============================================================================
// SSE event types (bridge -> app)
// =============================================================================

export interface SSETokenEvent {
  token: string
}

export interface SSEToolUseEvent {
  tool: string
  input: unknown
}

export interface SSEDoneEvent {
  result: string
}

export interface SSEErrorEvent {
  error: string
}

// =============================================================================
// Heartbeat & Runtime
// =============================================================================

export interface HeartbeatRun {
  id: string
  departmentId: string | null
  agentId: string
  wakeupSource: "cron" | "webhook" | "manual" | "chat" | "assignment"
  status: "queued" | "claimed" | "executing" | "succeeded" | "failed" | "cancelled" | "timed_out"
  contextSnapshot: Record<string, unknown>
  prompt: string | null
  modelId: string | null
  inputTokens: number
  outputTokens: number
  costCents: number
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

export interface AgentRuntimeState {
  agentId: string
  sessionId: string | null
  totalInputTokens: number
  totalOutputTokens: number
  totalCostCents: number
  lastRunId: string | null
  lastRunStatus: string | null
  lastError: string | null
}

export interface SchedulePreset {
  label: string
  cron: string
  description: string
}
