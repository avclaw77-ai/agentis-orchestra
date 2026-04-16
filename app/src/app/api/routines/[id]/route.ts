import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  routines,
  routineTriggers,
  routineSteps,
  routineRuns,
  agents,
} from "@/db/schema"
import { eq, desc, asc } from "drizzle-orm"

const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:3847"

// GET /api/routines/[id] -- single routine with triggers, steps (with agent names), recent runs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [routine] = await db.select().from(routines).where(eq(routines.id, id))
  if (!routine) {
    return NextResponse.json({ error: "routine not found" }, { status: 404 })
  }

  const triggers = await db
    .select()
    .from(routineTriggers)
    .where(eq(routineTriggers.routineId, id))

  // Steps with agent name + role
  const stepsRaw = await db
    .select({
      id: routineSteps.id,
      routineId: routineSteps.routineId,
      stepOrder: routineSteps.stepOrder,
      agentId: routineSteps.agentId,
      promptTemplate: routineSteps.promptTemplate,
      modelOverride: routineSteps.modelOverride,
      timeoutMs: routineSteps.timeoutMs,
      dependsOnStepId: routineSteps.dependsOnStepId,
      agentName: agents.name,
      agentRole: agents.role,
      agentDepartmentId: agents.departmentId,
    })
    .from(routineSteps)
    .leftJoin(agents, eq(routineSteps.agentId, agents.id))
    .where(eq(routineSteps.routineId, id))
    .orderBy(asc(routineSteps.stepOrder))

  // Recent runs (last 20)
  const recentRuns = await db
    .select()
    .from(routineRuns)
    .where(eq(routineRuns.routineId, id))
    .orderBy(desc(routineRuns.createdAt))
    .limit(20)

  return NextResponse.json({
    ...routine,
    triggers,
    steps: stepsRaw,
    recentRuns,
  })
}

// POST /api/routines/[id] -- trigger a manual run
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [routine] = await db.select().from(routines).where(eq(routines.id, id))
  if (!routine) {
    return NextResponse.json({ error: "routine not found" }, { status: 404 })
  }

  if (routine.status !== "active" && routine.status !== "draft") {
    return NextResponse.json(
      { error: `Routine is ${routine.status}, cannot trigger` },
      { status: 409 }
    )
  }

  try {
    const bridgeRes = await fetch(`${BRIDGE_URL}/routines/${id}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: {} }),
    })

    const data = await bridgeRes.json()
    if (!bridgeRes.ok) {
      return NextResponse.json(data, { status: bridgeRes.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: "Bridge unavailable" },
      { status: 503 }
    )
  }
}
