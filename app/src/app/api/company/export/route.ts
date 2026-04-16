import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  company,
  departments,
  agents,
  agentConfigs,
  goals,
  companySkills,
  routines,
  routineTriggers,
  routineSteps,
} from "@/db/schema"
import { eq } from "drizzle-orm"

// GET /api/company/export -- Export entire company config as JSON template
export async function GET() {
  const { getSessionUser } = await import("@/lib/auth")
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 })
  // Company info
  const [companyRow] = await db.select().from(company)
  if (!companyRow) {
    return NextResponse.json(
      { error: "no company configured" },
      { status: 404 }
    )
  }

  // Departments
  const deptRows = await db.select().from(departments)

  // Agents + configs
  const agentRows = await db.select().from(agents)
  const configRows = await db.select().from(agentConfigs)

  // Goals
  const goalRows = await db.select().from(goals)

  // Skills
  const skillRows = await db.select().from(companySkills)

  // Routines with triggers and steps
  const routineRows = await db.select().from(routines)
  const triggerRows = await db.select().from(routineTriggers)
  const stepRows = await db.select().from(routineSteps)

  // Build department export with nested agents and goals
  const departmentExport = deptRows.map((dept) => {
    const deptAgents = agentRows
      .filter((a) => a.departmentId === dept.id)
      .map((a) => {
        const config = configRows.find((c) => c.agentId === a.id)
        return {
          id: a.id,
          name: a.name,
          role: a.role,
          model: config?.model || "claude-sonnet-4-6",
          persona: config?.persona || null,
        }
      })

    const deptGoals = goalRows
      .filter((g) => g.departmentId === dept.id)
      .map((g) => ({
        title: g.title,
        description: g.description,
      }))

    return {
      id: dept.id,
      name: dept.name,
      description: dept.description,
      color: dept.color || "#3b82f6",
      template: dept.template,
      agents: deptAgents,
      goals: deptGoals,
    }
  })

  // Skills export
  const skillsExport = skillRows.map((s) => ({
    key: s.key,
    name: s.name,
    description: s.description,
    definition: s.definition as Record<string, unknown>,
  }))

  // Routines export
  const routinesExport = routineRows.map((r) => {
    const rTriggers = triggerRows
      .filter((t) => t.routineId === r.id)
      .map((t) => ({
        type: t.type,
        cronExpression: t.cronExpression || undefined,
      }))

    const rSteps = stepRows
      .filter((s) => s.routineId === r.id)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((s) => ({
        agentId: s.agentId,
        promptTemplate: s.promptTemplate,
      }))

    return {
      name: r.name,
      description: r.description,
      steps: rSteps,
      triggers: rTriggers,
    }
  })

  const template = {
    version: 1,
    company: {
      name: companyRow.name,
      mission: companyRow.mission,
      locale: companyRow.locale,
    },
    departments: departmentExport,
    skills: skillsExport,
    routines: routinesExport,
  }

  return NextResponse.json(template)
}
