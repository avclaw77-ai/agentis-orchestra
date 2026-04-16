import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { decisions } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

// GET /api/decisions -- list decisions, newest first
export async function GET(req: NextRequest) {
  const departmentId = req.nextUrl.searchParams.get("departmentId")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)
  const safeLimit = Math.min(limit, 200)

  const rows = departmentId
    ? await db
        .select()
        .from(decisions)
        .where(eq(decisions.departmentId, departmentId))
        .orderBy(desc(decisions.createdAt))
        .limit(safeLimit)
    : await db
        .select()
        .from(decisions)
        .orderBy(desc(decisions.createdAt))
        .limit(safeLimit)

  return NextResponse.json(rows)
}
