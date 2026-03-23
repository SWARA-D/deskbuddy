// app/api/spotify/token/route.ts
// Endpoint to get Spotify Client Credentials token

import { NextResponse } from 'next/server';

/**
 * GET /api/spotify/token
 * Returns a Spotify access token using Client Credentials flow
 * This is safe to call from the client because it doesn't require user auth
 */
export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Spotify credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Spotify auth failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in, // Usually 3600 seconds (1 hour)
    });
  } catch (error) {
    console.error('Spotify token error:', error);
    return NextResponse.json(
      { error: 'Failed to get Spotify token' },
      { status: 500 }
    );
  }
}