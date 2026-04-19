import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { approvalComments } from "@/db/schema"
import { eq, asc } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/approvals/[id]/comments
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const approvalId = parseInt(id, 10)
  if (isNaN(approvalId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }

  const rows = await db
    .select()
    .from(approvalComments)
    .where(eq(approvalComments.approvalId, approvalId))
    .orderBy(asc(approvalComments.createdAt))
    .limit(100)

  return NextResponse.json(rows)
}

// POST /api/approvals/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const approvalId = parseInt(id, 10)
  if (isNaN(approvalId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }

  const body = await req.json()
  const { body: commentBody, authorAgentId, authorUserId } = body

  if (!commentBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 })
  }

  const [created] = await db
    .insert(approvalComments)
    .values({
      approvalId,
      body: commentBody,
      authorAgentId: authorAgentId || null,
      authorUserId: authorUserId || null,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
