import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents, tasks, goals, routines, chatMessages } from "@/db/schema"
import { ilike, or, desc, sql } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/search?q=keyword&limit=20
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 50)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q })
  }

  const pattern = `%${q}%`

  // Search across all major entities in parallel
  const [agentResults, taskResults, goalResults, routineResults] = await Promise.all([
    db
      .select({ id: agents.id, name: agents.name, displayName: agents.displayName, role: agents.role })
      .from(agents)
      .where(or(ilike(agents.name, pattern), ilike(agents.role, pattern), ilike(sql`COALESCE(${agents.displayName}, '')`, pattern)))
      .limit(limit),

    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority })
      .from(tasks)
      .where(or(ilike(tasks.title, pattern), ilike(sql`COALESCE(${tasks.notes}, '')`, pattern), ilike(tasks.id, pattern)))
      .orderBy(desc(tasks.updatedAt))
      .limit(limit),

    db
      .select({ id: goals.id, title: goals.title, status: goals.status })
      .from(goals)
      .where(or(ilike(goals.title, pattern), ilike(sql`COALESCE(${goals.description}, '')`, pattern)))
      .limit(limit),

    db
      .select({ id: routines.id, name: routines.name, status: routines.status })
      .from(routines)
      .where(or(ilike(routines.name, pattern), ilike(sql`COALESCE(${routines.description}, '')`, pattern)))
      .limit(limit),
  ])

  return NextResponse.json({
    query: q,
    results: {
      agents: agentResults,
      tasks: taskResults,
      goals: goalResults,
      routines: routineResults,
    },
    total: agentResults.length + taskResults.length + goalResults.length + routineResults.length,
  })
}
