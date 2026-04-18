import { NextRequest, NextResponse } from "next/server"
import { BRIDGE_URL, BRIDGE_TOKEN } from "@/lib/constants"
import { getSessionUser } from "@/lib/auth"

// POST /api/agents/[id]/refine -- trigger refinement engine
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

  const { id } = await params

  try {
    const res = await fetch(`${BRIDGE_URL}/agents/${id}/refine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(90_000), // refinement can take a while
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: data.error || `Bridge error: ${res.status}` },
        { status: res.status }
      )
    }

    return NextResponse.json(await res.json())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refinement failed" },
      { status: 500 }
    )
  }
}
