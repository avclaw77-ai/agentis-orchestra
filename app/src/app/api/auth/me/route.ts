import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"

/** GET /api/auth/me -- current user profile with department access */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  return NextResponse.json(user)
}
