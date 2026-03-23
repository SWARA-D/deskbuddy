"""Music Service - Mood-based music recommendations"""
from fastapi import FastAPI, Header, HTTPException
from typing import Literal

app = FastAPI(title="Music Service")

ALLOWED_MOODS = {"excited", "calm", "neutral", "sad", "anxious"}

FALLBACK: dict[str, list] = {
    "anxious": [{"title": "Calm Vibes", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "sad":     [{"title": "Feel Better", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "excited": [{"title": "Hype Mix", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "calm":    [{"title": "Chill Study", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "neutral": [{"title": "Everyday Mix", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
}


@app.get("/health")
def health():
    return {"success": True}


@app.get("/music/recommendations")
def recs(mood: str, x_user_id: str = Header()):
    if mood not in ALLOWED_MOODS:
        raise HTTPException(
            status_code=400,
            detail=f"mood must be one of: {', '.join(sorted(ALLOWED_MOODS))}"
        )
    return {"success": True, "data": {"mood": mood, "items": FALLBACK.get(mood, [])}}
