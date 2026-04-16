import { NextResponse } from "next/server"
import { BRIDGE_URL, BRIDGE_TOKEN } from "@/lib/constants"

// GET /api/models -- fetch model registry + provider status from bridge
export async function GET() {
  try {
    const res = await fetch(`${BRIDGE_URL}/models`, {
      headers: BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {},
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }

    return NextResponse.json(
      { error: "Bridge unavailable", providers: [], models: [] },
      { status: 502 }
    )
  } catch {
    return NextResponse.json(
      { error: "Bridge unreachable", providers: [], models: [] },
      { status: 502 }
    )
  }
}
