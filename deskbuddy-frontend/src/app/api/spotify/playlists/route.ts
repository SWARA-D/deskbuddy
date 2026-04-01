// app/api/spotify/playlists/route.ts
// Server-side playlist endpoint — multiple curated playlists per mood

import { NextRequest, NextResponse } from 'next/server';

// ── Mood → Multiple Spotify Playlist IDs ─────────────────────────────────────
// These are Spotify's own curated playlists — they always work in the embed
// without any API access, and they get updated by Spotify regularly.

const MOOD_PLAYLISTS: Record<string, { id: string; name: string }[]> = {
  anxious: [
    { id: '37i9dQZF1DWXIcbzpLauPS', name: 'Peaceful Piano' },
    { id: '37i9dQZF1DWZqd5JICZI0u', name: 'Peaceful Meditation' },
    { id: '37i9dQZF1DX9uKNf5jGX6m', name: 'Calming Acoustic' },
    { id: '37i9dQZF1DWYcDQ1hSjOpY', name: 'Deep Sleep' },
  ],
  calm: [
    { id: '37i9dQZF1DWUvZBXGjNCU4', name: 'Lo-Fi Beats' },
    { id: '37i9dQZF1DX0SM0LYsmbMT', name: 'Jazz Vibes' },
    { id: '37i9dQZF1DX4sWSpwq3LiO', name: 'Peaceful Piano' },
    { id: '37i9dQZF1DWVFeEut75IAL', name: 'Bossa Nova' },
  ],
  happy: [
    { id: '37i9dQZF1DXdPec7aLTmlC', name: 'Happy Hits!' },
    { id: '37i9dQZF1DX3rxVfibe1L0', name: 'Mood Booster' },
    { id: '37i9dQZF1DX9XIFQuFvzM4', name: 'Feelin\' Good' },
    { id: '37i9dQZF1DX2sUQwD7tbmL', name: 'Feel-Good Indie Rock' },
  ],
  sad: [
    { id: '37i9dQZF1DX7qK8ma5wgG1', name: 'Sad Songs' },
    { id: '37i9dQZF1DX3YSRoSdA634', name: 'Life Sucks' },
    { id: '37i9dQZF1DWVrtsSlLKzro', name: 'Down in the Dumps' },
    { id: '37i9dQZF1DWVV27DiNWxkR', name: 'Pop Sad Songs' },
  ],
  energetic: [
    { id: '37i9dQZF1DX4fpCWaHOned', name: 'Motivation Mix' },
    { id: '37i9dQZF1DX76Wlfdnj7AP', name: 'Beast Mode' },
    { id: '37i9dQZF1DX0BcQWzuB7ZO', name: 'Dance Hits' },
    { id: '37i9dQZF1DWSJHnPb1f0X3', name: 'Cardio' },
  ],
  focused: [
    { id: '37i9dQZF1DWZeKCadgRdKQ', name: 'Deep Focus' },
    { id: '37i9dQZF1DX8NTLI2TtZa6', name: 'Instrumental Study' },
    { id: '37i9dQZF1DX9sIqqvKsjG8', name: 'Chill Lofi Study Beats' },
    { id: '37i9dQZF1DWZIOAPRae0EG', name: 'Focus Flow' },
  ],
};

// ── GET /api/spotify/playlists?mood=happy ─────────────────────────────────────

const VALID_MOODS = new Set(Object.keys(MOOD_PLAYLISTS));

export async function GET(request: NextRequest) {
  const rawMood = request.nextUrl.searchParams.get('mood') ?? '';
  const mood    = VALID_MOODS.has(rawMood) ? rawMood : 'calm';

  const playlists = MOOD_PLAYLISTS[mood];

  // Pick a random playlist from the mood's collection for variety
  const pick = playlists[Math.floor(Math.random() * playlists.length)];

  return NextResponse.json({
    playlistId: pick.id,
    playlistName: pick.name,
    source: 'curated',
    mood,
    allPlaylists: playlists,
  });
}
