/**
 * Workshop Import -- bridges AgentisLab consulting methodology with Orchestra setup.
 *
 * The AgentisLab methodology has 4 phases:
 *   1. EXTRACT -- Deep dive into operations, process mapping, bottleneck identification
 *   2. ARCHITECT -- Agent architecture design, skills, data flows, governance rules
 *   3. BUILD & SHIP -- Continuous delivery, team embedding, production deployment
 *   4. EVOLVE -- Ongoing evolution as the organization grows
 *
 * Each phase produces workshop outputs that can be dropped into Orchestra
 * to bootstrap departments, agents, routines, and goals.
 *
 * This file defines the import format and templates for each workshop phase.
 */

// =============================================================================
// Workshop output schemas
// =============================================================================

/** Phase 1: Extract -- operations audit output */
export interface ExtractOutput {
  phase: "extract"
  companyName: string
  industry: string
  date: string
  processes: Array<{
    name: string
    department: string
    description: string
    painPoints: string[]
    automationPotential: "high" | "medium" | "low"
    currentTools: string[]
  }>
  bottlenecks: Array<{
    area: string
    description: string
    impact: "critical" | "high" | "medium" | "low"
    suggestedAgent: string | null
  }>
  dataReadiness: {
    score: number // 1-5
    gaps: string[]
    strengths: string[]
  }
}

/** Phase 2: Architect -- agent team design output */
export interface ArchitectOutput {
  phase: "architect"
  companyName: string
  date: string
  departments: Array<{
    id: string
    name: string
    description: string
    color: string
    agents: Array<{
      id: string
      name: string
      role: string
      persona: string
      model: string
      skills: string[]
      dataSources: string[]
      heartbeatSchedule: string | null
      heartbeatLabel: string | null
      guardrails: string[]
    }>
    goals: Array<{
      title: string
      description: string
    }>
  }>
  routines: Array<{
    name: string
    description: string
    trigger: { type: "cron" | "webhook" | "manual"; expression?: string }
    steps: Array<{
      agentId: string
      prompt: string
      model?: string
    }>
  }>
  companyMission: string
  governanceRules: string[]
}

/** Phase 3: Build & Ship -- deployment configuration */
export interface BuildShipOutput {
  phase: "build-ship"
  companyName: string
  date: string
  deploymentTarget: "vps" | "local" | "cloud"
  providerConfig: {
    claudeCli: boolean
    openrouterKey?: string
    perplexityKey?: string
    openaiKey?: string
  }
  budgets: {
    company: number // monthly cents
    departments: Record<string, number>
    agents: Record<string, number>
  }
}

/** Combined workshop output -- can contain any combination of phases */
export interface WorkshopBundle {
  version: 1
  agentislab: true // identifies this as an AgentisLab workshop output
  phases: Array<ExtractOutput | ArchitectOutput | BuildShipOutput>
}

// =============================================================================
// Phase templates -- what the consultant fills in during workshops
// =============================================================================

export const WORKSHOP_TEMPLATES = {
  extract: {
    phase: "extract" as const,
    title: "Phase 1: Extract",
    subtitle: "Operations audit and process mapping",
    description: "Upload the output from your AgentisLab Extract workshop. This maps your business processes and identifies automation opportunities.",
    icon: "Search",
    fields: [
      { key: "processes", label: "Business Processes", hint: "List of processes with pain points and automation potential" },
      { key: "bottlenecks", label: "Bottlenecks", hint: "Key operational bottlenecks with suggested agent solutions" },
      { key: "dataReadiness", label: "Data Readiness", hint: "Assessment of data quality and accessibility" },
    ],
    produces: "Identifies which departments need AI agents and what problems they should solve.",
  },
  architect: {
    phase: "architect" as const,
    title: "Phase 2: Architect",
    subtitle: "Agent team design and architecture",
    description: "Upload the output from your AgentisLab Architect workshop. This pre-fills your departments, agents, personas, routines, and goals.",
    icon: "Boxes",
    fields: [
      { key: "departments", label: "Department Design", hint: "Departments with agents, skills, and data sources" },
      { key: "routines", label: "Routine Design", hint: "Automated workflows with triggers and agent chains" },
      { key: "goals", label: "Goal Hierarchy", hint: "Company mission and department-level goals" },
    ],
    produces: "Pre-fills the entire Orchestra setup: departments, agents, routines, goals, and governance.",
  },
  "build-ship": {
    phase: "build-ship" as const,
    title: "Phase 3: Build & Ship",
    subtitle: "Deployment configuration and budgets",
    description: "Upload the output from your AgentisLab Build & Ship phase. This configures deployment settings and budget limits.",
    icon: "Rocket",
    fields: [
      { key: "deploymentTarget", label: "Deployment Target", hint: "Where Orchestra will run (VPS, local, cloud)" },
      { key: "providerConfig", label: "AI Providers", hint: "Which providers and API keys to configure" },
      { key: "budgets", label: "Budget Allocation", hint: "Monthly budgets per company, department, and agent" },
    ],
    produces: "Configures deployment settings, provider connections, and budget limits.",
  },
}

// =============================================================================
// Conversion: Workshop output -> Orchestra setup payload
// =============================================================================

export function workshopToSetupPayload(bundle: WorkshopBundle): {
  company: { name: string; mission: string; locale: string }
  departments: Array<{
    id: string
    name: string
    description: string
    color: string
    template: string | null
    agents: Array<{
      id: string
      name: string
      role: string
      model: string
      persona?: string
      heartbeatSchedule?: string | null
      guardrails?: string[]
    }>
  }>
  goals: Array<{ title: string; description: string; departmentId: string | null }>
  routines: Array<{
    name: string
    description: string
    steps: Array<{ agentId: string; prompt: string; model?: string }>
    trigger: { type: string; expression?: string }
  }>
} {
  let companyName = ""
  let mission = ""
  const departments: ReturnType<typeof workshopToSetupPayload>["departments"] = []
  const goals: ReturnType<typeof workshopToSetupPayload>["goals"] = []
  const routines: ReturnType<typeof workshopToSetupPayload>["routines"] = []

  for (const phase of bundle.phases) {
    if (phase.phase === "extract") {
      companyName = phase.companyName
      // Extract phase identifies departments from process areas
      const deptSet = new Set(phase.processes.map((p) => p.department))
      for (const deptName of deptSet) {
        if (!departments.find((d) => d.name === deptName)) {
          const id = deptName.toLowerCase().replace(/[^a-z0-9]/g, "-")
          departments.push({
            id,
            name: deptName,
            description: `Identified from ${phase.processes.filter((p) => p.department === deptName).length} mapped processes`,
            color: "#3b82f6",
            template: null,
            agents: [],
          })
        }
      }
      // Bottlenecks with suggested agents become agent stubs
      for (const bottleneck of phase.bottlenecks) {
        if (bottleneck.suggestedAgent) {
          const dept = departments.find(
            (d) => d.name.toLowerCase() === bottleneck.area.toLowerCase()
          )
          if (dept) {
            dept.agents.push({
              id: bottleneck.suggestedAgent.toLowerCase().replace(/[^a-z0-9]/g, "-"),
              name: bottleneck.suggestedAgent,
              role: `Address: ${bottleneck.description}`,
              model: "claude-cli:sonnet",
            })
          }
        }
      }
    }

    if (phase.phase === "architect") {
      companyName = phase.companyName
      mission = phase.companyMission

      // Architect phase provides the full team design
      for (const dept of phase.departments) {
        // Replace or merge with extract-identified departments
        const existingIdx = departments.findIndex((d) => d.id === dept.id)
        const deptEntry = {
          id: dept.id,
          name: dept.name,
          description: dept.description,
          color: dept.color,
          template: null,
          agents: dept.agents.map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            model: a.model,
            persona: a.persona,
            heartbeatSchedule: a.heartbeatSchedule,
            guardrails: a.guardrails,
          })),
        }
        if (existingIdx >= 0) {
          departments[existingIdx] = deptEntry
        } else {
          departments.push(deptEntry)
        }

        // Department goals
        for (const goal of dept.goals) {
          goals.push({ title: goal.title, description: goal.description, departmentId: dept.id })
        }
      }

      // Company mission as root goal
      if (mission) {
        goals.unshift({ title: mission, description: "Company mission", departmentId: null })
      }

      // Routines
      for (const r of phase.routines) {
        routines.push({
          name: r.name,
          description: r.description,
          steps: r.steps.map((s) => ({
            agentId: s.agentId,
            prompt: s.prompt,
            model: s.model,
          })),
          trigger: r.trigger,
        })
      }
    }
  }

  return {
    company: { name: companyName, mission, locale: "en" },
    departments,
    goals,
    routines,
  }
}

// =============================================================================
// Validation
// =============================================================================

export function validateWorkshopBundle(data: unknown): {
  valid: boolean
  error?: string
  bundle?: WorkshopBundle
} {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid format. Expected a JSON object." }
  }

  const obj = data as Record<string, unknown>

  if (obj.version !== 1) {
    return { valid: false, error: "Unsupported version. Expected version: 1." }
  }

  if (obj.agentislab !== true) {
    return { valid: false, error: "Not an AgentisLab workshop output. Missing agentislab: true flag." }
  }

  if (!Array.isArray(obj.phases) || obj.phases.length === 0) {
    return { valid: false, error: "No phases found. At least one workshop phase is required." }
  }

  for (const phase of obj.phases) {
    if (!phase || typeof phase !== "object" || !("phase" in phase)) {
      return { valid: false, error: "Invalid phase format. Each phase must have a 'phase' field." }
    }
    const p = phase as { phase: string }
    if (!["extract", "architect", "build-ship"].includes(p.phase)) {
      return { valid: false, error: `Unknown phase: "${p.phase}". Expected: extract, architect, or build-ship.` }
    }
  }

  return { valid: true, bundle: obj as unknown as WorkshopBundle }
}

// =============================================================================
// Sample workshop output (for documentation / testing)
// =============================================================================

export const SAMPLE_WORKSHOP_BUNDLE: WorkshopBundle = {
  version: 1,
  agentislab: true,
  phases: [
    {
      phase: "architect",
      companyName: "Acme Manufacturing",
      date: "2026-04-15",
      companyMission: "Deliver precision CNC parts with zero defects and best-in-class lead times",
      departments: [
        {
          id: "operations",
          name: "Operations",
          description: "Production planning, scheduling, and monitoring",
          color: "#ec4899",
          agents: [
            {
              id: "scheduler",
              name: "Scheduler",
              role: "Production planning and capacity optimization",
              persona: "You are the production scheduler at Acme Manufacturing. You optimize production schedules for CNC machines, balance workload across shifts, and flag capacity conflicts before they cause delays. You speak in concrete numbers -- hours, units, machine utilization percentages.",
              model: "claude-cli:sonnet",
              skills: ["schedule-optimization", "capacity-planning"],
              dataSources: ["erp-production-orders", "machine-availability"],
              heartbeatSchedule: "0 6 * * 1-5",
              heartbeatLabel: "Every weekday at 6am",
              guardrails: [
                "Never schedule overtime without flagging it for approval",
                "Always maintain 10% capacity buffer for rush orders",
              ],
            },
            {
              id: "monitor",
              name: "Monitor",
              role: "Real-time production KPI tracking and anomaly detection",
              persona: "You are the production monitor at Acme Manufacturing. You track machine uptime, cycle times, scrap rates, and OEE. When something deviates from normal, you flag it immediately. You are concise -- status reports, not essays.",
              model: "claude-cli:haiku",
              skills: ["kpi-tracking", "anomaly-detection"],
              dataSources: ["machine-sensors", "quality-database"],
              heartbeatSchedule: "*/15 * * * *",
              heartbeatLabel: "Every 15 minutes",
              guardrails: [
                "Alert immediately on safety-related anomalies",
                "Batch non-critical anomalies into hourly summaries",
              ],
            },
          ],
          goals: [
            { title: "Achieve 95% OEE across all CNC machines", description: "Overall Equipment Effectiveness target for Q2 2026" },
            { title: "Reduce unplanned downtime by 30%", description: "Through predictive monitoring and proactive scheduling" },
          ],
        },
        {
          id: "quality",
          name: "Quality",
          description: "Quality control, inspection, and compliance",
          color: "#10b981",
          agents: [
            {
              id: "inspector",
              name: "Inspector",
              role: "Quality inspection reporting and non-conformance tracking",
              persona: "You are the quality inspector at Acme Manufacturing. You review inspection reports, track NCRs (non-conformance reports), and ensure corrective actions are completed. You are methodical and thorough. Every finding has a root cause and a corrective action.",
              model: "claude-cli:sonnet",
              skills: ["ncr-management", "root-cause-analysis"],
              dataSources: ["quality-database", "inspection-reports"],
              heartbeatSchedule: "0 8 * * 1-5",
              heartbeatLabel: "Every weekday at 8am",
              guardrails: [
                "Escalate safety-related NCRs immediately",
                "Never close an NCR without verified corrective action",
              ],
            },
          ],
          goals: [
            { title: "Zero customer returns due to quality issues", description: "Maintain AS9100 compliance" },
          ],
        },
      ],
      routines: [
        {
          name: "Morning Production Brief",
          description: "Daily production status, schedule review, and quality summary",
          trigger: { type: "cron", expression: "0 7 * * 1-5" },
          steps: [
            { agentId: "monitor", prompt: "Generate today's production status report: machine uptime, WIP status, any overnight anomalies." },
            { agentId: "scheduler", prompt: "Review today's production schedule against the status report. Flag any conflicts or delays. Suggest adjustments if needed." },
            { agentId: "inspector", prompt: "Summarize open NCRs and any quality holds. Flag items that could impact today's shipments." },
          ],
        },
      ],
      governanceRules: [
        "All agents must log decisions with reasoning",
        "Safety-related issues bypass normal escalation -- alert immediately",
        "Budget overruns require CEO approval before continuing",
      ],
    },
  ],
}
