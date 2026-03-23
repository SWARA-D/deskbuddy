// src/app/api/journal/entries/route.ts
// GET  /api/journal/entries?date=YYYY-MM-DD  — fetch single entry for a date
// POST /api/journal/entries                  — upsert entry for a given date
//
// DB: Postgres via DATABASE_URL env var
// Falls back to in-memory store if DATABASE_URL not set (dev preview)

import { NextRequest, NextResponse } from "next/server";
import { randomUUID }                from "crypto";

// ── In-memory fallback ──────────────────────────────────────────────────────
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
async function getPool() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { Pool } = await import("pg");
    return new Pool({ connectionString: process.env.DATABASE_URL });
  } catch {
    return null;
  }
}

// ── GET — fetch entry for a specific date ────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date    = searchParams.get("date"); // YYYY-MM-DD
    const user_id = req.headers.get("x-user-id") ?? "local-user";

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
      await pool.end();
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
    const user_id    = req.headers.get("x-user-id") ?? "local-user";
    // Use the provided date or fall back to today.
    const entryDate  = body.date ?? new Date().toISOString().slice(0, 10);

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const pool = await getPool();

    if (pool) {
      // Ensure analysis columns exist.
      await pool.query(`
        ALTER TABLE journal_entries
          ADD COLUMN IF NOT EXISTS sentiment    VARCHAR(20),
          ADD COLUMN IF NOT EXISTS emotion      VARCHAR(32),
          ADD COLUMN IF NOT EXISTS confidence   FLOAT,
          ADD COLUMN IF NOT EXISTS mood_summary TEXT
      `).catch(() => {});

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
        await pool.end();
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
      await pool.end();
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
