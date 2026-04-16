import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { users, userDepartments } from "@/db/schema"
import { eq, and } from "drizzle-orm"

/** GET /api/users/:id -- single user with departments */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const depts = await db
    .select({ departmentId: userDepartments.departmentId })
    .from(userDepartments)
    .where(eq(userDepartments.userId, id))

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentIds: depts.map((d) => d.departmentId),
  })
}

/** PATCH /api/users/:id -- update role and/or department assignments */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { role, departmentIds, name } = body

  // Update user fields
  const updates: Record<string, unknown> = {}
  if (role && ["admin", "member", "viewer"].includes(role)) updates.role = role
  if (name) updates.name = name.trim()

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, id))
  }

  // Update department assignments if provided
  if (Array.isArray(departmentIds)) {
    // Remove all existing assignments
    await db.delete(userDepartments).where(eq(userDepartments.userId, id))
    // Add new ones
    for (const deptId of departmentIds) {
      await db.insert(userDepartments).values({ userId: id, departmentId: deptId })
    }
  }

  return NextResponse.json({ updated: id })
}

/** DELETE /api/users/:id -- delete user */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.delete(users).where(eq(users.id, id))
  return NextResponse.json({ deleted: id })
}
