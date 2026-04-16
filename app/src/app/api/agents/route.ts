import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents, agentConfigs } from "@/db/schema"
import { eq, isNull } from "drizzle-orm"

// GET /api/agents?departmentId=eng (omit for all, "company" for company-level only)
export async function GET(req: NextRequest) {
  const departmentId = req.nextUrl.searchParams.get("departmentId")

  let rows
  if (departmentId === "company") {
    rows = await db
      .select()
      .from(agents)
      .where(isNull(agents.departmentId))
  } else if (departmentId) {
    rows = await db
      .select()
      .from(agents)
      .where(eq(agents.departmentId, departmentId))
  } else {
    rows = await db.select().from(agents)
  }

  return NextResponse.json(rows)
}

// POST /api/agents -- create a new agent
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, departmentId, name, role, persona, model, adapterType, isCeo } =
    body

  if (!id || !name || !role) {
    return NextResponse.json(
      { error: "id, name, and role are required" },
      { status: 400 }
    )
  }

  await db.insert(agents).values({
    id,
    departmentId: departmentId || null,
    name,
    role,
    status: "idle",
    isCeo: isCeo || false,
  })

  await db.insert(agentConfigs).values({
    id: `${id}-config`,
    agentId: id,
    departmentId: departmentId || null,
    persona: persona || null,
    model: model || "claude-sonnet-4-6",
    adapterType: adapterType || "sdk",
  })

  return NextResponse.json({ created: id }, { status: 201 })
}
