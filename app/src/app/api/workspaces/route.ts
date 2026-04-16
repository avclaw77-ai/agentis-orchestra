import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { departments } from "@/db/schema"
import { eq } from "drizzle-orm"

// GET /api/departments (formerly /api/workspaces)
export async function GET() {
  const rows = await db.select().from(departments)
  return NextResponse.json(rows)
}

// POST /api/departments -- create department
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, name, description, color, template } = body

  if (!id || !name) {
    return NextResponse.json(
      { error: "id and name are required" },
      { status: 400 }
    )
  }

  await db.insert(departments).values({
    id,
    name,
    description: description || null,
    color: color || "#3b82f6",
    template: template || null,
  })

  return NextResponse.json({ created: id }, { status: 201 })
}

// DELETE /api/departments?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  await db.delete(departments).where(eq(departments.id, id))
  return NextResponse.json({ deleted: id })
}
