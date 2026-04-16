import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { heartbeatRuns, agents } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

// GET /api/agents/[id]/runs -- return paginated heartbeat runs (newest first)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10)

  // Validate agent exists
  const agentRows = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1)

  if (agentRows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const runs = await db
    .select()
    .from(heartbeatRuns)
    .where(eq(heartbeatRuns.agentId, id))
    .orderBy(desc(heartbeatRuns.createdAt))
    .limit(Math.min(limit, 100))
    .offset(offset)

  return NextResponse.json({
    agentId: id,
    runs,
    limit,
    offset,
  })
}
