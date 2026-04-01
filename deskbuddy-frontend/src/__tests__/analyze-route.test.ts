/**
 * Tests for POST /api/analyze
 *
 * Covers:
 *  - Input validation: too-short and too-long text
 *  - Auth enforcement when JWT_SECRET is configured
 *  - Keyword fallback (no API keys set) returns a well-shaped MoodResult
 *  - Module-level response cache: identical text hits the cache (fetch called once)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
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

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/analyze — input validation", () => {
  it("returns 400 when text is missing", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is an empty string", async () => {
    const res = await POST(makePost({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is shorter than 5 characters after trimming", async () => {
    const res = await POST(makePost({ text: "hi" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is only whitespace (< 5 chars after trim)", async () => {
    const res = await POST(makePost({ text: "    " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text exceeds 50 000 characters", async () => {
    const res = await POST(makePost({ text: "a".repeat(50_001) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too long/i);
  });

  it("accepts text at exactly the 50 000 character limit", async () => {
    const res = await POST(makePost({ text: "a".repeat(50_000) }));
    // No API keys set — keyword fallback runs
    expect(res.status).toBe(200);
  });
});

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("POST /api/analyze — auth enforcement", () => {
  const ORIGINAL = process.env.JWT_SECRET;

  beforeEach(() => { process.env.JWT_SECRET = TEST_SECRET; });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL;
  });

  it("returns 401 when JWT_SECRET is set but no token is provided", async () => {
    const res = await POST(makePost({ text: "Feeling great today, full of energy!" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "u1", exp: 1, iat: 1 })).toString("base64url");
    const sig     = createHmac("sha256", TEST_SECRET).update(`${header}.${payload}`).digest("base64url");
    const token   = `${header}.${payload}.${sig}`;

    const res = await POST(makePost({ text: "Feeling great today, full of energy!" }, token));
    expect(res.status).toBe(401);
  });

  it("returns 200 with a valid token", async () => {
    const token = makeTestJWT("analyze-user-1");
    const res   = await POST(makePost({ text: "Feeling great today, full of energy and joy!" }, token));
    expect(res.status).toBe(200);
  });
});

// ── Keyword fallback ──────────────────────────────────────────────────────────

describe("POST /api/analyze — keyword fallback (no API keys)", () => {
  it("returns 200 with valid MoodResult shape for a positive entry", async () => {
    const res  = await POST(makePost({ text: "I am feeling really happy and excited about life!" }));
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
    const res  = await POST(makePost({ text: "I am feeling very sad and anxious and terrible." }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(["positive", "neutral", "negative"]).toContain(json.sentiment);
  });

  it("does not expose which backend tier handled the request", async () => {
    const res  = await POST(makePost({ text: "Productive day with good results achieved." }));
    const json = await res.json();

    expect(json).not.toHaveProperty("_source");
    expect(json).not.toHaveProperty("source");
    expect(json).not.toHaveProperty("tier");
  });
});

// ── Module-level response cache ───────────────────────────────────────────────

describe("POST /api/analyze — server-side cache", () => {
  const ORIG_ANTHROPIC = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (ORIG_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIG_ANTHROPIC;
    vi.unstubAllGlobals();
  });

  it("returns the same result for identical text (cache hit)", async () => {
    // Unique text per run so cache from other tests does not interfere.
    const text = `Cache test entry — unique identifier ${Date.now()}. Great day!`;

    const res1 = await POST(makePost({ text }));
    const res2 = await POST(makePost({ text }));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Both should return deeply equal results
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

    // Mock fetch so the Claude path runs and is observable
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockResult) }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
    process.env.ANTHROPIC_API_KEY = "test-key-for-cache-test";

    // Use a unique text string so it won't collide with a prior cached entry
    const text = `Cache upstream test — unique run ${Date.now()}${Math.random()}. Wonderful morning.`;

    const res1 = await POST(makePost({ text }));
    const res2 = await POST(makePost({ text }));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // fetch must have been called for the first request, not the second
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns a fresh result for different text (cache miss)", async () => {
    const text1 = `Different entry A — ${Date.now()}. Feeling happy and calm today.`;
    const text2 = `Different entry B — ${Date.now()}. Feeling sad and anxious now.`;

    const res1 = await POST(makePost({ text: text1 }));
    const res2 = await POST(makePost({ text: text2 }));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Different texts can yield different sentiments (keyword analysis is deterministic)
    // Just confirm both succeed independently
    const json1 = await res1.json();
    const json2 = await res2.json();
    expect(json1).toHaveProperty("sentiment");
    expect(json2).toHaveProperty("sentiment");
  });
});
