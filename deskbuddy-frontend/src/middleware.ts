import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Routes that never require authentication
const PUBLIC_PATHS = ["/login"];

// Prefixes always allowed through (Next.js internals + API routes)
// API routes enforce their own JWT checks — middleware only guards page navigation.
const ALWAYS_PUBLIC = ["/_next", "/favicon", "/api/"];

// Derive the API hostname from the public env var at startup
function getApiHost(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://deskbuddy-api.onrender.com";
  try {
    return new URL(apiUrl).hostname;
  } catch {
    return "deskbuddy-api.onrender.com";
  }
}

/**
 * Build a per-request Content-Security-Policy that includes a nonce.
 *
 * Including 'nonce-{nonce}' alongside 'unsafe-inline' gives a migration
 * path: CSP Level 2+ browsers ignore 'unsafe-inline' when a nonce is
 * present, so they require the nonce on every inline script.  Older
 * browsers fall back to 'unsafe-inline'.  Once the root layout propagates
 * the nonce to all inline <script> tags, 'unsafe-inline' can be removed.
 */
function buildCsp(nonce: string): string {
  const isDev   = process.env.NODE_ENV === "development";
  const apiHost = getApiHost();

  return [
    "default-src 'self'",
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://open.spotify.com`
      : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://open.spotify.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://${apiHost} https://open.spotify.com https://api.spotify.com https://accounts.spotify.com https://api-inference.huggingface.co https://api.anthropic.com`,
    "img-src 'self' data: blob: https://i.scdn.co https://res.cloudinary.com",
    "frame-src https://open.spotify.com",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Always-public paths — let through immediately ──────────────────────
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── 2. Generate a per-request nonce ────────────────────────────────────────
  const nonce = Buffer.from(randomUUID()).toString("base64");

  // Set nonce on the REQUEST so Server Components can read it via headers().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // ── 3. Auth enforcement ────────────────────────────────────────────────────
  const token = request.cookies.get("db-token")?.value;

  let response: NextResponse;

  if (PUBLIC_PATHS.includes(pathname)) {
    // Already authenticated — redirect home
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── 4. Attach nonce + CSP to the response ─────────────────────────────────
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
