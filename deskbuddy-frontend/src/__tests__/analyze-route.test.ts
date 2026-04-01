/**
 * Tests for POST /api/analyze
 *
 * Covers:
 *  - Auth enforcement: JWT_SECRET absent → 503 (fail-closed, CRIT-1)
 *  - Auth enforcement: no token → 401, expired → 401, valid → 200
 *  - Input validation: too-short and too-long text
 *  - Keyword fallback (no API keys set) returns a well-shaped MoodResult
 *  - Module-level response cache: identical text hits the cache (fetch called once)
 *  - Rate limiting: 21st request within 10 min window → 429
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac, randomUUID } from "crypto";
import { POST } from "@/app/api/analyze/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE        = "http://localhost/api/analyze";
const TEST_SECRET = "test-secret-value-must-be-32-chars-x";

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

function makeTestJWT(userId: string, expiresIn = 3600): string {
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000),
  })).toString("base64url");
  const sig = createHmac("sha256", TEST_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

// Shared JWT setup used by most describe blocks
function useTestJwt() {
  const ORIGINAL = process.env.JWT_SECRET;
  beforeEach(() => { process.env.JWT_SECRET = TEST_SECRET; });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL;
  });
}

// ── CRIT-1: fail closed when JWT_SECRET absent ────────────────────────────────

describe("POST /api/analyze — JWT_SECRET absent (fail-closed)", () => {
  const ORIGINAL = process.env.JWT_SECRET;
  beforeEach(() => { delete process.env.JWT_SECRET; });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL;
  });

  it("returns 503 when JWT_SECRET is not configured", async () => {
    const res = await POST(makePost({ text: "Feeling great today!" }));
    expect(res.status).toBe(503);
  });
});

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("POST /api/analyze — auth enforcement", () => {
  useTestJwt();

  it("returns 401 when no token is provided", async () => {
    const res = await POST(makePost({ text: "Feeling great today, full of energy!" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      sub: "a0000000-0000-0000-0000-000000000001",
      exp: 1, iat: 1,
    })).toString("base64url");
    const sig   = createHmac("sha256", TEST_SECRET).update(`${header}.${payload}`).digest("base64url");
    const token = `${header}.${payload}.${sig}`;

    const res = await POST(makePost({ text: "Feeling great today, full of energy!" }, token));
    expect(res.status).toBe(401);
  });

  it("returns 200 with a valid UUID sub token", async () => {
    const token = makeTestJWT(randomUUID());
    const res   = await POST(makePost({ text: "Feeling great today, full of energy and joy!" }, token));
    expect(res.status).toBe(200);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/analyze — input validation", () => {
  useTestJwt();
  let validToken: string;
  beforeEach(() => { validToken = makeTestJWT(randomUUID()); });

  it("returns 400 when text is missing", async () => {
    const res = await POST(makePost({}, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is an empty string", async () => {
    const res = await POST(makePost({ text: "" }, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is shorter than 5 characters after trimming", async () => {
    const res = await POST(makePost({ text: "hi" }, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is only whitespace (< 5 chars after trim)", async () => {
    const res = await POST(makePost({ text: "    " }, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text exceeds 50 000 characters", async () => {
    const res  = await POST(makePost({ text: "a".repeat(50_001) }, validToken));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/too long/i);
  });

  it("accepts text at exactly the 50 000 character limit", async () => {
    // No AI API keys set — keyword fallback runs
    const res = await POST(makePost({ text: "a".repeat(50_000) }, validToken));
    expect(res.status).toBe(200);
  });
});

// ── Keyword fallback ──────────────────────────────────────────────────────────

describe("POST /api/analyze — keyword fallback (no API keys)", () => {
  useTestJwt();
  let validToken: string;
  beforeEach(() => { validToken = makeTestJWT(randomUUID()); });

  it("returns 200 with valid MoodResult shape for a positive entry", async () => {
    const res  = await POST(makePost({ text: "I am feeling really happy and excited about life!" }, validToken));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(["positive", "neutral", "negative"]).toContain(json.sentiment);
    expect(typeof json.emotion).toBe("string");
    expect(json.emotion.length).toBeGreaterThan(0);
    expect(typeof json.confidence).toBe("number");
    expect(json.confidence).toBeGreaterThanOrEqual(0);
    expect(json.confidence).toBeLessThanOrEqual(1);
    expect(typeof json.mood_summary).toBe("string");
  });

  it("returns 200 with valid MoodResult shape for a negative entry", async () => {
    const res  = await POST(makePost({ text: "I am feeling very sad and anxious and terrible." }, validToken));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(["positive", "neutral", "negative"]).toContain(json.sentiment);
  });

  it("does not expose which backend tier handled the request", async () => {
    const res  = await POST(makePost({ text: "Productive day with good results achieved." }, validToken));
    const json = await res.json();

    expect(json).not.toHaveProperty("_source");
    expect(json).not.toHaveProperty("source");
    expect(json).not.toHaveProperty("tier");
  });
});

// ── Module-level response cache ───────────────────────────────────────────────

describe("POST /api/analyze — server-side cache", () => {
  const ORIG_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
  useTestJwt();
  let validToken: string;
  beforeEach(() => { validToken = makeTestJWT(randomUUID()); });

  afterEach(() => {
    if (ORIG_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIG_ANTHROPIC;
    vi.unstubAllGlobals();
  });

  it("returns the same result for identical text (cache hit)", async () => {
    const text = `Cache test entry — unique identifier ${Date.now()}. Great day!`;

    const res1 = await POST(makePost({ text }, validToken));
    const res2 = await POST(makePost({ text }, validToken));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual(await res1.json());
  });

  it("calls the upstream API exactly once for repeated identical text", async () => {
    const mockResult = {
      sentiment: "positive",
      emotion:   "happy",
      confidence: 0.9,
      mood_summary: "Feeling great.",
      habits_to_highlight: [],
      suggested_tasks: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ content: [{ text: JSON.stringify(mockResult) }] }),
    });
    vi.stubGlobal("fetch", mockFetch);
    process.env.ANTHROPIC_API_KEY = "test-key-for-cache-test";

    const text = `Cache upstream test — unique run ${Date.now()}${Math.random()}. Wonderful morning.`;

    const res1 = await POST(makePost({ text }, validToken));
    const res2 = await POST(makePost({ text }, validToken));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns a fresh result for different text (cache miss)", async () => {
    const text1 = `Different entry A — ${Date.now()}. Feeling happy and calm today.`;
    const text2 = `Different entry B — ${Date.now()}. Feeling sad and anxious now.`;

    const res1 = await POST(makePost({ text: text1 }, validToken));
    const res2 = await POST(makePost({ text: text2 }, validToken));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const json1 = await res1.json();
    const json2 = await res2.json();
    expect(json1).toHaveProperty("sentiment");
    expect(json2).toHaveProperty("sentiment");
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("POST /api/analyze — rate limiting (MED-5)", () => {
  useTestJwt();

  it("returns 429 after 20 requests in the same window", async () => {
    // Use a dedicated UUID so this test's bucket is isolated
    const userId = randomUUID();
    const token  = makeTestJWT(userId);
    const text   = "Feeling okay today, nothing special.";

    // First 20 should succeed (keyword fallback, no API keys)
    for (let i = 0; i < 20; i++) {
      const res = await POST(makePost({ text }, token));
      expect(res.status).toBe(200);
    }

    // 21st should be rate-limited
    const limited = await POST(makePost({ text }, token));
    expect(limited.status).toBe(429);
    const json = await limited.json();
    expect(json.error).toMatch(/rate limit/i);
  });
});
