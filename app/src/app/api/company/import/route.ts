import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  departments,
  agents,
  agentConfigs,
  goals,
  companySkills,
  routines,
  routineTriggers,
  routineSteps,
  activityLog,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { getSessionUser } from "@/lib/auth"

// POST /api/company/import -- Import a company template JSON
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  const template = await req.json()

  if (!template || template.version !== 1) {
    return NextResponse.json(
      { error: "invalid template or unsupported version" },
      { status: 400 }
    )
  }

  const summary = {
    departments: { created: 0, skipped: 0 },
    agents: { created: 0, skipped: 0 },
    goals: { created: 0, skipped: 0 },
    skills: { created: 0, skipped: 0 },
    routines: { created: 0, skipped: 0 },
  }

  const now = new Date()

  // Import departments and their agents/goals
  if (template.departments && Array.isArray(template.departments)) {
    for (const dept of template.departments) {
      // Check if department exists
      const [existing] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, dept.id))

      if (existing) {
        summary.departments.skipped++
      } else {
        await db.insert(departments).values({
          id: dept.id,
          name: dept.name,
          description: dept.description || null,
          color: dept.color || "#3b82f6",
          template: dept.template || null,
          createdAt: now,
          updatedAt: now,
        })
        summary.departments.created++
      }

      // Import agents for this department
      if (dept.agents && Array.isArray(dept.agents)) {
        for (const agent of dept.agents) {
          const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, agent.id))

          if (existingAgent) {
            summary.agents.skipped++
          } else {
            await db.insert(agents).values({
              id: agent.id,
              departmentId: dept.id,
              name: agent.name,
              role: agent.role,
              status: "idle",
            })

            await db.insert(agentConfigs).values({
              id: `config-${agent.id}`,
              agentId: agent.id,
              departmentId: dept.id,
              model: agent.model || "claude-sonnet-4-6",
              persona: agent.persona || null,
              createdAt: now,
              updatedAt: now,
            })
            summary.agents.created++
          }
        }
      }

      // Import goals for this department
      if (dept.goals && Array.isArray(dept.goals)) {
        for (const goal of dept.goals) {
          const goalId = `goal-${randomUUID()}`
          await db.insert(goals).values({
            id: goalId,
            departmentId: dept.id,
            title: goal.title,
            description: goal.description || null,
            status: "planned",
            createdAt: now,
            updatedAt: now,
          })
          summary.goals.created++
        }
      }
    }
  }

  // Import skills
  if (template.skills && Array.isArray(template.skills)) {
    for (const skill of template.skills) {
      const [existing] = await db
        .select()
        .from(companySkills)
        .where(eq(companySkills.key, skill.key))

      if (existing) {
        summary.skills.skipped++
      } else {
        await db.insert(companySkills).values({
          key: skill.key,
          name: skill.name,
          description: skill.description || null,
          definition: skill.definition || {},
          version: 1,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        summary.skills.created++
      }
    }
  }

  // Import routines
  if (template.routines && Array.isArray(template.routines)) {
    for (const routine of template.routines) {
      const routineId = `routine-${randomUUID()}`

      await db.insert(routines).values({
        id: routineId,
        name: routine.name,
        description: routine.description || null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })

      // Import triggers
      if (routine.triggers && Array.isArray(routine.triggers)) {
        for (const trigger of routine.triggers) {
          await db.insert(routineTriggers).values({
            id: `trigger-${randomUUID()}`,
            routineId,
            type: trigger.type,
            cronExpression: trigger.cronExpression || null,
            isActive: true,
            createdAt: now,
          })
        }
      }

      // Import steps
      if (routine.steps && Array.isArray(routine.steps)) {
        for (let i = 0; i < routine.steps.length; i++) {
          const step = routine.steps[i]
          await db.insert(routineSteps).values({
            id: `step-${randomUUID()}`,
            routineId,
            stepOrder: i + 1,
            agentId: step.agentId,
            promptTemplate: step.promptTemplate,
            createdAt: now,
          })
        }
      }

      summary.routines.created++
    }
  }

  // Log the import
  await db.insert(activityLog).values({
    departmentId: null,
    agent: "system",
    action: "company_imported",
    metadata: summary,
  })

  return NextResponse.json({ success: true, summary }, { status: 201 })
}
