import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { companySkills, activityLog } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/skills?isActive=true
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const isActive = req.nextUrl.searchParams.get("isActive")

  const conditions = []
  if (isActive !== null) {
    conditions.push(eq(companySkills.isActive, isActive === "true"))
  }

  const rows = await db
    .select()
    .from(companySkills)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(companySkills.updatedAt))
    .limit(200)

  return NextResponse.json(rows)
}

// POST /api/skills -- create a company skill
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { key, name, description, sourceType, sourceRef, definition } = body

  if (!key || !name) {
    return NextResponse.json(
      { error: "key and name are required" },
      { status: 400 }
    )
  }

  const now = new Date()
  const [created] = await db
    .insert(companySkills)
    .values({
      key,
      name,
      description: description || null,
      sourceType: sourceType || "local",
      sourceRef: sourceRef || null,
      definition: definition || {},
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await db.insert(activityLog).values({
    departmentId: null,
    agent: "system",
    action: "skill_created",
    task: key,
    metadata: { name },
  })

  return NextResponse.json(created, { status: 201 })
}

// PATCH /api/skills -- update a skill (bumps version)
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = await req.json()
  const { id, name, description, sourceType, sourceRef, definition, isActive } =
    body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const [current] = await db
    .select()
    .from(companySkills)
    .where(eq(companySkills.id, id))
  if (!current) {
    return NextResponse.json({ error: "skill not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // Bump version on content changes (name, description, definition)
  let shouldBumpVersion = false
  if (name !== undefined) {
    updates.name = name
    shouldBumpVersion = true
  }
  if (description !== undefined) {
    updates.description = description
    shouldBumpVersion = true
  }
  if (definition !== undefined) {
    updates.definition = definition
    shouldBumpVersion = true
  }
  if (sourceType !== undefined) updates.sourceType = sourceType
  if (sourceRef !== undefined) updates.sourceRef = sourceRef
  if (isActive !== undefined) updates.isActive = isActive

  if (shouldBumpVersion) {
    updates.version = (current.version ?? 1) + 1
  }

  await db.update(companySkills).set(updates).where(eq(companySkills.id, id))

  await db.insert(activityLog).values({
    departmentId: null,
    agent: "system",
    action: "skill_updated",
    task: current.key,
    metadata: { name: name || current.name, version: updates.version },
  })

  const [updated] = await db
    .select()
    .from(companySkills)
    .where(eq(companySkills.id, id))
  return NextResponse.json(updated)
}
