import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { departments } from "@/db/schema"
import { eq } from "drizzle-orm"

/** GET /api/departments -- list all departments */
export async function GET() {
  const rows = await db.select().from(departments)
  return NextResponse.json(rows)
}

/** POST /api/departments -- create a department */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, name, description, color, template } = body

  if (!id || !name) {
    return NextResponse.json({ error: "id and name required" }, { status: 400 })
  }

  await db.insert(departments).values({
    id,
    name: name.trim(),
    description: description?.trim() || null,
    color: color || "#3b82f6",
    template: template || null,
  })

  return NextResponse.json({ created: id }, { status: 201 })
}
