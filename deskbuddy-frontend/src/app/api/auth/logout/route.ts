// src/app/api/auth/logout/route.ts
// Clears the httpOnly auth cookie. Call this on logout.

import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("db-token", "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0, // immediate expiry
  });
  return res;
}
