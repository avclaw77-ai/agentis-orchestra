import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { approvalRequests, activityLog } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"
import { sendNotification, approvalCreatedEmail } from "@/lib/mailer"

// GET /api/approvals?status=pending&departmentId=eng
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const status = req.nextUrl.searchParams.get("status")
  const departmentId = req.nextUrl.searchParams.get("departmentId")

  const conditions = []
  if (status) {
    conditions.push(eq(approvalRequests.status, status))
  }
  if (departmentId) {
    conditions.push(eq(approvalRequests.departmentId, departmentId))
  }

  const rows = await db
    .select()
    .from(approvalRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(approvalRequests.createdAt))
    .limit(200)

  return NextResponse.json(rows)
}

// POST /api/approvals -- create an approval request
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const {
    type,
    title,
    description,
    departmentId,
    requestedByAgentId,
    requestedByUserId,
    payload,
  } = body

  if (!type || !title) {
    return NextResponse.json(
      { error: "type and title are required" },
      { status: 400 }
    )
  }

  const now = new Date()
  const [created] = await db
    .insert(approvalRequests)
    .values({
      type,
      title,
      description: description || null,
      departmentId: departmentId || null,
      requestedByAgentId: requestedByAgentId || null,
      requestedByUserId: requestedByUserId || null,
      payload: payload || {},
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await db.insert(activityLog).values({
    departmentId: departmentId || null,
    agent: requestedByAgentId || "system",
    action: "approval_requested",
    task: String(created.id),
    metadata: { type, title },
  })

  // Send email notification (non-blocking, silent on failure)
  sendNotification(approvalCreatedEmail({
    type,
    title,
    description,
    agentName: requestedByAgentId || undefined,
    departmentName: departmentId || undefined,
  })).catch(() => {})

  return NextResponse.json(created, { status: 201 })
}

// PATCH /api/approvals -- approve/reject/request revision
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { id, status, decisionNote, decidedByUserId } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const validStatuses = [
    "approved",
    "rejected",
    "revision_requested",
    "cancelled",
  ]
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    )
  }

  const [current] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id))
  if (!current) {
    return NextResponse.json(
      { error: "approval request not found" },
      { status: 404 }
    )
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (status !== undefined) {
    updates.status = status
    if (["approved", "rejected"].includes(status)) {
      updates.decidedAt = new Date()
      updates.decidedByUserId = decidedByUserId || null
    }
  }
  if (decisionNote !== undefined) updates.decisionNote = decisionNote

  await db
    .update(approvalRequests)
    .set(updates)
    .where(eq(approvalRequests.id, id))

  if (status && status !== current.status) {
    await db.insert(activityLog).values({
      departmentId: current.departmentId,
      agent: decidedByUserId || "system",
      action: `approval_${status}`,
      task: String(id),
      metadata: { title: current.title, decisionNote },
    })
  }

  const [updated] = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id))
  return NextResponse.json(updated)
}
