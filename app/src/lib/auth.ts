import { cookies } from "next/headers"
import { db } from "@/db"
import { users, sessions } from "@/db/schema"
import { eq } from "drizzle-orm"
import { hashToken } from "@/lib/crypto"

const COOKIE_NAME = "ao_session"

/** Validate the current session from cookies. Returns user or null. */
export async function getSessionUser(): Promise<{
  id: string
  email: string
  name: string
  role: string
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const tokenHashed = hashToken(token)

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHashed))
    .limit(1)

  if (!session || session.expiresAt < new Date()) return null

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  return user || null
}

/** Require auth -- returns user or throws 401 Response. */
export async function requireAuth(): Promise<{
  id: string
  email: string
  name: string
  role: string
}> {
  const user = await getSessionUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  return user
}
