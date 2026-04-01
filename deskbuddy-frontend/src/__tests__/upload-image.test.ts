/**
 * Tests for POST /api/upload/image
 *
 * Covers:
 *  - Auth enforcement when JWT_SECRET is configured
 *  - Input validation: missing data, non-image data URL, oversized payload
 *  - Cloudinary-not-configured → 503 (graceful degradation)
 *  - Per-user rate limiting: 11th upload in the same window → 429
 *  - Successful upload (mocked Cloudinary) returns { url, public_id }
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac, randomUUID } from "crypto";
import { POST } from "@/app/api/upload/image/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE        = "http://localhost/api/upload/image";
const TEST_SECRET = "test-secret-value-must-be-32-chars-x";

// Minimal valid JPEG data URL (1×1 pixel, well under size limit)
const VALID_DATA_URL = "data:image/jpeg;base64," + "A".repeat(200);

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

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe("POST /api/upload/image — auth enforcement", () => {
  const ORIGINAL = process.env.JWT_SECRET;

  beforeEach(() => { process.env.JWT_SECRET = TEST_SECRET; });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL;
  });

  it("returns 401 when JWT_SECRET is set but no token provided", async () => {
    const res = await POST(makePost({ data: VALID_DATA_URL }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "u1", exp: 1, iat: 1 })).toString("base64url");
    const sig     = createHmac("sha256", TEST_SECRET).update(`${header}.${payload}`).digest("base64url");
    const token   = `${header}.${payload}.${sig}`;

    const res = await POST(makePost({ data: VALID_DATA_URL }, token));
    expect(res.status).toBe(401);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/upload/image — input validation", () => {
  // JWT_SECRET must be set and a valid token provided (CRIT-1 fail-closed)
  const ORIGINAL_JWT = process.env.JWT_SECRET;
  let validToken: string;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    validToken = makeTestJWT(randomUUID());
  });
  afterEach(() => {
    if (ORIGINAL_JWT === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_JWT;
  });

  it("returns 400 when body is missing the data field", async () => {
    const res = await POST(makePost({}, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a plain text string (not a data URL)", async () => {
    const res = await POST(makePost({ data: "not-a-data-url" }, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-image data URL", async () => {
    const res = await POST(makePost({ data: "data:text/html;base64,PHNjcmlwdD4=" }, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty data field", async () => {
    const res = await POST(makePost({ data: "" }, validToken));
    expect(res.status).toBe(400);
  });

  it("returns 413 when the data URL exceeds 10 MB", async () => {
    // 10 MB + 1 byte of padding to trigger the limit
    const huge = "data:image/jpeg;base64," + "A".repeat(10 * 1024 * 1024 + 1);
    const res  = await POST(makePost({ data: huge }, validToken));
    expect(res.status).toBe(413);
  });
});

// ── Cloudinary not configured ─────────────────────────────────────────────────

describe("POST /api/upload/image — Cloudinary not configured", () => {
  const ORIG_NAME    = process.env.CLOUDINARY_CLOUD_NAME;
  const ORIG_KEY     = process.env.CLOUDINARY_API_KEY;
  const ORIG_SECRET  = process.env.CLOUDINARY_API_SECRET;
  const ORIGINAL_JWT = process.env.JWT_SECRET;

  beforeEach(() => {
    // Auth must be configured (CRIT-1 fail-closed); Cloudinary creds absent
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });
  afterEach(() => {
    if (ORIGINAL_JWT  !== undefined) process.env.JWT_SECRET             = ORIGINAL_JWT;  else delete process.env.JWT_SECRET;
    if (ORIG_NAME     !== undefined) process.env.CLOUDINARY_CLOUD_NAME  = ORIG_NAME;     else delete process.env.CLOUDINARY_CLOUD_NAME;
    if (ORIG_KEY      !== undefined) process.env.CLOUDINARY_API_KEY     = ORIG_KEY;      else delete process.env.CLOUDINARY_API_KEY;
    if (ORIG_SECRET   !== undefined) process.env.CLOUDINARY_API_SECRET  = ORIG_SECRET;   else delete process.env.CLOUDINARY_API_SECRET;
  });

  it("returns 503 with a descriptive error when credentials are missing", async () => {
    const token = makeTestJWT(randomUUID());
    const res   = await POST(makePost({ data: VALID_DATA_URL }, token));
    const json  = await res.json();
    expect(res.status).toBe(503);
    expect(json.error).toMatch(/not configured/i);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("POST /api/upload/image — rate limiting", () => {
  // Use a unique per-run UUID so the rate-limit bucket is fresh every run
  // (the Map is module-level and persists within a process).
  const RATE_USER = randomUUID();
  const ORIGINAL_JWT = process.env.JWT_SECRET;

  beforeEach(() => { process.env.JWT_SECRET = TEST_SECRET; });
  afterEach(() => {
    if (ORIGINAL_JWT === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_JWT;
    vi.unstubAllGlobals();
  });

  it("allows up to 10 uploads per user per hour then returns 429", async () => {
    const token = makeTestJWT(RATE_USER);

    // Cloudinary env vars are absent → each upload returns 503 (after the rate
    // check passes), which lets us exhaust the bucket without mocking Cloudinary.
    for (let i = 0; i < 10; i++) {
      const res = await POST(makePost({ data: VALID_DATA_URL }, token));
      expect(res.status).toBe(503); // Cloudinary not configured — rate limit NOT hit yet
    }

    // 11th request — rate limit exceeded
    const eleventh = await POST(makePost({ data: VALID_DATA_URL }, token));
    expect(eleventh.status).toBe(429);
    const json = await eleventh.json();
    expect(json.error).toMatch(/limit/i);
  });
});

// ── Successful upload (mocked Cloudinary) ────────────────────────────────────

describe("POST /api/upload/image — successful upload", () => {
  const ORIG_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
  const ORIG_KEY    = process.env.CLOUDINARY_API_KEY;
  const ORIG_SECRET = process.env.CLOUDINARY_API_SECRET;

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME  = "test-cloud";
    process.env.CLOUDINARY_API_KEY     = "test-api-key";
    process.env.CLOUDINARY_API_SECRET  = "test-api-secret";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/deskbuddy/abc123.jpg",
        public_id:  "deskbuddy/abc123",
      }),
    }));
  });
  afterEach(() => {
    if (ORIG_NAME   !== undefined) process.env.CLOUDINARY_CLOUD_NAME  = ORIG_NAME;   else delete process.env.CLOUDINARY_CLOUD_NAME;
    if (ORIG_KEY    !== undefined) process.env.CLOUDINARY_API_KEY     = ORIG_KEY;    else delete process.env.CLOUDINARY_API_KEY;
    if (ORIG_SECRET !== undefined) process.env.CLOUDINARY_API_SECRET  = ORIG_SECRET; else delete process.env.CLOUDINARY_API_SECRET;
    vi.unstubAllGlobals();
  });

  it("returns { url, public_id } on a successful Cloudinary upload", async () => {
    // Use a fresh UUID so the rate limit bucket is empty
    const user  = randomUUID();
    const token = makeTestJWT(user);
    process.env.JWT_SECRET = TEST_SECRET;

    const res  = await POST(makePost({ data: VALID_DATA_URL }, token));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    // INFO-2: public_id is intentionally not returned to the client
    expect(json.public_id).toBeUndefined();

    delete process.env.JWT_SECRET;
  });

  it("POSTs to the correct Cloudinary URL with the cloud name", async () => {
    const capturedFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        secure_url: "https://res.cloudinary.com/test-cloud/image/upload/test.jpg",
        public_id:  "deskbuddy/test",
      }),
    });
    vi.stubGlobal("fetch", capturedFetch);

    const user  = randomUUID();
    const token = makeTestJWT(user);
    process.env.JWT_SECRET = TEST_SECRET;

    await POST(makePost({ data: VALID_DATA_URL }, token));

    const [calledUrl] = capturedFetch.mock.calls[0] as [string];
    expect(calledUrl).toContain("test-cloud");
    expect(calledUrl).toContain("image/upload");

    delete process.env.JWT_SECRET;
  });
});
