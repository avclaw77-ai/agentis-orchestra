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

export type TaskPhase = 'research' | 'spec' | 'design' | 'build' | 'qa' | 'deploy'

export interface Task {
  id: string
  departmentId: string | null
  title: string
  status: TaskStatus
  assignedTo: string | null
  project: string | null
  priority: string
  notes: string | null
  executionLockedAt: string | null
  checkoutRunId: string | null
  parentTaskId: string | null
  phase: string | null
  estimatedTokens: number | null
  actualTokens: number
  createdAt: string
  updatedAt: string
}

export interface TaskComment {
  id: number
  taskId: string
  departmentId: string | null
  authorAgentId: string | null
  authorUserId: string | null
  body: string
  runId: string | null
  createdAt: string
}

export interface Label {
  id: number
  departmentId: string | null
  name: string
  color: string
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
// Routines -- Named multi-step agent workflows
// =============================================================================

export interface Routine {
  id: string
  departmentId: string | null
  name: string
  description: string | null
  assigneeAgentId: string | null
  status: "draft" | "active" | "paused" | "archived"
  concurrencyPolicy: string
  catchUpPolicy: string
  maxDurationMs: number
  lastTriggeredAt: string | null
  createdAt: string
}

export interface RoutineTrigger {
  id: string
  routineId: string
  type: "cron" | "webhook" | "manual"
  cronExpression: string | null
  cronHumanLabel: string | null
  webhookPath: string | null
  webhookSecret: string | null
  isActive: boolean
}

export interface RoutineStep {
  id: string
  routineId: string
  stepOrder: number
  agentId: string
  promptTemplate: string
  modelOverride: string | null
  timeoutMs: number
  dependsOnStepId: string | null
}

export interface RoutineRun {
  id: string
  routineId: string
  triggerType: string
  status: string
  currentStep: number
  stepResults: Array<{
    stepId: string
    agentId: string
    status: string
    output: string
    tokens: number
    costCents: number
    durationMs: number
  }>
  totalTokens: number
  totalCostCents: number
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
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

// =============================================================================
// Cost Tracking & Budgets
// =============================================================================

export interface CostEvent {
  id: number
  departmentId: string | null
  agentId: string
  runId: string | null
  modelId: string
  provider: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  costCents: number
  taskId: string | null
  billingType: string
  createdAt: string
}

export interface BudgetPolicy {
  id?: number
  scopeType: "company" | "department" | "agent"
  scopeId: string | null
  amountCents: number
  warnPercent: number
  hardStopEnabled: boolean
  windowKind: string
  isActive: boolean
}

export interface BudgetIncident {
  id: number
  policyId: number
  scopeType: string
  scopeId: string | null
  thresholdType: "warn" | "hard_stop"
  amountLimit: number
  amountObserved: number
  status: "open" | "resolved" | "dismissed"
  createdAt: string
}

export interface CostSummary {
  totalCents: number
  cliCents: number
  apiCents: number
  cliSavings: number
  byAgent: Array<{ agentId: string; agentName: string; cents: number; runs: number }>
  byModel: Array<{ modelId: string; cents: number; tokens: number }>
  byDay: Array<{ date: string; cents: number }>
  byDepartment: Array<{ departmentId: string; name: string; cents: number }>
  tasksCompleted: number
  totalRuns: number
}
