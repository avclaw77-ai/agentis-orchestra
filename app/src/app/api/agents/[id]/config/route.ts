import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents, agentConfigs, agentConfigRevisions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/agents/[id]/config -- return agent config
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

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

  const configRows = await db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.agentId, id))
    .limit(1)

  if (configRows.length === 0) {
    return NextResponse.json(null)
  }

  return NextResponse.json(configRows[0])
}

// PATCH /api/agents/[id]/config -- update agent config fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Validate agent exists
  const agentRows = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1)

  if (agentRows.length === 0) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const agent = agentRows[0]

  // Find existing config
  const configRows = await db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.agentId, id))
    .limit(1)

  const allowedKeys = [
    "persona",
    "model",
    "adapterType",
    "guardrails",
    "dataSources",
    "reportsTo",
    "connectionConfig",
    "budget",
    "toolPermissions",
  ] as const

  // Build update payload
  const updates: Record<string, unknown> = {}
  const changedKeys: string[] = []

  for (const key of allowedKeys) {
    if (key in body) {
      updates[key === "adapterType" ? "adapterType" : key] = body[key]
      changedKeys.push(key)
    }
  }

  // Map camelCase to snake_case for drizzle
  const drizzleUpdates: Record<string, unknown> = {}
  if ("persona" in updates) drizzleUpdates.persona = updates.persona
  if ("model" in updates) drizzleUpdates.model = updates.model
  if ("adapterType" in updates) drizzleUpdates.adapterType = updates.adapterType
  if ("guardrails" in updates) drizzleUpdates.guardrails = updates.guardrails
  if ("dataSources" in updates) drizzleUpdates.dataSources = updates.dataSources
  if ("reportsTo" in updates) drizzleUpdates.reportsTo = updates.reportsTo
  if ("connectionConfig" in updates) drizzleUpdates.connectionConfig = updates.connectionConfig
  if ("budget" in updates) drizzleUpdates.budget = updates.budget
  if ("toolPermissions" in updates) drizzleUpdates.toolPermissions = updates.toolPermissions
  drizzleUpdates.updatedAt = new Date()

  let resultConfig

  if (configRows.length === 0) {
    // Create new config
    const configId = `cfg-${id}-${Date.now()}`
    await db.insert(agentConfigs).values({
      id: configId,
      agentId: id,
      departmentId: agent.departmentId,
      ...drizzleUpdates,
    })

    const inserted = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.id, configId))
      .limit(1)
    resultConfig = inserted[0]
  } else {
    // Update existing config
    const existingConfig = configRows[0]

    // Create revision entry
    const revisionId = `rev-${id}-${Date.now()}`
    await db.insert(agentConfigRevisions).values({
      id: revisionId,
      agentId: id,
      departmentId: agent.departmentId,
      changedKeys,
      beforeConfig: existingConfig as unknown as Record<string, unknown>,
      afterConfig: { ...existingConfig, ...drizzleUpdates } as unknown as Record<string, unknown>,
      changedBy: "admin",
      reason: "Manual config update",
    })

    await db
      .update(agentConfigs)
      .set(drizzleUpdates)
      .where(eq(agentConfigs.id, existingConfig.id))

    const updated = await db
      .select()
      .from(agentConfigs)
      .where(eq(agentConfigs.id, existingConfig.id))
      .limit(1)
    resultConfig = updated[0]
  }

  return NextResponse.json(resultConfig)
}
