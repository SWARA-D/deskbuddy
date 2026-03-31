// src/app/api/auth/register/route.ts
// BFF proxy: forwards registration to FastAPI and sets the httpOnly auth cookie.

import { NextRequest, NextResponse } from "next/server";

const API_URL      = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const COOKIE_NAME  = "db-token";
const MAX_AGE_SECS = 60 * 60;

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
    upstream = await fetch(`${API_URL}/auth/register`, {
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
