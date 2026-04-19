import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { providerKeys } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"

/** GET /api/providers -- list configured providers (no keys exposed) */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const rows = await db.select().from(providerKeys)
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      isValid: r.isValid,
      testedAt: r.testedAt,
      hasKey: true, // never expose actual key
    }))
  )
}

/** POST /api/providers -- add or update a provider API key */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  const body = await req.json()
  const { provider, apiKey } = body

  if (!provider || !apiKey?.trim()) {
    return NextResponse.json({ error: "provider and apiKey required" }, { status: 400 })
  }

  const now = new Date()

  // Check if provider already exists
  const existing = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.provider, provider))
    .limit(1)

  let encrypted: string
  try {
    encrypted = encrypt(apiKey.trim())
  } catch {
    return NextResponse.json({ error: "Encryption configuration error" }, { status: 500 })
  }

  if (existing.length > 0) {
    // Update existing key
    await db
      .update(providerKeys)
      .set({
        apiKeyEncrypted: encrypted,
        isValid: true,
        testedAt: now,
      })
      .where(eq(providerKeys.provider, provider))

    return NextResponse.json({ updated: provider })
  } else {
    // Insert new key
    await db.insert(providerKeys).values({
      provider,
      apiKeyEncrypted: encrypted,
      isValid: true,
      testedAt: now,
    })

    return NextResponse.json({ created: provider })
  }
}

/** DELETE /api/providers -- remove a provider key */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  const body = await req.json()
  const { provider } = body

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 })
  }

  await db.delete(providerKeys).where(eq(providerKeys.provider, provider))
  return NextResponse.json({ deleted: provider })
}
