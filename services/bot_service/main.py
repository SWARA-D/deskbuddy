"""
Bot Service — Intent routing with rule-based responses.
Recognises common intents and returns actionable replies.
Falls back to a generic helpful message for unrecognised input.
"""
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings
from typing import Optional
import re
import os
import logging

logger = logging.getLogger("bot_service")

MAX_MESSAGE_LENGTH = 500

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

# ── Intent definitions ────────────────────────────────────────────────────────

INTENTS = [
    {
        "name": "add_task",
        "patterns": [r"\badd\b.{0,100}\btask\b", r"\bcreate\b.{0,100}\btask\b", r"\bnew task\b", r"\bremind me\b"],
        "reply": "📝 To add a task, head to the **Focus** page and tap the + button. You can set a title, due date, and difficulty level!",
        "actions": ["navigate:/tasks"],
    },
    {
        "name": "show_tasks",
        "patterns": [r"\b(my\s+)?tasks?\b", r"\bto.?do\b", r"\bwhat.{0,50}(do|need).{0,50}today\b"],
        "reply": "📋 Your tasks are on the **Focus** page. I can see them once you head over there!",
        "actions": ["navigate:/tasks"],
    },
    {
        "name": "music",
        "patterns": [r"\bmusic\b", r"\bplaylist\b", r"\bsong\b", r"\blisten\b", r"\bplay\b"],
        "reply": "🎵 Head to the **Music** page and pick a mood — I'll find you a playlist that fits how you're feeling!",
        "actions": ["navigate:/music"],
    },
    {
        "name": "journal",
        "patterns": [r"\bjournal\b", r"\bdiary\b", r"\bwrite\b", r"\bentry\b", r"\bnotes?\b"],
        "reply": "📓 The **Journal** is a great place to reflect. Open it to write about your day or capture a thought!",
        "actions": ["navigate:/journal"],
    },
    {
        "name": "streak",
        "patterns": [r"\bstreak\b", r"\bcheck.?in\b", r"\bdays?\s+in\s+a\s+row\b", r"\bsnapshot\b"],
        "reply": "🔥 Your streak lives on the **Photos** page — go check in today to keep it alive!",
        "actions": ["navigate:/checkin"],
    },
    {
        "name": "mood",
        "patterns": [r"\b(how|what).{0,50}(feel|mood|emotion)\b", r"\bfeeling\b", r"\bemotion\b"],
        "reply": "💭 Not sure how you're feeling? Try writing in your **Journal** — the AI will analyse your mood and suggest music or tasks to match!",
        "actions": ["navigate:/journal"],
    },
    {
        "name": "help",
        "patterns": [r"\bhelp\b", r"\bwhat can you\b", r"\bcommands?\b", r"\bwhat do you\b"],
        "reply": (
            "🤖 Here's what I can help with:\n\n"
            "• **Tasks** — 'add a task', 'show my tasks'\n"
            "• **Music** — 'suggest a playlist', 'play something calm'\n"
            "• **Journal** — 'open journal', 'I want to write'\n"
            "• **Streak** — 'show my streak', 'check in'\n"
            "• **Mood** — 'how am I feeling?'\n\n"
            "Just type naturally — I'll figure it out!"
        ),
        "actions": [],
    },
    {
        "name": "greeting",
        "patterns": [r"^\s*(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy)\b"],
        "reply": "👋 Hey there! I'm your Desk Buddy. What would you like to do today?",
        "actions": [],
    },
]


class BotMsg(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message is required")
        if len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f"Message must be at most {MAX_MESSAGE_LENGTH} characters")
        return v


app = FastAPI(title="Bot Service")


@app.get("/health")
def health():
    return {"success": True}


@app.post("/bot/message")
def msg(
    m: BotMsg,
    x_user_id: str = Header(),
    x_internal_key: Optional[str] = Header(default=None),
):
    _check_internal_key(x_internal_key)
    intent, reply, actions = _detect_intent(m.message)

    return {
        "success": True,
        "data": {
            "intent":       intent,
            "actions_taken": actions,
            "reply":        reply,
        }
    }


# ── Intent detection ──────────────────────────────────────────────────────────

def _detect_intent(text: str) -> tuple[str, str, list]:
    lower = text.lower()
    for intent in INTENTS:
        for pattern in intent["patterns"]:
            if re.search(pattern, lower):
                return intent["name"], intent["reply"], intent["actions"]

    # Default fallback
    return (
        "unknown",
        "🤖 I'm not sure about that one. Try asking about tasks, music, your journal, or your streak — or type **help** to see everything I can do!",
        [],
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8007)
