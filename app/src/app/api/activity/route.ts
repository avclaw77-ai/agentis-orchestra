import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { activityLog } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"

// GET /api/activity?departmentId=eng&limit=20&action=task_created
export async function GET(req: NextRequest) {
  const departmentId = req.nextUrl.searchParams.get("departmentId")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)
  const action = req.nextUrl.searchParams.get("action")

  try {
    const conditions = []

    if (departmentId) {
      conditions.push(eq(activityLog.departmentId, departmentId))
    }
    if (action) {
      conditions.push(eq(activityLog.action, action))
    }

    const rows = await db
      .select()
      .from(activityLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityLog.createdAt))
      .limit(Math.min(limit, 100))

    return NextResponse.json(rows)
  } catch (err) {
    console.error("[api/activity] Error:", err)
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    )
  }
}
