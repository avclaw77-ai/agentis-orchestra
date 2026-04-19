import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, activityLog } from "@/db/schema"
import { eq, desc, isNull, and, sql } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/tasks?departmentId=eng&status=backlog&assignedTo=dev&project=orchestra
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const departmentId = req.nextUrl.searchParams.get("departmentId")
  const status = req.nextUrl.searchParams.get("status")
  const assignedTo = req.nextUrl.searchParams.get("assignedTo")
  const project = req.nextUrl.searchParams.get("project")

  const conditions = []

  if (departmentId) {
    conditions.push(eq(tasks.departmentId, departmentId))
  }
  // When no departmentId is passed, return all tasks (CEO view)

  if (status) {
    conditions.push(eq(tasks.status, status))
  }
  if (assignedTo) {
    conditions.push(eq(tasks.assignedTo, assignedTo))
  }
  if (project) {
    conditions.push(eq(tasks.project, project))
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.updatedAt))

  return NextResponse.json(rows)
}

// POST /api/tasks -- create a new task
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const {
    title,
    departmentId,
    assignedTo,
    project,
    priority,
    phase,
    dueDate,
    notes,
    parentTaskId,
    estimatedTokens,
    dependencies,
  } = body

  if (!title) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    )
  }

  if (typeof title === "string" && title.length > 500) {
    return NextResponse.json(
      { error: "title must be 500 characters or fewer" },
      { status: 400 }
    )
  }

  if (notes && typeof notes === "string" && notes.length > 5000) {
    return NextResponse.json(
      { error: "notes must be 5000 characters or fewer" },
      { status: 400 }
    )
  }

  // Auto-generate ID: TASK-NNN with collision retry (max 5 attempts, then timestamp fallback)
  let id: string = `TASK-${Date.now().toString(36).toUpperCase()}`
  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
    const baseNum = (countResult[0]?.count || 0) + 1
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `TASK-${String(baseNum + attempt).padStart(3, "0")}`
      const existing = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, candidate)).limit(1)
      if (existing.length === 0) {
        id = candidate
        break
      }
    }
  } catch {
    // fallback already set
  }

  const now = new Date()
  await db.insert(tasks).values({
    id,
    departmentId: departmentId || null,
    title,
    status: "backlog",
    assignedTo: assignedTo || null,
    project: project || null,
    priority: priority || "medium",
    phase: phase || null,
    notes: notes || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    parentTaskId: parentTaskId || null,
    estimatedTokens: estimatedTokens || null,
    dependencies: Array.isArray(dependencies) ? dependencies : null,
    createdAt: now,
    updatedAt: now,
  })

  // Log activity
  await db.insert(activityLog).values({
    departmentId: departmentId || null,
    agent: "system",
    action: "task_created",
    task: id,
    metadata: { title, assignedTo, priority },
  })

  const [created] = await db.select().from(tasks).where(eq(tasks.id, id))
  return NextResponse.json(created, { status: 201 })
}

// PATCH /api/tasks -- update a task
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { id, title, status, assignedTo, priority, phase, notes, project, dependencies } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Fetch current state for activity logging
  const [current] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!current) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  const allowedStatuses = ["backlog", "in-progress", "review", "done"]
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}` },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (status !== undefined) updates.status = status
  if (assignedTo !== undefined) updates.assignedTo = assignedTo
  if (priority !== undefined) updates.priority = priority
  if (phase !== undefined) updates.phase = phase
  if (notes !== undefined) updates.notes = notes
  if (project !== undefined) updates.project = project
  if (dependencies !== undefined) updates.dependencies = Array.isArray(dependencies) ? dependencies : null

  await db.update(tasks).set(updates).where(eq(tasks.id, id))

  // Activity logging for status changes
  if (status && status !== current.status) {
    if (status === "in-progress") {
      await db.insert(activityLog).values({
        departmentId: current.departmentId,
        agent: current.assignedTo || "system",
        action: "task_started",
        task: id,
      })
    } else if (status === "done") {
      // Calculate duration from last task_started
      const [startLog] = await db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.task, id),
            eq(activityLog.action, "task_started")
          )
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(1)

      const durationMs = startLog
        ? Date.now() - new Date(startLog.createdAt).getTime()
        : null

      await db.insert(activityLog).values({
        departmentId: current.departmentId,
        agent: current.assignedTo || "system",
        action: "task_completed",
        task: id,
        durationMs,
      })
    }
  }

  // Activity logging for reassignment
  if (assignedTo !== undefined && assignedTo !== current.assignedTo) {
    await db.insert(activityLog).values({
      departmentId: current.departmentId,
      agent: "system",
      action: "task_reassigned",
      task: id,
      metadata: { from: current.assignedTo, to: assignedTo },
    })
  }

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id))
  return NextResponse.json(updated)
}

// DELETE /api/tasks?id=TASK-001
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  await db.delete(tasks).where(eq(tasks.id, id))

  await db.insert(activityLog).values({
    departmentId: task.departmentId,
    agent: "system",
    action: "task_deleted",
    task: id,
    metadata: { title: task.title },
  })

  return NextResponse.json({ deleted: id })
}
