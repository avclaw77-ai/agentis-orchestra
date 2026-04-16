import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { users, sessions } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
} from "@/lib/crypto"
import { generateId } from "@/lib/utils"

const SESSION_DAYS = 30
const COOKIE_NAME = "ao_session"

/** POST /api/auth -- login or create first user */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, email, password, name } = body

  if (action === "register") {
    // Only allow registration if no users exist (first-run setup)
    const existing = await db.select().from(users).limit(1)
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Registration disabled. Users already exist." },
        { status: 403 }
      )
    }

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "email, password, and name required" },
        { status: 400 }
      )
    }

    const passwordHashed = await hashPassword(password)
    const userId = generateId("user")

    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash: passwordHashed,
      name: name.trim(),
      role: "admin",
    })

    // Auto-login after registration
    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

    await db.insert(sessions).values({
      id: generateId("sess"),
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    })

    const response = NextResponse.json({ user: { id: userId, email, name, role: "admin" } }, { status: 201 })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    })
    return response
  }

  if (action === "login") {
    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 })
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

    await db.insert(sessions).values({
      id: generateId("sess"),
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    })

    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    })
    return response
  }

  if (action === "logout") {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (token) {
      await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
    }
    const response = NextResponse.json({ ok: true })
    response.cookies.delete(COOKIE_NAME)
    return response
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

/** GET /api/auth -- check current session */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1)

  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user })
}
