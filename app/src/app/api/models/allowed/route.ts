import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { company } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

interface AllowedModel {
  id: string          // model ID in our registry (e.g., "openai:gpt-5.4")
  provider: string    // which provider to use (e.g., "openai", "openrouter")
  name: string        // display name
}

// GET /api/models/allowed -- list allowed models for the org
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const [co] = await db.select().from(company).where(eq(company.id, "default")).limit(1)
  const settings = (co?.settings || {}) as Record<string, unknown>
  const allowedModels = (settings.allowedModels || []) as AllowedModel[]

  return NextResponse.json({ allowedModels })
}

// PUT /api/models/allowed -- replace the full allowed models list (admin only)
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const body = await req.json()
  const { allowedModels } = body

  if (!Array.isArray(allowedModels)) {
    return NextResponse.json({ error: "allowedModels must be an array" }, { status: 400 })
  }

  // Update company settings
  const [co] = await db.select().from(company).where(eq(company.id, "default")).limit(1)
  const currentSettings = (co?.settings || {}) as Record<string, unknown>

  await db
    .update(company)
    .set({
      settings: { ...currentSettings, allowedModels },
      updatedAt: new Date(),
    })
    .where(eq(company.id, "default"))

  return NextResponse.json({ allowedModels, count: allowedModels.length })
}
