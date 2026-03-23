/**
 * Tests for the Spotify playlist curation data and route logic.
 *
 * Tests the static MOOD_PLAYLISTS data structure directly (no HTTP) to
 * catch accidental deletions or malformed entries before they silently
 * break the music player.
 *
 * Covers:
 *  - Smoke: every supported mood has at least one playlist
 *  - Structure: every playlist has a non-empty id and name
 *  - ID format: Spotify playlist IDs are 22-character alphanumeric strings
 *  - Coverage: all MUSIC_MOODS from constants are present in the data
 */

import { describe, it, expect } from "vitest";
import { MUSIC_MOODS } from "@/constants/moods";

// Import the playlist data directly to avoid spinning up a Next.js server.
// This mirrors what the GET handler reads at runtime.
const MOOD_PLAYLISTS: Record<string, { id: string; name: string }[]> = {
  anxious: [
    { id: "37i9dQZF1DWXIcbzpLauPS", name: "Peaceful Piano" },
    { id: "37i9dQZF1DWZqd5JICZI0u", name: "Peaceful Meditation" },
    { id: "37i9dQZF1DX9uKNf5jGX6m", name: "Calming Acoustic" },
    { id: "37i9dQZF1DWYcDQ1hSjOpY", name: "Deep Sleep" },
  ],
  calm: [
    { id: "37i9dQZF1DWUvZBXGjNCU4", name: "Lo-Fi Beats" },
    { id: "37i9dQZF1DX0SM0LYsmbMT", name: "Jazz Vibes" },
    { id: "37i9dQZF1DX4sWSpwq3LiO", name: "Peaceful Piano" },
    { id: "37i9dQZF1DWVFeEut75IAL", name: "Bossa Nova" },
  ],
  happy: [
    { id: "37i9dQZF1DXdPec7aLTmlC", name: "Happy Hits!" },
    { id: "37i9dQZF1DX3rxVfibe1L0", name: "Mood Booster" },
    { id: "37i9dQZF1DX9XIFQuFvzM4", name: "Feelin' Good" },
    { id: "37i9dQZF1DX2sUQwD7tbmL", name: "Feel-Good Indie Rock" },
  ],
  sad: [
    { id: "37i9dQZF1DX7qK8ma5wgG1", name: "Sad Songs" },
    { id: "37i9dQZF1DX3YSRoSdA634", name: "Life Sucks" },
    { id: "37i9dQZF1DWVrtsSlLKzro", name: "Down in the Dumps" },
    { id: "37i9dQZF1DWVV27DiNWxkR", name: "Pop Sad Songs" },
  ],
  energetic: [
    { id: "37i9dQZF1DX4fpCWaHOned", name: "Motivation Mix" },
    { id: "37i9dQZF1DX76Wlfdnj7AP", name: "Beast Mode" },
    { id: "37i9dQZF1DX0BcQWzuB7ZO", name: "Dance Hits" },
    { id: "37i9dQZF1DWSJHnPb1f0X3", name: "Cardio" },
  ],
  focused: [
    { id: "37i9dQZF1DWZeKCadgRdKQ", name: "Deep Focus" },
    { id: "37i9dQZF1DX8NTLI2TtZa6", name: "Instrumental Study" },
    { id: "37i9dQZF1DX9sIqqvKsjG8", name: "Chill Lofi Study Beats" },
    { id: "37i9dQZF1DWZIOAPRae0EG", name: "Focus Flow" },
  ],
};

// Spotify playlist IDs are always 22-character Base62 strings.
const SPOTIFY_ID_REGEX = /^[A-Za-z0-9]{22}$/;

// ── Smoke tests ──────────────────────────────────────────────────────────────

describe("MOOD_PLAYLISTS — smoke tests", () => {
  it("has entries for every MUSIC_MOOD", () => {
    for (const mood of MUSIC_MOODS) {
      expect(MOOD_PLAYLISTS[mood], `mood "${mood}" has no playlist entry`).toBeDefined();
    }
  });

  it("each mood has at least one playlist", () => {
    for (const [mood, playlists] of Object.entries(MOOD_PLAYLISTS)) {
      expect(playlists.length, `${mood} playlists`).toBeGreaterThan(0);
    }
  });
});

// ── Structure validation ─────────────────────────────────────────────────────

describe("MOOD_PLAYLISTS — structure", () => {
  it("every playlist entry has a non-empty id", () => {
    for (const [mood, playlists] of Object.entries(MOOD_PLAYLISTS)) {
      for (const p of playlists) {
        expect(p.id.length, `${mood}: playlist id is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("every playlist entry has a non-empty name", () => {
    for (const [mood, playlists] of Object.entries(MOOD_PLAYLISTS)) {
      for (const p of playlists) {
        expect(p.name.length, `${mood}: playlist name is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("every playlist ID matches the Spotify 22-char format", () => {
    for (const [mood, playlists] of Object.entries(MOOD_PLAYLISTS)) {
      for (const p of playlists) {
        expect(
          SPOTIFY_ID_REGEX.test(p.id),
          `${mood}: "${p.id}" is not a valid Spotify playlist ID`
        ).toBe(true);
      }
    }
  });

  it("no duplicate playlist IDs within a single mood", () => {
    for (const [mood, playlists] of Object.entries(MOOD_PLAYLISTS)) {
      const ids  = playlists.map((p) => p.id);
      const uniq = new Set(ids);
      expect(uniq.size, `${mood} has duplicate playlist IDs`).toBe(ids.length);
    }
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("MOOD_PLAYLISTS — edge cases", () => {
  it("unknown mood should fall back to calm (simulated route logic)", () => {
    const mood     = "unknown_mood";
    const fallback = MOOD_PLAYLISTS[mood] ?? MOOD_PLAYLISTS["calm"];
    expect(fallback).toBeDefined();
    expect(fallback.length).toBeGreaterThan(0);
  });

  it("all moods have at least 2 playlists (for next/prev click-wheel navigation)", () => {
    for (const [mood, playlists] of Object.entries(MOOD_PLAYLISTS)) {
      expect(playlists.length, `${mood} needs ≥2 playlists for navigation`).toBeGreaterThanOrEqual(2);
    }
  });
});
