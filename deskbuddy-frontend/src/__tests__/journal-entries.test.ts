/**
 * Tests for the journal entries API route (in-memory store mode).
 *
 * The route has two operating modes:
 *
 *  A. DATABASE_URL set but unreachable (pg import fails → Pool is null → in-memory MEM array)
 *     This is how the main suite runs — we set DATABASE_URL to a fake value so the
 *     route skips the "no DB" early-return, attempts to load pg, fails, and falls
 *     through to the MEM array.  Full CRUD semantics work.
 *
 *  B. DATABASE_URL absent
 *     GET  → 200 { entry: null }   (NOT 503)
 *     POST → 200 { success: true, entry: null }   (NOT 503)
 *     The frontend falls back to localStorage; 200 is the correct silent ack.
 *     Tested in the "no-database mode" describe block below.
 *
 * Current API shape:
 *  - GET  /api/journal/entries?date=YYYY-MM-DD  → { entry: DBEntry | null }
 *  - POST /api/journal/entries                  → upsert by date
 *    body: { text, input_type?, date?, sentiment?, emotion?, confidence?, mood_summary? }
 *    201 on insert, 200 on update, 400 if text is missing/empty
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST, GET } from "@/app/api/journal/entries/route";
import { NextRequest } from "next/server";

// ── Module-level DATABASE_URL setup ───────────────────────────────────────────
// Set a fake DATABASE_URL so the route skips the "no DB" early-return and falls
// through to the in-memory MEM array.
// We also mock `pg` so `new Pool(...)` always throws — this causes getPool()
// to catch the error and return null, which triggers the MEM in-memory path.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = "http://localhost/api/journal/entries";

function makePost(body: object): NextRequest {
  return new NextRequest(BASE, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeGet(params?: Record<string, string>): NextRequest {
  const url = new URL(BASE);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { method: "GET" });
}

const TODAY = new Date().toISOString().slice(0, 10);

// ── POST — create / upsert ────────────────────────────────────────────────────

describe("POST /api/journal/entries", () => {
  it("returns 201 with entry data on first insert", async () => {
    const res  = await POST(makePost({ text: "Today was a productive and meaningful day.", date: "2026-01-01" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.entry.text).toBe("Today was a productive and meaningful day.");
    expect(json.entry.id).toBeTruthy();
    expect(json.entry.created_at).toBeTruthy();
  });

  it("returns 200 on upsert (same date, same user)", async () => {
    const date = "2026-02-01";
    await POST(makePost({ text: "First version of the entry.", date }));
    const res  = await POST(makePost({ text: "Updated version of the entry.", date }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entry.text).toBe("Updated version of the entry.");
  });

  it("returns 400 when text is missing", async () => {
    const res = await POST(makePost({ date: TODAY }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is an empty string", async () => {
    const res = await POST(makePost({ text: "", date: TODAY }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is only whitespace", async () => {
    const res = await POST(makePost({ text: "   ", date: TODAY }));
    expect(res.status).toBe(400);
  });

  it("trims leading and trailing whitespace from text", async () => {
    const res  = await POST(makePost({ text: "   Nice sunny morning today.   ", date: "2026-03-01" }));
    const json = await res.json();
    expect(json.entry.text).toBe("Nice sunny morning today.");
  });

  it("assigns a unique id to each distinct-date entry", async () => {
    const r1 = await POST(makePost({ text: "Entry for day one, good progress made.", date: "2026-04-01" }));
    const r2 = await POST(makePost({ text: "Entry for day two, learning a lot.", date: "2026-04-02" }));
    const j1 = await r1.json();
    const j2 = await r2.json();
    expect(j1.entry.id).not.toBe(j2.entry.id);
  });

  it("saves mood metadata when provided", async () => {
    const res  = await POST(makePost({
      text:         "Feeling really anxious about the presentation tomorrow.",
      date:         "2026-05-01",
      sentiment:    "negative",
      emotion:      "anxious",
      confidence:   0.82,
      mood_summary: "Worried about upcoming event.",
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.entry.sentiment).toBe("negative");
    expect(json.entry.emotion).toBe("anxious");
    expect(json.entry.confidence).toBe(0.82);
    expect(json.entry.mood_summary).toBe("Worried about upcoming event.");
  });

  it("upsert preserves mood metadata update", async () => {
    const date = "2026-06-01";
    await POST(makePost({ text: "Feeling okay today.", date }));
    const res  = await POST(makePost({
      text:      "Feeling okay today.",
      date,
      sentiment: "positive",
      emotion:   "calm",
    }));
    const json = await res.json();
    expect(json.entry.sentiment).toBe("positive");
    expect(json.entry.emotion).toBe("calm");
  });

  it("defaults input_type to 'typed' when not provided", async () => {
    const res  = await POST(makePost({ text: "Just a quick note today.", date: "2026-07-01" }));
    const json = await res.json();
    expect(json.entry.input_type).toBe("typed");
  });

  it("stores the provided date in created_at, not today", async () => {
    const date = "2025-12-25";
    const res  = await POST(makePost({ text: "Christmas day reflection and gratitude.", date }));
    const json = await res.json();
    expect(json.entry.created_at).toContain("2025-12-25");
  });
});

// ── GET — fetch by date ───────────────────────────────────────────────────────

describe("GET /api/journal/entries", () => {
  it("returns 400 when date param is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(400);
  });

  it("returns { entry: null } for a date with no entry", async () => {
    const res  = await GET(makeGet({ date: "2000-01-01" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.entry).toBeNull();
  });

  it("returns the saved entry for a specific date (round-trip)", async () => {
    const date = "2026-08-15";
    await POST(makePost({ text: "A beautiful summer day full of energy.", date }));
    const res  = await GET(makeGet({ date }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entry).not.toBeNull();
    expect(json.entry.text).toBe("A beautiful summer day full of energy.");
  });

  it("GET returns the latest upserted text after an update", async () => {
    const date = "2026-09-01";
    await POST(makePost({ text: "First draft of the entry.", date }));
    await POST(makePost({ text: "Revised and improved version of entry.", date }));

    const res  = await GET(makeGet({ date }));
    const json = await res.json();
    expect(json.entry.text).toBe("Revised and improved version of entry.");
  });

  it("returns entries for different dates independently", async () => {
    const dateA = "2026-10-01";
    const dateB = "2026-10-02";
    await POST(makePost({ text: "October first entry, crisp autumn morning.", date: dateA }));
    await POST(makePost({ text: "October second entry, rainy afternoon walk.", date: dateB }));

    const resA = await GET(makeGet({ date: dateA }));
    const resB = await GET(makeGet({ date: dateB }));
    expect((await resA.json()).entry.text).toBe("October first entry, crisp autumn morning.");
    expect((await resB.json()).entry.text).toBe("October second entry, rainy afternoon walk.");
  });

  it("returned entry includes mood metadata when it was saved", async () => {
    const date = "2026-11-01";
    await POST(makePost({
      text:         "Had a great productive day, feeling accomplished.",
      date,
      sentiment:    "positive",
      emotion:      "happy",
      confidence:   0.91,
      mood_summary: "Feeling accomplished after a productive day.",
    }));

    const res  = await GET(makeGet({ date }));
    const json = await res.json();
    expect(json.entry.sentiment).toBe("positive");
    expect(json.entry.emotion).toBe("happy");
    expect(json.entry.confidence).toBe(0.91);
  });
});

// ── No-database (DATABASE_URL absent) behaviour ───────────────────────────────
// When DATABASE_URL is not set the route must return 200, not 503.
// The 200 is a silent acknowledgement so the frontend falls back to localStorage
// without displaying an error to the user.

describe("no-database mode (DATABASE_URL absent)", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    // Restore the fake DB URL used by the main suite
    process.env.DATABASE_URL = "postgresql://fake:fake@localhost:5432/fake_test_db";
  });

  it("GET returns 200 (not 503) when DATABASE_URL is not set", async () => {
    const res = await GET(makeGet({ date: "2099-01-01" }));
    expect(res.status).toBe(200);
  });

  it("GET returns { entry: null } when DATABASE_URL is not set", async () => {
    const res  = await GET(makeGet({ date: "2099-01-02" }));
    const json = await res.json();
    expect(json.entry).toBeNull();
  });

  it("POST returns 200 (not 503) when DATABASE_URL is not set", async () => {
    const res = await POST(makePost({ text: "Today was a fine day overall.", date: "2099-02-01" }));
    expect(res.status).toBe(200);
  });

  it("POST returns { success: true, entry: null } when DATABASE_URL is not set", async () => {
    const res  = await POST(makePost({ text: "Another quiet evening at home.", date: "2099-02-02" }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.entry).toBeNull();
  });

  it("POST still returns 400 when text is missing (validation runs before DB check)", async () => {
    const res = await POST(makePost({ date: "2099-02-03" }));
    expect(res.status).toBe(400);
  });
});
