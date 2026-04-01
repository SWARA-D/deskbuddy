/**
 * POST /api/analyze
 *
 * Mood analysis with a three-tier fallback chain:
 *   1. Claude API (best quality, structured JSON)
 *   2. HuggingFace Mistral-7B (decent quality, free tier)
 *   3. Keyword analysis (always works, no API key needed)
 *
 * The fallback tier used is intentionally not exposed in the response.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { keywordAnalyze } from "@/lib/keyword-analyze";
import { extractUserFromRequest } from "@/lib/jwt-server";
import type { MoodResult } from "@/types";

// ── Server-side analysis cache ───────────────────────────────────────────────
// Keyed by SHA-256 of the trimmed input text.  Prevents re-calling Claude or
// HuggingFace for identical texts (e.g. repeated autosave triggers).
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _analysisCache = new Map<string, { result: MoodResult; expiresAt: number }>();

// Evict expired entries every 10 minutes to prevent unbounded memory growth.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of _analysisCache) {
      if (now >= val.expiresAt) _analysisCache.delete(key);
    }
  }, 10 * 60 * 1000);
}

// ── Claude API (primary) ────────────────────────────────────────────────────

/**
 * Sends the journal text to Claude Haiku and parses the JSON mood result.
 * Throws on any non-200 response or malformed JSON.
 */
async function claudeAnalyze(text: string): Promise<MoodResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a mood analysis assistant for a wellness journaling app called DeskBuddy.
Analyze this journal entry and respond ONLY with valid JSON. No explanation, no markdown fences.

Return exactly this JSON:
{
  "sentiment": "positive" or "neutral" or "negative",
  "emotion": "one word only: calm, anxious, excited, sad, angry, happy, hopeful, overwhelmed, grateful, or neutral",
  "confidence": number 0.0-1.0,
  "mood_summary": "one sentence max 12 words describing their emotional state",
  "habits_to_highlight": ["1 to 3 items from: Morning Water, Read 10 mins, Meditation, No Sugar, Stretch, Exercise, Journaling, Sleep Early"],
  "suggested_tasks": ["2 to 3 short actionable tasks max 8 words each tailored to this mood"]
}

Journal entry:
"""
${text}
"""`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}`);

  const data  = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");
  return JSON.parse(match[0]) as MoodResult;
}

// ── HuggingFace fallback (secondary) ────────────────────────────────────────

/**
 * Uses Mistral-7B via HuggingFace Inference API as a free fallback.
 * Throws "HF_LOADING" when the model is cold-starting (503 from HF).
 */
async function hfAnalyze(text: string): Promise<MoodResult> {
  // Mistral instruction-following prompt formatted as the model expects.
  const prompt = `<s>[INST]
You are a mood analysis assistant. Analyze this journal entry and respond ONLY with valid JSON, no markdown.

Return exactly:
{"sentiment":"positive|neutral|negative","emotion":"calm|anxious|excited|sad|angry|happy|hopeful|overwhelmed|grateful|neutral","confidence":0.0,"mood_summary":"one sentence","habits_to_highlight":["Journaling"],"suggested_tasks":["one task"]}

Journal entry: """${text}"""
[/INST]`;

  const res = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({
        inputs:     prompt,
        parameters: { max_new_tokens: 300, temperature: 0.3, return_full_text: false },
      }),
    }
  );

  // HuggingFace returns 503 while the model is warming up — surface this to
  // the client so it can show a "try again in 20s" message.
  if (res.status === 503) throw new Error("HF_LOADING");
  if (!res.ok)            throw new Error(`HF API ${res.status}`);

  const data = await res.json();
  const raw: string = Array.isArray(data)
    ? data[0]?.generated_text ?? ""
    : data?.generated_text    ?? "";

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in HF response");
  return JSON.parse(match[0]) as MoodResult;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Require auth when JWT_SECRET is configured (production).
    // Protects against anonymous abuse of the AI API budget.
    if (process.env.JWT_SECRET && !extractUserFromRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text = "" } = (await req.json()) as { text?: string };

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 5) {
      return NextResponse.json({ error: "Entry too short" }, { status: 400 });
    }
    if (text.length > 50_000) {
      return NextResponse.json({ error: "Text too long (50 000 character limit)" }, { status: 400 });
    }

    // Check the server-side cache before hitting any AI API
    const cacheKey = createHash("sha256").update(trimmed).digest("hex");
    const cached   = _analysisCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.result);
    }

    // Helper to cache and return a result
    const cacheAndReturn = (result: MoodResult) => {
      _analysisCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return NextResponse.json(result);
    };

    // 1. Try Claude (requires ANTHROPIC_API_KEY).
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const result = await claudeAnalyze(trimmed);
        return cacheAndReturn(result);
      } catch (e) {
        console.warn("Claude analyze failed, falling back to HF:", e instanceof Error ? e.message : "unknown error");
      }
    }

    // 2. Try HuggingFace (requires HUGGINGFACE_API_KEY).
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        const result = await hfAnalyze(trimmed);
        return cacheAndReturn(result);
      } catch (e) {
        if (e instanceof Error && e.message === "HF_LOADING") {
          return NextResponse.json(
            { error: "Model warming up. Try again in 20 seconds." },
            { status: 503 }
          );
        }
        console.warn("HF analyze failed, falling back to keywords:", e instanceof Error ? e.message : "unknown error");
      }
    }

    // 3. Keyword fallback — always works, no API key needed.
    const result = keywordAnalyze(trimmed);
    return cacheAndReturn(result);

  } catch (err) {
    console.error("analyze route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
