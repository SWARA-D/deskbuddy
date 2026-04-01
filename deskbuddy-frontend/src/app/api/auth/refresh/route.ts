// src/app/api/auth/refresh/route.ts
// BFF token refresh — reads the httpOnly cookie, exchanges it for a fresh
// JWT with the FastAPI auth service, then sets the new cookie.
// Called automatically by auth.tsx ~2 minutes before the current token expires.

import { NextRequest, NextResponse } from "next/server";

const API_URL     = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const COOKIE_NAME = "db-token";
const MAX_AGE_SECS = 60 * 60; // 1 hour — matches auth service config

const COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   MAX_AGE_SECS,
};

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/auth/refresh`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ access_token: token }),
    });
  } catch {
    return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
  }

  const data = await upstream.json();
  const res  = NextResponse.json(data, { status: upstream.status });

  if (upstream.ok && data?.data?.access_token) {
    res.cookies.set(COOKIE_NAME, data.data.access_token, COOKIE_BASE);
  }

  return res;
}
