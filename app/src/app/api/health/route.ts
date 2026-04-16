import { NextResponse } from "next/server"
import { BRIDGE_URL, BRIDGE_TOKEN } from "@/lib/constants"

export async function GET() {
  let bridgeStatus = "unknown"

  try {
    const res = await fetch(`${BRIDGE_URL}/health`, {
      headers: BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {},
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      bridgeStatus = data.status
    } else {
      bridgeStatus = "error"
    }
  } catch {
    bridgeStatus = "unreachable"
  }

  return NextResponse.json({
    status: "ok",
    bridge: bridgeStatus,
    timestamp: new Date().toISOString(),
  })
}
