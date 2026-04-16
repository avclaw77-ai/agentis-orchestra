import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents, agentRuntimeState, tasks } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"

// GET /api/agents/[id]/stats -- return agent runtime stats
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Validate agent exists
  const agentRows = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1)

  if (agentRows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  // Get runtime state (token totals)
  const runtimeRows = await db
    .select()
    .from(agentRuntimeState)
    .where(eq(agentRuntimeState.agentId, id))
    .limit(1)

  const runtime = runtimeRows[0] || null
  const totalTokens = (runtime?.totalInputTokens ?? 0) + (runtime?.totalOutputTokens ?? 0)
  const totalCostCents = runtime?.totalCostCents ?? 0

  // Count completed tasks
  const taskCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        eq(tasks.assignedTo, id),
        eq(tasks.status, "done")
      )
    )

  const tasksCompleted = taskCountResult[0]?.count ?? 0

  return NextResponse.json({
    totalTokens,
    totalCostCents,
    tasksCompleted,
  })
}
