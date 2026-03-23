/**
 * Tests for shared mood utility functions and constants.
 *
 * These validate the single source of truth in constants/moods.ts so that
 * if a new emotion is added or a mapping changes, tests catch the breakage
 * before it silently corrupts the journal or music pages.
 *
 * Covers:
 *  - getMoodConfig — look-up by emotion / sentiment / unknown
 *  - emotionToMusicMood — all documented emotion mappings
 *  - Completeness: every MUSIC_MOOD has at least one emotion mapping
 */

import { describe, it, expect } from "vitest";
import {
  getMoodConfig,
  emotionToMusicMood,
  MOOD_CONFIG,
  MUSIC_MOODS,
  EMOTION_TO_MUSIC_MOOD,
  EMOTION_KEYWORDS,
  EMOTION_TASKS,
  DEFAULT_HABITS,
} from "@/constants/moods";

// ── getMoodConfig ────────────────────────────────────────────────────────────

describe("getMoodConfig", () => {
  it("returns correct config for a known emotion", () => {
    const cfg = getMoodConfig("anxious");
    expect(cfg.emoji).toBe("😰");
    expect(cfg.color).toBeTruthy();
    expect(cfg.bg).toBeTruthy();
  });

  it("falls back to sentiment when emotion is unrecognised", () => {
    const cfg = getMoodConfig("unknown_emotion", "positive");
    // Should resolve to the "positive" entry in MOOD_CONFIG.
    expect(cfg).toEqual(MOOD_CONFIG["positive"]);
  });

  it("returns default grey config when both emotion and sentiment are unknown", () => {
    const cfg = getMoodConfig("??", "??");
    expect(cfg.emoji).toBe("😶");
    expect(cfg.color).toBe("#292929");
  });

  it("is case-insensitive", () => {
    expect(getMoodConfig("HAPPY")).toEqual(getMoodConfig("happy"));
  });

  it("handles undefined inputs gracefully", () => {
    expect(() => getMoodConfig(undefined, undefined)).not.toThrow();
  });

  it("every MOOD_CONFIG entry has emoji, color, and bg fields", () => {
    for (const [key, cfg] of Object.entries(MOOD_CONFIG)) {
      expect(cfg.emoji,  `${key}.emoji`).toBeTruthy();
      expect(cfg.color,  `${key}.color`).toBeTruthy();
      expect(cfg.bg,     `${key}.bg`).toBeTruthy();
    }
  });
});

// ── emotionToMusicMood ───────────────────────────────────────────────────────

describe("emotionToMusicMood", () => {
  const cases: [string, string][] = [
    ["anxious",     "anxious"],
    ["excited",     "energetic"],
    ["happy",       "happy"],
    ["sad",         "sad"],
    ["calm",        "calm"],
    ["grateful",    "happy"],
    ["overwhelmed", "calm"],
    ["angry",       "energetic"],
    ["hopeful",     "happy"],
    ["neutral",     "focused"],
    ["positive",    "happy"],
    ["negative",    "sad"],
  ];

  it.each(cases)("maps %s → %s", (emotion, expected) => {
    expect(emotionToMusicMood(emotion)).toBe(expected);
  });

  it("returns 'calm' as a safe default for unmapped emotions", () => {
    expect(emotionToMusicMood("flabbergasted")).toBe("calm");
  });

  it("is case-insensitive", () => {
    expect(emotionToMusicMood("HAPPY")).toBe(emotionToMusicMood("happy"));
  });
});

// ── MUSIC_MOODS coverage ─────────────────────────────────────────────────────

describe("EMOTION_TO_MUSIC_MOOD coverage", () => {
  it("every MUSIC_MOOD appears as a value in the mapping", () => {
    const mappedMoods = new Set(Object.values(EMOTION_TO_MUSIC_MOOD));
    for (const mood of MUSIC_MOODS) {
      expect(mappedMoods.has(mood), `music mood "${mood}" has no emotion mapping`).toBe(true);
    }
  });
});

// ── EMOTION_KEYWORDS ─────────────────────────────────────────────────────────

describe("EMOTION_KEYWORDS", () => {
  it("each emotion has at least 3 keywords", () => {
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      expect(keywords.length, `${emotion} keywords`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keywords are all lowercase (for consistent matching)", () => {
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      for (const kw of keywords) {
        expect(kw, `${emotion}: "${kw}" should be lowercase`).toBe(kw.toLowerCase());
      }
    }
  });
});

// ── EMOTION_TASKS ────────────────────────────────────────────────────────────

describe("EMOTION_TASKS", () => {
  it("neutral has a fallback task list", () => {
    expect(EMOTION_TASKS["neutral"].length).toBeGreaterThan(0);
  });

  it("every emotion task is a non-empty string", () => {
    for (const [emotion, tasks] of Object.entries(EMOTION_TASKS)) {
      for (const task of tasks) {
        expect(typeof task, `${emotion} task`).toBe("string");
        expect(task.length, `${emotion} task is empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ── DEFAULT_HABITS ───────────────────────────────────────────────────────────

describe("DEFAULT_HABITS", () => {
  it("has at least 3 habits", () => {
    expect(DEFAULT_HABITS.length).toBeGreaterThanOrEqual(3);
  });

  it("habits are non-empty strings", () => {
    for (const habit of DEFAULT_HABITS) {
      expect(typeof habit).toBe("string");
      expect(habit.length).toBeGreaterThan(0);
    }
  });
});
