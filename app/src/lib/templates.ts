import type { DepartmentTemplate } from "@/types"
export type { DepartmentTemplate }

// =============================================================================
// Department templates -- pre-configured agent setups per department type
// =============================================================================

export const DEPARTMENT_TEMPLATES: Record<string, DepartmentTemplate> = {
  engineering: {
    name: "Engineering",
    description: "Software development and infrastructure",
    color: "#3b82f6",
    agents: [
      {
        id: "dev",
        name: "Dev",
        role: "Software development",
        model: "claude-cli:sonnet",
      },
      {
        id: "qa",
        name: "QA",
        role: "Testing & code review",
        model: "claude-cli:haiku",
      },
      {
        id: "ops",
        name: "Ops",
        role: "Infrastructure & deployment",
        model: "claude-cli:sonnet",
      },
    ],
  },
  research: {
    name: "Research",
    description: "Market research, competitive analysis, exploration",
    color: "#f59e0b",
    agents: [
      {
        id: "rnd",
        name: "RnD",
        role: "Research & prototyping",
        model: "perplexity:sonar-pro",
      },
    ],
  },
  design: {
    name: "Design",
    description: "Visual design, UX, and brand",
    color: "#8b5cf6",
    agents: [
      {
        id: "uiux",
        name: "UIUX",
        role: "Visual design & UX",
        model: "claude-cli:opus",
      },
    ],
  },
  operations: {
    name: "Operations",
    description: "CEO support, scheduling, communications",
    color: "#ec4899",
    agents: [
      {
        id: "maxx",
        name: "Maxx",
        role: "CEO assistant",
        model: "claude-cli:sonnet",
      },
    ],
  },
  sales: {
    name: "Sales",
    description: "Lead generation, proposals, client relations",
    color: "#10b981",
    agents: [
      {
        id: "sales",
        name: "Sales",
        role: "Lead generation & proposals",
        model: "claude-cli:sonnet",
      },
    ],
  },
  support: {
    name: "Support",
    description: "Customer support and documentation",
    color: "#6366f1",
    agents: [
      {
        id: "support",
        name: "Support",
        role: "Customer support",
        model: "claude-cli:haiku",
      },
    ],
  },
} as const

export type DepartmentTemplateKey = keyof typeof DEPARTMENT_TEMPLATES

/**
 * Returns all available template keys.
 */
export function getTemplateKeys(): DepartmentTemplateKey[] {
  return Object.keys(DEPARTMENT_TEMPLATES) as DepartmentTemplateKey[]
}

/**
 * Returns a deep copy of a template by key, or null if not found.
 */
export function getTemplate(key: string): DepartmentTemplate | null {
  const template = DEPARTMENT_TEMPLATES[key]
  if (!template) return null
  return JSON.parse(JSON.stringify(template)) as DepartmentTemplate
}
