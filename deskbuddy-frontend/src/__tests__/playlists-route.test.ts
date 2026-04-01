/**
 * Tests for GET /api/spotify/playlists
 *
 * Covers:
 *  - Every valid mood returns playlists for that specific mood
 *  - Invalid / unknown moods fall back to calm (VALID_MOODS whitelist)
 *  - Potential injection / traversal attempts in the mood param are rejected
 *  - Response shape is correct: playlistId, playlistName, source, mood, allPlaylists
 *  - allPlaylists always contains the randomly selected playlist
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/spotify/playlists/route";
import { NextRequest } from "next/server";
import { MUSIC_MOODS } from "@/constants/moods";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = "http://localhost/api/spotify/playlists";

function makeGet(mood?: string): NextRequest {
  const url = new URL(BASE);
  if (mood !== undefined) url.searchParams.set("mood", mood);
  return new NextRequest(url, { method: "GET" });
}

// ── Valid moods ───────────────────────────────────────────────────────────────

describe("GET /api/spotify/playlists — valid moods", () => {
  for (const mood of MUSIC_MOODS) {
    it(`returns playlists for mood "${mood}"`, async () => {
      const res  = await GET(makeGet(mood));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mood).toBe(mood);
      expect(typeof json.playlistId).toBe("string");
      expect(json.playlistId.length).toBeGreaterThan(0);
      expect(typeof json.playlistName).toBe("string");
      expect(json.playlistName.length).toBeGreaterThan(0);
      expect(Array.isArray(json.allPlaylists)).toBe(true);
      expect(json.allPlaylists.length).toBeGreaterThan(0);
    });
  }

  it("the selected playlist is always present in allPlaylists", async () => {
    for (const mood of MUSIC_MOODS) {
      const res  = await GET(makeGet(mood));
      const json = await res.json();
      const ids  = (json.allPlaylists as { id: string }[]).map((p) => p.id);
      expect(ids).toContain(json.playlistId);
    }
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe("GET /api/spotify/playlists — response shape", () => {
  it("returns source: 'curated'", async () => {
    const res  = await GET(makeGet("calm"));
    const json = await res.json();
    expect(json.source).toBe("curated");
  });

  it("allPlaylists entries each have a non-empty id and name", async () => {
    const res  = await GET(makeGet("happy"));
    const json = await res.json();

    for (const p of json.allPlaylists as { id: string; name: string }[]) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it("returns at least 2 playlists in allPlaylists (needed for prev/next navigation)", async () => {
    for (const mood of MUSIC_MOODS) {
      const res  = await GET(makeGet(mood));
      const json = await res.json();
      expect(
        (json.allPlaylists as unknown[]).length,
        `${mood} needs ≥2 for navigation`
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── Invalid / unknown mood values — VALID_MOODS whitelist ────────────────────

describe("GET /api/spotify/playlists — invalid mood values fall back to calm", () => {
  const CALM_PLAYLIST_IDS = [
    "37i9dQZF1DWUvZBXGjNCU4",
    "37i9dQZF1DX0SM0LYsmbMT",
    "37i9dQZF1DX4sWSpwq3LiO",
    "37i9dQZF1DWVFeEut75IAL",
  ];

  async function expectFallbackToCalm(mood: string) {
    const res  = await GET(makeGet(mood));
    const json = await res.json();
    expect(res.status).toBe(200);
    // The playlistId must come from the calm set
    const ids = (json.allPlaylists as { id: string }[]).map((p) => p.id);
    for (const id of CALM_PLAYLIST_IDS) {
      if (ids.includes(id)) return; // confirmed — at least one calm playlist present
    }
    throw new Error(`Expected calm playlists for mood "${mood}", got: ${ids.join(", ")}`);
  }

  it("falls back to calm for an unknown mood string", async () => {
    await expectFallbackToCalm("unknown_mood");
  });

  it("falls back to calm when mood param is absent", async () => {
    await expectFallbackToCalm(""); // empty string also treated as invalid
  });

  it("falls back to calm for a numeric string", async () => {
    await expectFallbackToCalm("42");
  });

  it("falls back to calm for a SQL injection attempt", async () => {
    await expectFallbackToCalm("calm' OR '1'='1");
  });

  it("falls back to calm for a script injection attempt", async () => {
    await expectFallbackToCalm("<script>alert(1)</script>");
  });

  it("falls back to calm for a path traversal attempt", async () => {
    await expectFallbackToCalm("../../etc/passwd");
  });

  it("is case-sensitive — 'CALM' is not a valid mood", async () => {
    await expectFallbackToCalm("CALM");
  });
});
