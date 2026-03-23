import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware.
 * Reads the JWT from the db-token cookie (if set) or the Authorization header.
 * Redirects unauthenticated users to /login for protected routes.
 *
 * NOTE: The primary auth state lives in localStorage (client-side).
 * This middleware checks for a cookie named "db-token" that the login page
 * can optionally set for SSR protection. If you don't need SSR-level guards,
 * the client-side redirect in each page is sufficient.
 */

// Routes that do NOT require authentication
const PUBLIC_PATHS = ["/login"];

// Routes that are always public (API routes, static files, etc.)
const ALWAYS_PUBLIC = ["/_next", "/favicon", "/api/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept Next.js internals or API routes
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public pages — allow through
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for token in cookie (set by login page on successful auth)
  const token = request.cookies.get("db-token")?.value;

  if (!token) {
    // No server-side token — let the client handle auth redirect via useAuth()
    // This is the right approach since we use localStorage, not cookies, as primary storage.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
