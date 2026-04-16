import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { users, userDepartments } from "@/db/schema"
import { eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"
import { hashPassword } from "@/lib/crypto"

/** GET /api/users -- list all users with department assignments */
export async function GET() {
  const allUsers = await db.select().from(users)

  const result = await Promise.all(
    allUsers.map(async (u) => {
      const depts = await db
        .select({ departmentId: userDepartments.departmentId })
        .from(userDepartments)
        .where(eq(userDepartments.userId, u.id))

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        departmentIds: depts.map((d) => d.departmentId),
        createdAt: u.createdAt,
      }
    })
  )

  return NextResponse.json(result)
}

/** POST /api/users -- create a new user (admin only) */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, name, password, role, departmentIds } = body

  if (!email || !name || !password) {
    return NextResponse.json({ error: "email, name, and password required" }, { status: 400 })
  }

  const validRole = ["admin", "member", "viewer"].includes(role) ? role : "member"
  const userId = generateId("user")
  const passwordHashed = await hashPassword(password)

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash: passwordHashed,
    name: name.trim(),
    role: validRole,
  })

  // Assign departments
  if (Array.isArray(departmentIds) && departmentIds.length > 0) {
    for (const deptId of departmentIds) {
      await db.insert(userDepartments).values({
        userId,
        departmentId: deptId,
      })
    }
  }

  return NextResponse.json({ id: userId, email, name, role: validRole }, { status: 201 })
}
