import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  routines,
  routineTriggers,
  routineSteps,
  routineRuns,
  activityLog,
} from "@/db/schema"
import { eq, desc, and, count } from "drizzle-orm"
import { randomUUID } from "node:crypto"

const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:3847"

// GET /api/routines?departmentId=eng
export async function GET(req: NextRequest) {
  const departmentId = req.nextUrl.searchParams.get("departmentId")

  const conditions = []
  if (departmentId) {
    conditions.push(eq(routines.departmentId, departmentId))
  }

  const rows = await db
    .select()
    .from(routines)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(routines.updatedAt))

  // Enrich with triggers, step count, and recent run count
  const enriched = await Promise.all(
    rows.map(async (routine) => {
      const triggers = await db
        .select()
        .from(routineTriggers)
        .where(eq(routineTriggers.routineId, routine.id))

      const [stepCount] = await db
        .select({ count: count() })
        .from(routineSteps)
        .where(eq(routineSteps.routineId, routine.id))

      const [runCount] = await db
        .select({ count: count() })
        .from(routineRuns)
        .where(eq(routineRuns.routineId, routine.id))

      return {
        ...routine,
        triggers,
        stepCount: stepCount?.count ?? 0,
        runCount: runCount?.count ?? 0,
      }
    })
  )

  return NextResponse.json(enriched)
}

// POST /api/routines -- create routine with steps and triggers
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    name,
    description,
    departmentId,
    assigneeAgentId,
    status,
    concurrencyPolicy,
    catchUpPolicy,
    maxDurationMs,
    triggers: triggerData,
    steps: stepData,
  } = body

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const routineId = `routine-${randomUUID()}`
  const now = new Date()

  // Insert routine
  await db.insert(routines).values({
    id: routineId,
    name,
    description: description || null,
    departmentId: departmentId || null,
    assigneeAgentId: assigneeAgentId || null,
    status: status || "draft",
    concurrencyPolicy: concurrencyPolicy || "skip",
    catchUpPolicy: catchUpPolicy || "skip",
    maxDurationMs: maxDurationMs || 600000,
    createdAt: now,
    updatedAt: now,
  })

  // Insert triggers
  if (triggerData && Array.isArray(triggerData)) {
    for (const t of triggerData) {
      await db.insert(routineTriggers).values({
        id: `trigger-${randomUUID()}`,
        routineId,
        type: t.type,
        cronExpression: t.cronExpression || null,
        cronHumanLabel: t.cronHumanLabel || null,
        webhookPath: t.webhookPath || null,
        webhookSecret: t.webhookSecret || null,
        isActive: t.isActive !== false,
      })
    }
  }

  // Insert steps
  if (stepData && Array.isArray(stepData)) {
    for (let i = 0; i < stepData.length; i++) {
      const s = stepData[i]
      await db.insert(routineSteps).values({
        id: `step-${randomUUID()}`,
        routineId,
        stepOrder: i + 1,
        agentId: s.agentId,
        promptTemplate: s.promptTemplate,
        modelOverride: s.modelOverride || null,
        timeoutMs: s.timeoutMs || 300000,
        dependsOnStepId: s.dependsOnStepId || null,
      })
    }
  }

  // Log activity
  await db.insert(activityLog).values({
    departmentId: departmentId || null,
    agent: "system",
    action: "routine_created",
    task: routineId,
    metadata: { name, status: status || "draft" },
  })

  // Notify bridge scheduler to reload
  try {
    await fetch(`${BRIDGE_URL}/scheduler/reload`, { method: "POST" })
  } catch {
    // Bridge may not be running during setup
  }

  const [created] = await db.select().from(routines).where(eq(routines.id, routineId))
  return NextResponse.json(created, { status: 201 })
}

// PATCH /api/routines -- update a routine
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, name, description, status, concurrencyPolicy, catchUpPolicy, maxDurationMs } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const [current] = await db.select().from(routines).where(eq(routines.id, id))
  if (!current) {
    return NextResponse.json({ error: "routine not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (status !== undefined) updates.status = status
  if (concurrencyPolicy !== undefined) updates.concurrencyPolicy = concurrencyPolicy
  if (catchUpPolicy !== undefined) updates.catchUpPolicy = catchUpPolicy
  if (maxDurationMs !== undefined) updates.maxDurationMs = maxDurationMs

  await db.update(routines).set(updates).where(eq(routines.id, id))

  // Notify scheduler on status changes
  if (status !== undefined && status !== current.status) {
    try {
      await fetch(`${BRIDGE_URL}/scheduler/reload`, { method: "POST" })
    } catch {
      // Bridge may not be running
    }

    await db.insert(activityLog).values({
      departmentId: current.departmentId,
      agent: "system",
      action: "routine_status_changed",
      task: id,
      metadata: { from: current.status, to: status },
    })
  }

  const [updated] = await db.select().from(routines).where(eq(routines.id, id))
  return NextResponse.json(updated)
}

// DELETE /api/routines?id=routine-xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const [routine] = await db.select().from(routines).where(eq(routines.id, id))
  if (!routine) {
    return NextResponse.json({ error: "routine not found" }, { status: 404 })
  }

  // Cascading deletes handle triggers, steps, runs
  await db.delete(routines).where(eq(routines.id, id))

  await db.insert(activityLog).values({
    departmentId: routine.departmentId,
    agent: "system",
    action: "routine_deleted",
    task: id,
    metadata: { name: routine.name },
  })

  // Reload scheduler
  try {
    await fetch(`${BRIDGE_URL}/scheduler/reload`, { method: "POST" })
  } catch {
    // Bridge may not be running
  }

  return NextResponse.json({ deleted: id })
}
