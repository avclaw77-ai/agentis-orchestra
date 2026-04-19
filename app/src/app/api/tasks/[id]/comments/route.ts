import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskComments, tasks } from "@/db/schema"
import { eq, asc } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/tasks/[id]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params

  const comments = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, id))
    .orderBy(asc(taskComments.createdAt))
    .limit(100)

  return NextResponse.json(comments)
}

// POST /api/tasks/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { body: commentBody, authorAgentId, authorUserId, runId } = body

  if (!commentBody) {
    return NextResponse.json(
      { error: "body is required" },
      { status: 400 }
    )
  }

  // Verify task exists
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  const [comment] = await db
    .insert(taskComments)
    .values({
      taskId: id,
      departmentId: task.departmentId,
      authorAgentId: authorAgentId || null,
      authorUserId: authorUserId || null,
      body: commentBody,
      runId: runId || null,
    })
    .returning()

  return NextResponse.json(comment, { status: 201 })
}
