import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/agents/[id] -- single agent
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (rows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  return NextResponse.json(rows[0])
}

// PATCH /api/agents/[id] -- update agent-level fields (displayName, name, role)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (rows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if ("displayName" in body) updates.displayName = body.displayName
  if ("name" in body) updates.name = body.name
  if ("role" in body) updates.role = body.role
  if ("isSystemAgent" in body) updates.isSystemAgent = body.isSystemAgent

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  await db.update(agents).set(updates).where(eq(agents.id, id))

  const updated = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  return NextResponse.json(updated[0])
}

// DELETE /api/agents/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  const { id } = await params

  const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  await db.delete(agents).where(eq(agents.id, id))
  return NextResponse.json({ deleted: id })
  } catch {
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 })
  }
}
