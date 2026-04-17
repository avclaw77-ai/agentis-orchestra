import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { chatMessages } from "@/db/schema"
import { eq, desc, and, lt } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"

// GET /api/chat/messages?channel=cio&limit=50&before=123
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const channel = req.nextUrl.searchParams.get("channel")
  const conversationId = req.nextUrl.searchParams.get("conversationId")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)
  const before = req.nextUrl.searchParams.get("before")

  if (!channel) {
    return NextResponse.json(
      { error: "channel is required" },
      { status: 400 }
    )
  }

  try {
    const conditions = [eq(chatMessages.channel, channel)]

    if (conversationId) {
      conditions.push(eq(chatMessages.conversationId, conversationId))
    }

    if (before) {
      conditions.push(lt(chatMessages.id, parseInt(before, 10)))
    }

    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(Math.min(limit, 100) + 1) // fetch one extra to check hasMore

    const hasMore = rows.length > limit
    const messages = rows.slice(0, limit).reverse() // reverse to chronological order

    return NextResponse.json({ messages, hasMore })
  } catch (err) {
    console.error("[api/chat/messages] Error:", err)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}
