import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { goals, tasks, activityLog } from "@/db/schema"
import { eq, desc, and, isNull } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { getSessionUser } from "@/lib/auth"

// GET /api/goals?departmentId=eng
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const departmentId = req.nextUrl.searchParams.get("departmentId")

  const conditions = []
  if (departmentId) {
    conditions.push(eq(goals.departmentId, departmentId))
  }

  const rows = await db
    .select()
    .from(goals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(goals.createdAt))
    .limit(200)

  return NextResponse.json(rows)
}

// POST /api/goals -- create a new goal
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { title, description, departmentId, parentId, ownerAgentId } = body

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  const id = `goal-${randomUUID()}`
  const now = new Date()

  await db.insert(goals).values({
    id,
    title,
    description: description || null,
    departmentId: departmentId || null,
    parentId: parentId || null,
    ownerAgentId: ownerAgentId || null,
    status: "planned",
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(activityLog).values({
    departmentId: departmentId || null,
    agent: "system",
    action: "goal_created",
    task: id,
    metadata: { title },
  })

  const [created] = await db.select().from(goals).where(eq(goals.id, id))
  return NextResponse.json(created, { status: 201 })
}

// PATCH /api/goals -- update a goal
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { id, title, description, status, ownerAgentId } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const [current] = await db.select().from(goals).where(eq(goals.id, id))
  if (!current) {
    return NextResponse.json({ error: "goal not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (status !== undefined) updates.status = status
  if (ownerAgentId !== undefined) updates.ownerAgentId = ownerAgentId

  await db.update(goals).set(updates).where(eq(goals.id, id))

  if (status && status !== current.status) {
    await db.insert(activityLog).values({
      departmentId: current.departmentId,
      agent: "system",
      action: "goal_status_changed",
      task: id,
      metadata: { from: current.status, to: status },
    })
  }

  const [updated] = await db.select().from(goals).where(eq(goals.id, id))
  return NextResponse.json(updated)
}

// DELETE /api/goals?id=goal-xxx
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const [goal] = await db.select().from(goals).where(eq(goals.id, id))
  if (!goal) {
    return NextResponse.json({ error: "goal not found" }, { status: 404 })
  }

  // Cascade children: set parentId = NULL for child goals
  await db
    .update(goals)
    .set({ parentId: null, updatedAt: new Date() })
    .where(eq(goals.parentId, id))

  // Unlink tasks from this goal
  await db
    .update(tasks)
    .set({ goalId: null, updatedAt: new Date() })
    .where(eq(tasks.goalId, id))

  await db.delete(goals).where(eq(goals.id, id))

  await db.insert(activityLog).values({
    departmentId: goal.departmentId,
    agent: "system",
    action: "goal_deleted",
    task: id,
    metadata: { title: goal.title },
  })

  return NextResponse.json({ deleted: id })
}
