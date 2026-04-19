import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, taskComments, activityLog } from "@/db/schema"
import { eq, asc, desc, and, isNull } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/tasks/[id] -- single task with comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  const comments = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, id))
    .orderBy(asc(taskComments.createdAt))

  return NextResponse.json({ ...task, comments })
}

// PATCH /api/tasks/[id] -- update single task fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const [current] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!current) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  const { title, status, assignedTo, priority, phase, notes, project, dependencies } = body

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

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id))
  return NextResponse.json(updated)
}

// POST /api/tasks/[id] -- checkout or release
// Body: { action: "checkout" | "release", runId?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, runId } = body

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  if (action === "checkout") {
    // Atomic checkout -- only if not already locked
    if (task.executionLockedAt) {
      return NextResponse.json(
        {
          error: "task already checked out",
          lockedAt: task.executionLockedAt,
          runId: task.checkoutRunId,
        },
        { status: 409 }
      )
    }

    await db
      .update(tasks)
      .set({
        executionLockedAt: new Date(),
        checkoutRunId: runId || null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))

    await db.insert(activityLog).values({
      departmentId: task.departmentId,
      agent: task.assignedTo || "system",
      action: "task_checkout",
      task: id,
      metadata: { runId },
    })

    const [updated] = await db.select().from(tasks).where(eq(tasks.id, id))
    return NextResponse.json(updated)
  }

  if (action === "release") {
    await db
      .update(tasks)
      .set({
        executionLockedAt: null,
        checkoutRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))

    await db.insert(activityLog).values({
      departmentId: task.departmentId,
      agent: task.assignedTo || "system",
      action: "task_released",
      task: id,
    })

    const [updated] = await db.select().from(tasks).where(eq(tasks.id, id))
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 })
}
