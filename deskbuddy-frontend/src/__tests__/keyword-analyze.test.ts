/**
 * Tests for the keyword-based mood analysis fallback.
 *
 * These are pure-function unit tests — no HTTP, no Next.js, no database.
 * They run fast and validate the analysis that fires when no AI API key
 * is configured.
 *
 * Covers:
 *  - Smoke: basic positive / negative / neutral detection
 *  - Edge cases: empty text, very short text, mixed signals, case-insensitivity
 */

import { describe, it, expect } from "vitest";
import { keywordAnalyze } from "@/lib/keyword-analyze";

// ── Smoke tests ──────────────────────────────────────────────────────────────

describe("keywordAnalyze — smoke tests", () => {
  it("returns a valid MoodResult shape for any non-empty text", () => {
    const result = keywordAnalyze("I had a great and wonderful day today!");
    expect(result).toMatchObject({
      sentiment:           expect.stringMatching(/^positive|neutral|negative$/),
      emotion:             expect.any(String),
      confidence:          expect.any(Number),
      mood_summary:        expect.any(String),
      habits_to_highlight: expect.any(Array),
      suggested_tasks:     expect.any(Array),
    });
  });

  it("detects a happy / positive entry", () => {
    const result = keywordAnalyze("I feel happy and wonderful, great things happened today.");
    expect(result.sentiment).toBe("positive");
    expect(result.emotion).toBe("happy");
  });

  it("detects an anxious / negative entry", () => {
    const result = keywordAnalyze("I'm so anxious and stressed about the exam, I keep panicking.");
    expect(result.sentiment).toBe("negative");
    expect(result.emotion).toBe("anxious");
  });

  it("detects a sad / negative entry", () => {
    const result = keywordAnalyze("I feel so sad and lonely today, I miss my friends.");
    expect(result.sentiment).toBe("negative");
    expect(result.emotion).toBe("sad");
  });

  it("detects a calm / positive entry", () => {
    const result = keywordAnalyze("Feeling peaceful and calm, everything is serene today.");
    expect(result.sentiment).toBe("positive");
    expect(result.emotion).toBe("calm");
  });

  it("detects a grateful entry", () => {
    const result = keywordAnalyze("So grateful and thankful for all the blessings in my life.");
    expect(result.sentiment).toBe("positive");
    expect(result.emotion).toBe("grateful");
  });

  it("returns suggested tasks for the detected emotion", () => {
    const result = keywordAnalyze("I am so excited about this new opportunity!");
    expect(result.suggested_tasks.length).toBeGreaterThan(0);
    expect(result.suggested_tasks[0]).toBeTypeOf("string");
  });
});

// ── Confidence scoring ───────────────────────────────────────────────────────

describe("keywordAnalyze — confidence scoring", () => {
  it("returns lower confidence when no keywords match", () => {
    const result = keywordAnalyze("Today I did some stuff and things happened.");
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it("returns higher confidence with more keyword matches", () => {
    const single   = keywordAnalyze("I felt anxious.");
    const multiple = keywordAnalyze("I felt anxious and nervous and worried and stressed.");
    expect(multiple.confidence).toBeGreaterThan(single.confidence);
  });

  it("caps confidence at 0.85 regardless of keyword count", () => {
    const result = keywordAnalyze(
      "anxious nervous worried stressed anxiety panic scared fear anxious"
    );
    expect(result.confidence).toBeLessThanOrEqual(0.85);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("keywordAnalyze — edge cases", () => {
  it("returns neutral emotion when no keywords are found", () => {
    const result = keywordAnalyze("The sky is blue and the grass is green.");
    expect(result.emotion).toBe("neutral");
    expect(result.sentiment).toBe("neutral");
  });

  it("is case-insensitive (HAPPY === happy)", () => {
    const lower = keywordAnalyze("i feel happy today");
    const upper = keywordAnalyze("I FEEL HAPPY TODAY");
    expect(lower.emotion).toBe(upper.emotion);
  });

  it("handles single-word text without throwing", () => {
    // The route rejects very short text, but the pure function should not throw.
    expect(() => keywordAnalyze("sad")).not.toThrow();
  });

  it("handles mixed positive/negative signals — picks highest hit count", () => {
    // Three anxious keywords vs one happy keyword.
    const result = keywordAnalyze("I am anxious nervous worried but also happy.");
    expect(result.emotion).toBe("anxious");
  });

  it("always returns a non-empty mood_summary", () => {
    const result = keywordAnalyze("xyz abc 123 completely unrecognised words");
    expect(result.mood_summary.length).toBeGreaterThan(0);
  });

  it("always returns at least one suggested task", () => {
    const result = keywordAnalyze("xyz abc completely unrecognised words here");
    expect(result.suggested_tasks.length).toBeGreaterThan(0);
  });

  it("always includes Journaling in habits_to_highlight", () => {
    const result = keywordAnalyze("Just a normal day writing in my journal.");
    expect(result.habits_to_highlight).toContain("Journaling");
  });
});
