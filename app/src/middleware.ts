import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/api/auth", "/api/setup", "/api/health", "/setup", "/login"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next()
  }

  // Check setup completion via cookie (set by setup API on completion)
  const setupDone = req.cookies.get("ao_setup_done")?.value === "1"
  const hasSession = !!req.cookies.get("ao_session")?.value

  // No setup cookie -- could be first run OR cookie cleared after rebuild
  // Redirect to /login which will check DB and either show login or redirect to /setup
  if (!setupDone) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Setup not completed" }, { status: 503 })
    }
    if (pathname !== "/setup" && !pathname.startsWith("/setup") && pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    return NextResponse.next()
  }

  // Set up but not authenticated -> redirect to login
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
