/**
 * Tests for POST /api/auth/refresh
 *
 * Covers:
 *  - No httpOnly cookie present → 401
 *  - Upstream auth service unreachable → 503
 *  - Upstream returns a non-OK status → passes through the status code
 *  - Successful refresh → returns access_token, sets a new httpOnly cookie
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { POST } from "@/app/api/auth/refresh/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = "http://localhost/api/auth/refresh";

/** Build a NextRequest with an optional db-token cookie. */
function makeRefreshRequest(cookieToken?: string): NextRequest {
  return new NextRequest(BASE, {
    method:  "POST",
    headers: cookieToken ? { Cookie: `db-token=${cookieToken}` } : {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── No cookie ─────────────────────────────────────────────────────────────────

describe("POST /api/auth/refresh — no cookie", () => {
  it("returns 401 when no db-token cookie is present", async () => {
    const res  = await POST(makeRefreshRequest());
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toBeTruthy();
  });
});

// ── Upstream unreachable ──────────────────────────────────────────────────────

describe("POST /api/auth/refresh — upstream unreachable", () => {
  it("returns 503 when the auth service throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));

    const res  = await POST(makeRefreshRequest("some-existing-token"));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toMatch(/unavailable/i);
  });
});

// ── Upstream error passthrough ────────────────────────────────────────────────

describe("POST /api/auth/refresh — upstream error passthrough", () => {
  it("passes through 401 when the upstream rejects the token as expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok:     false,
      status: 401,
      json:   async () => ({ detail: "Session expired, please log in again" }),
    }));

    const res  = await POST(makeRefreshRequest("expired-token"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.detail).toMatch(/expired/i);
  });

  it("passes through 400 for a structurally invalid token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok:     false,
      status: 400,
      json:   async () => ({ detail: "Invalid token" }),
    }));

    const res = await POST(makeRefreshRequest("not-a-real-jwt"));
    expect(res.status).toBe(400);
  });
});

// ── Successful refresh ────────────────────────────────────────────────────────

describe("POST /api/auth/refresh — successful refresh", () => {
  const FRESH_TOKEN = "new.fresh.jwt.access.token.string";

  it("returns the new access_token in the response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok:     true,
      status: 200,
      json:   async () => ({
        success:     true,
        data:        { access_token: FRESH_TOKEN, expires_in: 3600 },
        message:     "Token refreshed",
        status_code: 200,
      }),
    }));

    const res  = await POST(makeRefreshRequest("valid-existing-token"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.access_token).toBe(FRESH_TOKEN);
  });

  it("sets a new httpOnly cookie containing the refreshed token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok:     true,
      status: 200,
      json:   async () => ({
        success: true,
        data:    { access_token: FRESH_TOKEN, expires_in: 3600 },
      }),
    }));

    const res = await POST(makeRefreshRequest("valid-existing-token"));

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("db-token=");
    expect(setCookie).toContain(FRESH_TOKEN);
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("calls the correct upstream refresh endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:     true,
      status: 200,
      json:   async () => ({ success: true, data: { access_token: FRESH_TOKEN } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await POST(makeRefreshRequest("some-token"));

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toMatch(/\/auth\/refresh$/);
    expect(calledInit.method).toBe("POST");

    const sentBody = JSON.parse(calledInit.body as string);
    expect(sentBody.access_token).toBe("some-token");
  });
});
