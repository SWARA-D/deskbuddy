/**
 * Integration tests: auth enforcement and cross-user data isolation.
 *
 * These tests exercise the journal entries route with JWT_SECRET set,
 * which enables authentication enforcement. Tests generate their own
 * signed JWTs using the same HMAC-SHA256 logic as jwt-server.ts.
 *
 * All tests use future dates (2030+) to avoid collisions with the
 * in-memory store populated by journal-entries.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import { POST, GET } from "@/app/api/journal/entries/route";
import { NextRequest } from "next/server";

// ── Ensure in-memory store path is used ──────────────────────────────────────
// Set DATABASE_URL to a non-empty string so the route skips the "no DB" early
// return, then mock pg so the Pool constructor throws, causing getPool() to
// return null and fall through to the in-memory MEM array.
process.env.DATABASE_URL = "postgresql://fake:fake@127.0.0.1:5432/fake_test_db";

vi.mock("pg", () => {
  return {
    Pool: class {
      constructor() {
        throw new Error("pg mocked — no real DB in tests");
      }
    },
  };
});

// ── JWT test helpers ──────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret-value-must-be-32-chars-x";

function makeTestJWT(userId: string, expiresInSeconds = 3600): string {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  })).toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function expiredJWT(userId: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    iat: Math.floor(Date.now() / 1000) - 7200,
  })).toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

// ── Request factories ─────────────────────────────────────────────────────────

const BASE = "http://localhost/api/journal/entries";

function makePost(body: object, token?: string): NextRequest {
  return new NextRequest(BASE, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeGet(params: Record<string, string>, token?: string): NextRequest {
  const url = new URL(BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    method:  "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
});

// ── Auth enforcement tests ────────────────────────────────────────────────────

describe("auth enforcement (JWT_SECRET set)", () => {
  it("GET returns 401 when no token is provided", async () => {
    const res = await GET(makeGet({ date: "2030-01-01" }));
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when no token is provided", async () => {
    const res = await POST(makePost({ text: "Should not be saved.", date: "2030-01-02" }));
    expect(res.status).toBe(401);
  });

  it("GET returns 401 with an expired token", async () => {
    const token = expiredJWT("a0000000-0000-0000-0000-000000000099");
    const res   = await GET(makeGet({ date: "2030-01-03" }, token));
    expect(res.status).toBe(401);
  });

  it("GET returns 401 with a token signed by a different secret", async () => {
    // Sign with a different secret — should fail signature check
    const header    = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload   = Buffer.from(JSON.stringify({ sub: "a0000000-0000-0000-0000-000000000000", exp: 9999999999, iat: 1 })).toString("base64url");
    const wrongSign = createHmac("sha256", "wrong-secret-completely-different!!")
      .update(`${header}.${payload}`)
      .digest("base64url");
    const forgedToken = `${header}.${payload}.${wrongSign}`;

    const res = await GET(makeGet({ date: "2030-01-04" }, forgedToken));
    expect(res.status).toBe(401);
  });

  it("GET returns 401 with a structurally malformed token", async () => {
    const res = await GET(makeGet({ date: "2030-01-05" }, "not.a.valid.jwt.token.parts"));
    expect(res.status).toBe(401);
  });

  it("POST succeeds with a valid token and returns 201", async () => {
    const userId = "a0000000-0000-0000-0000-000000000001";
    const token  = makeTestJWT(userId);
    const res    = await POST(makePost({ text: "Valid authenticated entry.", date: "2030-02-01" }, token));
    expect(res.status).toBe(201);
  });

  it("GET returns the entry created by its owner", async () => {
    const userId = "a0000000-0000-0000-0000-000000000002";
    const token  = makeTestJWT(userId);
    await POST(makePost({ text: "Owner's own journal entry.", date: "2030-02-02" }, token));

    const res  = await GET(makeGet({ date: "2030-02-02" }, token));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.entry.text).toBe("Owner's own journal entry.");
  });
});

// ── Cross-user isolation tests ────────────────────────────────────────────────

describe("cross-user data isolation", () => {
  const USER_A = "aaaaaaaa-0000-0000-0000-000000000001";
  const USER_B = "bbbbbbbb-0000-0000-0000-000000000002";

  it("user B cannot read user A's journal entry", async () => {
    const tokenA = makeTestJWT(USER_A);
    const tokenB = makeTestJWT(USER_B);

    // User A creates an entry on 2030-03-01
    await POST(makePost({ text: "User A private entry that B should never see.", date: "2030-03-01" }, tokenA));

    // User B requests the same date — must get null, not user A's entry
    const res  = await GET(makeGet({ date: "2030-03-01" }, tokenB));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.entry).toBeNull();
  });

  it("user A cannot overwrite user B's entry on the same date", async () => {
    const tokenA = makeTestJWT(USER_A);
    const tokenB = makeTestJWT(USER_B);

    // Both users create entries on 2030-03-02
    await POST(makePost({ text: "User A entry on 03-02.", date: "2030-03-02" }, tokenA));
    await POST(makePost({ text: "User B entry on 03-02.", date: "2030-03-02" }, tokenB));

    // Each user only sees their own entry
    const resA = await GET(makeGet({ date: "2030-03-02" }, tokenA));
    const resB = await GET(makeGet({ date: "2030-03-02" }, tokenB));

    expect((await resA.json()).entry.text).toBe("User A entry on 03-02.");
    expect((await resB.json()).entry.text).toBe("User B entry on 03-02.");
  });

  it("user B's entry on date X is not visible to user A on the same date", async () => {
    const tokenA = makeTestJWT(USER_A);
    const tokenB = makeTestJWT(USER_B);

    await POST(makePost({ text: "User B exclusive entry.", date: "2030-03-03" }, tokenB));

    // User A has no entry on that date — should not see user B's
    const res  = await GET(makeGet({ date: "2030-03-03" }, tokenA));
    const json = await res.json();
    expect(json.entry).toBeNull();
  });

  it("upsert only updates the authenticated user's own entry", async () => {
    const tokenA = makeTestJWT(USER_A);
    const tokenB = makeTestJWT(USER_B);

    await POST(makePost({ text: "Original entry for user A.", date: "2030-03-04" }, tokenA));
    await POST(makePost({ text: "Original entry for user B.", date: "2030-03-04" }, tokenB));

    // User A updates their own entry
    await POST(makePost({ text: "Updated entry for user A.", date: "2030-03-04" }, tokenA));

    // User B's entry must be unchanged
    const resB  = await GET(makeGet({ date: "2030-03-04" }, tokenB));
    const jsonB = await resB.json();
    expect(jsonB.entry.text).toBe("Original entry for user B.");
  });
});
