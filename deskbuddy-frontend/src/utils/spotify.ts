// utils/spotify.ts
// Spotify integration for DeskBuddy

import type { PlaylistInfo, PlaylistResult } from "@/types";
export type { PlaylistInfo, PlaylistResult };

// ── Fetch playlist for a given mood ──────────────────────────────────────────

export async function getPlaylistForMood(mood: string): Promise<PlaylistResult> {
  try {
    const res = await fetch(`/api/spotify/playlists?mood=${encodeURIComponent(mood)}`);

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('Failed to fetch playlist:', err);

    // Client-side fallback
    return {
      playlistId: '37i9dQZF1DXdPec7aLTmlC',
      playlistName: 'Happy Hits!',
      source: 'fallback',
      mood,
      allPlaylists: [],
    };
  }
}