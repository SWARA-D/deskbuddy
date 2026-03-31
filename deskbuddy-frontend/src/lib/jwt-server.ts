/**
 * Server-only JWT verifier.
 * Uses Node's built-in crypto — never import this in client components.
 *
 * Verifies HS256 JWTs produced by the FastAPI auth_service using the shared
 * JWT_SECRET env var. No external dependencies required.
 */
import { createHmac, timingSafeEqual } from "crypto";

export interface JWTPayload {
  sub: string;  // user UUID
  exp: number;  // unix timestamp
  iat: number;  // issued-at unix timestamp
}

/**
 * Verifies an HS256 JWT against JWT_SECRET.
 * Throws an Error if the token is missing, malformed, expired, or has an invalid signature.
 */
export function verifyJWT(token: string | null | undefined): JWTPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  if (!token)  throw new Error("No token provided");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const [header, payload, signature] = parts;

  // Recompute the expected HMAC-SHA256 signature
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "base64url");
  const expBuf = Buffer.from(expected, "base64url");

  // Constant-time comparison prevents timing-oracle attacks
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid signature");
  }

  const decoded = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  ) as JWTPayload;

  if (!decoded.sub) throw new Error("Missing sub claim");
  if (!decoded.exp || Math.floor(Date.now() / 1000) > decoded.exp) {
    throw new Error("Token expired");
  }

  return decoded;
}

/**
 * Extracts and verifies the JWT from an `Authorization: Bearer <token>` header.
 *
 * Returns the verified payload, or null if the header is absent or the token is invalid.
 */
export function extractUser(authHeader: string | null): JWTPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return verifyJWT(authHeader.slice(7));
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the user from an incoming Next.js API request.
 *
 * Priority:
 *   1. httpOnly `db-token` cookie (set by /api/auth/login BFF route — XSS-proof)
 *   2. `Authorization: Bearer <token>` header (fallback for dev / API clients)
 *
 * Use this in every protected Next.js API route instead of reading the
 * Authorization header directly.
 */
export function extractUserFromRequest(req: import("next/server").NextRequest): JWTPayload | null {
  // 1. httpOnly cookie — preferred; cannot be read or stolen by client-side JS
  const cookieToken = req.cookies.get("db-token")?.value ?? null;
  if (cookieToken) {
    const payload = extractUser(`Bearer ${cookieToken}`);
    if (payload) return payload;
  }
  // 2. Authorization header fallback (dev environment, direct API clients)
  return extractUser(req.headers.get("authorization"));
}
