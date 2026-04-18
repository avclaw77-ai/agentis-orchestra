import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { agents, agentConfigs, personaProposals, personaVersions } from "@/db/schema"
import { eq, desc, and, count } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/agents/[id]/proposals -- list proposals (filter by status)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const status = req.nextUrl.searchParams.get("status")
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10))
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)))
  const offset = (page - 1) * limit

  // Validate agent exists
  const [agent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, id)).limit(1)
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

  const conditions = [eq(personaProposals.agentId, id)]
  const validStatuses = ["pending", "approved", "rejected", "deferred"]
  if (status && validStatuses.includes(status)) {
    conditions.push(eq(personaProposals.status, status))
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions)

  const [items, [total]] = await Promise.all([
    db
      .select()
      .from(personaProposals)
      .where(where)
      .orderBy(desc(personaProposals.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(personaProposals)
      .where(where),
  ])

  return NextResponse.json({
    items,
    total: total?.count ?? 0,
    page,
    limit,
  })
}

// POST /api/agents/[id]/proposals -- create a proposal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Validate agent exists
  const [agent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, id)).limit(1)
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

  const { proposalType, section, currentValue, proposedValue, reasoning, confidence, source, evidenceCount } = body

  if (!proposalType || proposedValue === undefined || !reasoning || !source) {
    return NextResponse.json(
      { error: "proposalType, proposedValue, reasoning, and source are required" },
      { status: 400 }
    )
  }

  const [inserted] = await db
    .insert(personaProposals)
    .values({
      agentId: id,
      proposalType,
      section: section || null,
      currentValue: currentValue || null,
      proposedValue,
      reasoning,
      confidence: confidence || "medium",
      source,
      evidenceCount: evidenceCount || 1,
    })
    .returning()

  return NextResponse.json(inserted, { status: 201 })
}

// PATCH /api/agents/[id]/proposals -- approve/reject/defer a proposal
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id: agentId } = await params
  const body = await req.json()

  const { id, status, decidedBy } = body

  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 })
  }

  const validStatuses = ["approved", "rejected", "deferred"]
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    )
  }

  // Fetch the proposal
  const [proposal] = await db
    .select()
    .from(personaProposals)
    .where(and(eq(personaProposals.id, id), eq(personaProposals.agentId, agentId)))
    .limit(1)

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  }

  // Update proposal status
  const [updated] = await db
    .update(personaProposals)
    .set({
      status,
      decidedBy: decidedBy || user.id,
      decidedAt: new Date(),
    })
    .where(eq(personaProposals.id, id))
    .returning()

  // If approved and persona-related, auto-apply the change
  if (status === "approved" && proposal.section) {
    const personaSections = ["role", "priorities", "guardrails", "tone", "tools", "hierarchy"]
    if (personaSections.includes(proposal.section)) {
      // Get current config persona text
      const [config] = await db
        .select({ persona: agentConfigs.persona })
        .from(agentConfigs)
        .where(eq(agentConfigs.agentId, agentId))
        .limit(1)

      const currentPersona = config?.persona || ""
      // Append the approved change as a new line/section
      const updatedPersona = currentPersona
        ? `${currentPersona}\n\n## ${proposal.section} (auto-applied)\n${proposal.proposedValue}`
        : proposal.proposedValue

      // Update agentConfigs
      await db
        .update(agentConfigs)
        .set({ persona: updatedPersona, updatedAt: new Date() })
        .where(eq(agentConfigs.agentId, agentId))

      // Create a new persona version
      const [latest] = await db
        .select({ version: personaVersions.version })
        .from(personaVersions)
        .where(eq(personaVersions.agentId, agentId))
        .orderBy(desc(personaVersions.version))
        .limit(1)

      const nextVersion = (latest?.version ?? 0) + 1

      await db.insert(personaVersions).values({
        agentId,
        version: nextVersion,
        personaText: updatedPersona,
        changeSummary: `Proposal #${id} approved: ${proposal.proposalType} on ${proposal.section}`,
        changeSource: "refinement_engine",
        approvedBy: user.id,
      })
    }
  }

  return NextResponse.json(updated)
}
