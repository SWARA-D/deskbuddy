/**
 * Keyword-based mood analysis — zero external dependencies.
 *
 * This is the final fallback in the analysis chain (Claude → HuggingFace →
 * keyword). It always returns a result so the journal UI never fails silently.
 * Extracted into its own module so it can be unit-tested independently of
 * the Next.js route handler.
 */

import {
  EMOTION_KEYWORDS,
  EMOTION_TASKS,
  POSITIVE_EMOTIONS,
  NEGATIVE_EMOTIONS,
  DEFAULT_HABITS,
} from "@/constants/moods";
import type { MoodResult } from "@/types";

/**
 * Scan `text` for emotion keyword matches and return a structured MoodResult.
 *
 * Strategy:
 *  1. Lowercase the text and count keyword hits per emotion category.
 *  2. Pick the category with the most hits (ties go to the first matched).
 *  3. Derive sentiment from the winning emotion.
 *  4. Confidence scales with hit count (capped at 0.85).
 */
export function keywordAnalyze(text: string): MoodResult {
  const lower = text.toLowerCase();

  let detected = "neutral";
  let maxHits  = 0;

  // Use word-boundary matching for single words, substring for phrases.
  // This prevents e.g. "mad" matching inside "made" or "bad" inside "badly".
  const matchesKeyword = (kw: string) =>
    kw.includes(" ")
      ? lower.includes(kw)
      : new RegExp(`\\b${kw}\\b`).test(lower);

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    const hits = keywords.filter(matchesKeyword).length;
    if (hits > maxHits) {
      maxHits  = hits;
      detected = emotion;
    }
  }

  const sentiment = POSITIVE_EMOTIONS.has(detected)
    ? "positive"
    : NEGATIVE_EMOTIONS.has(detected)
    ? "negative"
    : "neutral";

  return {
    sentiment,
    emotion:    detected,
    // Confidence grows with hit count but never exceeds 0.85 for keyword mode.
    confidence: maxHits > 0 ? Math.min(0.5 + maxHits * 0.1, 0.85) : 0.45,
    mood_summary: `You seem to be feeling ${detected} today.`,
    // Always suggest journaling alongside mood-specific habits.
    habits_to_highlight: ["Journaling", ...DEFAULT_HABITS.slice(0, 2)],
    suggested_tasks: EMOTION_TASKS[detected] ?? EMOTION_TASKS["neutral"],
  };
}
