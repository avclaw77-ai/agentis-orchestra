import { NextRequest } from "next/server"
import { BRIDGE_URL, BRIDGE_TOKEN } from "@/lib/constants"
import { getSessionUser } from "@/lib/auth"

export const maxDuration = 300 // 5 min streaming timeout

// POST /api/chat -- proxy to bridge with SSE streaming
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    })
  }

  const body = await req.json()
  const { channel, message, departmentId, conversationId, modelOverride } = body

  if (!channel || !message) {
    return new Response(
      JSON.stringify({ error: "channel and message required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // Proxy to bridge
  let bridgeRes: Response
  try {
    bridgeRes = await fetch(`${BRIDGE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        channel,
        message,
        departmentId: departmentId || null,
        conversationId: conversationId || null,
        modelOverride: modelOverride || null,
      }),
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "Bridge unreachable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!bridgeRes.ok || !bridgeRes.body) {
    return new Response(
      JSON.stringify({ error: `Bridge error: ${bridgeRes.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }

  // Stream through to client
  return new Response(bridgeRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
