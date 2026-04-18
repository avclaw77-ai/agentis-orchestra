import { NextRequest, NextResponse } from "next/server"
import { BRIDGE_URL, BRIDGE_TOKEN } from "@/lib/constants"
import { getSessionUser } from "@/lib/auth"

// GET /api/logs?limit=100&level=error&source=heartbeat
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const params = new URLSearchParams()
  const limit = req.nextUrl.searchParams.get("limit")
  const level = req.nextUrl.searchParams.get("level")
  const source = req.nextUrl.searchParams.get("source")

  if (limit) params.set("limit", limit)
  if (level) params.set("level", level)
  if (source) params.set("source", source)

  try {
    const res = await fetch(`${BRIDGE_URL}/logs?${params}`, {
      headers: BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {},
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return NextResponse.json({ error: "Bridge error" }, { status: 502 })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ logs: [], total: 0 })
  }
}
