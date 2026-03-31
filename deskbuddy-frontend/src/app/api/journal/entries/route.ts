// src/app/api/journal/entries/route.ts
// GET  /api/journal/entries?date=YYYY-MM-DD  — fetch single entry for a date
// POST /api/journal/entries                  — upsert entry for a given date
//
// DB: Postgres via DATABASE_URL env var
// Falls back to in-memory store if DATABASE_URL not set (dev preview)

import { NextRequest, NextResponse } from "next/server";
import { randomUUID }                from "crypto";
import { extractUserFromRequest }     from "@/lib/jwt-server";

// ── In-memory fallback (dev only) ───────────────────────────────────────────
if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production. Set it in your environment.");
}

type DBEntry = {
  id: string;
  user_id: string;
  text: string;
  input_type: string;
  created_at: string;
  sentiment?: string;
  emotion?: string;
  confidence?: number;
  mood_summary?: string;
};

const MEM: DBEntry[] = [];

// ── Postgres helper ─────────────────────────────────────────────────────────
// Pool is created once per process and reused across requests.
// Creating a new Pool on every request would exhaust database connections.
let _pool: import("pg").Pool | null = null;

async function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (_pool) return _pool;
  try {
    const { Pool } = await import("pg");
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return _pool;
  } catch {
    return null;
  }
}

// ── GET — fetch entry for a specific date ────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD

    // When JWT_SECRET is configured (production), require a valid token.
    // In local dev without JWT_SECRET the route falls back to "local-user".
    const payload = extractUserFromRequest(req);
    if (process.env.JWT_SECRET && !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user_id = payload?.sub ?? "local-user";

    if (!date) {
      return NextResponse.json({ error: "date param required" }, { status: 400 });
    }

    const pool = await getPool();

    if (pool) {
      const { rows } = await pool.query(
        `SELECT id, user_id, text, input_type, created_at,
                sentiment, emotion, confidence, mood_summary
         FROM journal_entries
         WHERE user_id = $1 AND created_at::date = $2::date
         ORDER BY created_at DESC LIMIT 1`,
        [user_id, date]
      );

      return NextResponse.json({ entry: rows[0] ?? null });
    }

    // in-memory fallback
    const entry = MEM.find(
      (e) => e.user_id === user_id && e.created_at.slice(0, 10) === date
    ) ?? null;
    return NextResponse.json({ entry });

  } catch (err) {
    console.error("GET /api/journal/entries:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — upsert entry for a date ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth check — same rule as GET
    const payload = extractUserFromRequest(req);
    if (process.env.JWT_SECRET && !payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      text?: string;
      input_type?: string;
      date?: string;          // YYYY-MM-DD — which day this entry belongs to
      sentiment?: string;
      emotion?: string;
      confidence?: number;
      mood_summary?: string;
    };

    const text       = (body.text ?? "").trim();
    const input_type = body.input_type ?? "typed";
    const user_id    = payload?.sub ?? "local-user";
    // Use the provided date or fall back to today.
    const entryDate  = body.date ?? new Date().toISOString().slice(0, 10);

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (text.length > 50_000) {
      return NextResponse.json({ error: "Text too long (50 000 character limit)" }, { status: 400 });
    }

    const pool = await getPool();

    if (pool) {
      // Check if entry already exists for this date.
      const { rows: existing } = await pool.query(
        `SELECT id FROM journal_entries
         WHERE user_id = $1 AND created_at::date = $2::date
         LIMIT 1`,
        [user_id, entryDate]
      );

      if (existing.length > 0) {
        // Update existing entry.
        const { rows } = await pool.query(
          `UPDATE journal_entries
           SET text=$1, input_type=$2, sentiment=$3, emotion=$4,
               confidence=$5, mood_summary=$6
           WHERE id=$7
           RETURNING *`,
          [text, input_type,
           body.sentiment ?? null, body.emotion ?? null,
           body.confidence ?? null, body.mood_summary ?? null,
           existing[0].id]
        );
  
        return NextResponse.json({ success: true, entry: rows[0] }, { status: 200 });
      }

      // Insert new entry with the correct date.
      const id         = randomUUID();
      const created_at = `${entryDate}T12:00:00.000Z`;
      await pool.query(
        `INSERT INTO journal_entries
           (id, user_id, text, input_type, created_at, sentiment, emotion, confidence, mood_summary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, user_id, text, input_type, created_at,
         body.sentiment ?? null, body.emotion ?? null,
         body.confidence ?? null, body.mood_summary ?? null]
      );

      const entry: DBEntry = { id, user_id, text, input_type, created_at,
        sentiment: body.sentiment, emotion: body.emotion,
        confidence: body.confidence, mood_summary: body.mood_summary };
      return NextResponse.json({ success: true, entry }, { status: 201 });
    }

    // ── in-memory upsert ───────────────────────────────────────────────────
    const existingIdx = MEM.findIndex(
      (e) => e.user_id === user_id && e.created_at.slice(0, 10) === entryDate
    );

    if (existingIdx >= 0) {
      MEM[existingIdx] = {
        ...MEM[existingIdx],
        text, input_type,
        sentiment:    body.sentiment   ?? MEM[existingIdx].sentiment,
        emotion:      body.emotion     ?? MEM[existingIdx].emotion,
        confidence:   body.confidence  ?? MEM[existingIdx].confidence,
        mood_summary: body.mood_summary ?? MEM[existingIdx].mood_summary,
      };
      return NextResponse.json({ success: true, entry: MEM[existingIdx] }, { status: 200 });
    }

    const id         = randomUUID();
    const created_at = `${entryDate}T12:00:00.000Z`;
    const entry: DBEntry = {
      id, user_id, text, input_type, created_at,
      sentiment:    body.sentiment,
      emotion:      body.emotion,
      confidence:   body.confidence,
      mood_summary: body.mood_summary,
    };
    MEM.unshift(entry);
    return NextResponse.json({ success: true, entry }, { status: 201 });

  } catch (err) {
    console.error("POST /api/journal/entries:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
