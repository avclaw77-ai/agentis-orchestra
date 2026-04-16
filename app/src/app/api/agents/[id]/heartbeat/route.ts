import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getNextRuns, isValidCron, cronToHuman } from "@/lib/cron-helpers"

// GET /api/agents/[id]/heartbeat -- return heartbeat config + next runs preview
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (rows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const agent = rows[0]
  const schedule = agent.heartbeatSchedule || null
  const enabled = agent.heartbeatEnabled ?? false
  const nextRuns = schedule && isValidCron(schedule) ? getNextRuns(schedule, 5) : []
  const humanLabel = schedule ? cronToHuman(schedule) : null

  return NextResponse.json({
    agentId: id,
    schedule,
    enabled,
    humanLabel,
    nextRuns: nextRuns.map((d) => d.toISOString()),
  })
}

// PATCH /api/agents/[id]/heartbeat -- update schedule and enabled flag
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { schedule, enabled } = body

  // Validate agent exists
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (rows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  // Validate cron if provided and enabling
  if (enabled && schedule && !isValidCron(schedule)) {
    return NextResponse.json(
      { error: "Invalid cron expression" },
      { status: 400 }
    )
  }

  await db
    .update(agents)
    .set({
      heartbeatSchedule: schedule || null,
      heartbeatEnabled: enabled ?? false,
    })
    .where(eq(agents.id, id))

  const nextRuns =
    schedule && isValidCron(schedule) ? getNextRuns(schedule, 5) : []

  return NextResponse.json({
    agentId: id,
    schedule: schedule || null,
    enabled: enabled ?? false,
    humanLabel: schedule ? cronToHuman(schedule) : null,
    nextRuns: nextRuns.map((d) => d.toISOString()),
  })
}
