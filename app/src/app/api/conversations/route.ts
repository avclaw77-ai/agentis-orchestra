import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { conversations, chatMessages, agents } from "@/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/conversations?agentId=xxx
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const agentId = req.nextUrl.searchParams.get("agentId")
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 })
  }

  const rows = await db
    .select({
      id: conversations.id,
      agentId: conversations.agentId,
      departmentId: conversations.departmentId,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`(SELECT count(*) FROM chat_messages WHERE conversation_id = conversations.id)::int`,
    })
    .from(conversations)
    .where(eq(conversations.agentId, agentId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50)

  return NextResponse.json(rows)
}

// POST /api/conversations -- create new conversation
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { agentId, departmentId, title } = body

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 })
  }

  try {
  // Verify agent exists
  const [agent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const id = crypto.randomUUID()
  const now = new Date()

  await db.insert(conversations).values({
    id,
    agentId,
    departmentId: departmentId || null,
    title: title || "New conversation",
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ id, agentId, departmentId, title: title || "New conversation", createdAt: now, updatedAt: now })
  } catch {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
  }
}

// PATCH /api/conversations -- rename conversation
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { id, title } = body

  if (!id || !title) {
    return NextResponse.json({ error: "id and title required" }, { status: 400 })
  }

  // Verify conversation exists
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id))

  return NextResponse.json({ ok: true })
}

// DELETE /api/conversations?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Verify conversation exists
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  await db.delete(conversations).where(eq(conversations.id, id))

  return NextResponse.json({ ok: true })
}
