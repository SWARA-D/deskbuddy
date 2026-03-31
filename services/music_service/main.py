"""Music Service - Mood-based music recommendations"""
from fastapi import FastAPI, Header, HTTPException
from typing import Literal, Optional
import os

app = FastAPI(title="Music Service")

ALLOWED_MOODS = {"excited", "calm", "neutral", "sad", "anxious"}

FALLBACK: dict[str, list] = {
    "anxious": [{"title": "Calm Vibes", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "sad":     [{"title": "Feel Better", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "excited": [{"title": "Hype Mix", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "calm":    [{"title": "Chill Study", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
    "neutral": [{"title": "Everyday Mix", "type": "playlist", "spotify_url": "https://open.spotify.com/playlist/mock"}],
}

# Internal API key — set INTERNAL_API_KEY env var in production.
_INTERNAL_KEY: Optional[str] = os.environ.get("INTERNAL_API_KEY")
_APP_ENV: str = os.environ.get("APP_ENV", "development")

if not _INTERNAL_KEY and _APP_ENV == "production":
    import warnings
    warnings.warn(
        "INTERNAL_API_KEY is not set in production. "
        "Internal endpoints are reachable without authentication.",
        stacklevel=1,
    )


def _check_internal_key(x_internal_key: Optional[str]) -> None:
    if _INTERNAL_KEY and x_internal_key != _INTERNAL_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


@app.get("/health")
def health():
    return {"success": True}


@app.get("/music/recommendations")
def recs(
    mood: str,
    x_user_id: str = Header(),
    x_internal_key: Optional[str] = Header(default=None),
):
    _check_internal_key(x_internal_key)

    if mood not in ALLOWED_MOODS:
        raise HTTPException(
            status_code=400,
            detail=f"mood must be one of: {', '.join(sorted(ALLOWED_MOODS))}"
        )
    return {"success": True, "data": {"mood": mood, "items": FALLBACK.get(mood, [])}}
