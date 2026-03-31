// src/app/api/auth/login/route.ts
// BFF proxy: forwards login to FastAPI, then sets an httpOnly cookie with the JWT.
// The browser never needs to read the token from JavaScript — the cookie is
// sent automatically on every same-origin request.

import { NextRequest, NextResponse } from "next/server";

const API_URL      = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const COOKIE_NAME  = "db-token";
const MAX_AGE_SECS = 60 * 60; // 1 hour — matches FastAPI access_token_expire_minutes

const COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path:     "/",
  maxAge:   MAX_AGE_SECS,
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
  }

  const data = await upstream.json();
  const res  = NextResponse.json(data, { status: upstream.status });

  if (upstream.ok && data?.data?.tokens?.access_token) {
    res.cookies.set(COOKIE_NAME, data.data.tokens.access_token, COOKIE_BASE);
  }

  return res;
}
