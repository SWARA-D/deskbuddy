"""Journal Service - CRUD journal entries + async NLP analysis"""
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings
from typing import Literal, Optional
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import uuid
import httpx
import logging

logger = logging.getLogger("journal_service")

class Settings(BaseSettings):
    database_url: str = "postgresql://deskbuddy:deskbuddy@postgres:5432/deskbuddy_journal"
    nlp_service_url: str = "http://nlp_service:8003"
    db_pool_min: int = 1
    db_pool_max: int = 10
    class Config:
        env_file = ".env"

settings = Settings()

_pool: pool.ThreadedConnectionPool = None

def get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(
            settings.db_pool_min, settings.db_pool_max, settings.database_url
        )
    return _pool

@contextmanager
def get_db():
    conn = get_pool().getconn()
    conn.cursor_factory = RealDictCursor
    try:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO journal_db")
        yield conn
    finally:
        get_pool().putconn(conn)


app = FastAPI(title="Journal Service")

MAX_TEXT_LENGTH = 10_000
MAX_LIST_LIMIT  = 100


class CreateEntryRequest(BaseModel):
    text: str
    input_type: Literal["typed", "voice"] = "typed"
    analyze: bool = True

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Text is required")
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError(f"Text must be at most {MAX_TEXT_LENGTH} characters")
        return v


@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "service": "journal"}}


@app.post("/journal/entries")
def create_entry(req: CreateEntryRequest, x_user_id: str = Header()):
    entry_id = str(uuid.uuid4())

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO journal_entries (id, user_id, text, input_type, created_at) "
                "VALUES (%s, %s, %s, %s, NOW()) RETURNING id, text, input_type, created_at",
                (entry_id, x_user_id, req.text, req.input_type)
            )
            entry = cur.fetchone()
            conn.commit()

    analysis = None
    if req.analyze:
        analysis = _call_nlp(req.text, entry_id, x_user_id)

    return {
        "success": True,
        "data": {
            "entry": {
                "id": entry["id"],
                "text": entry["text"],
                "input_type": entry["input_type"],
                "created_at": entry["created_at"].isoformat(),
            },
            "analysis": analysis,
        },
        "message": "Entry created",
        "status_code": 201,
    }


@app.get("/journal/entries")
def list_entries(x_user_id: str = Header(), limit: int = 20):
    limit = min(max(1, limit), MAX_LIST_LIMIT)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, LEFT(text, 100) as text_preview, sentiment, emotion, created_at "
                "FROM journal_entries WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                (x_user_id, limit)
            )
            items = cur.fetchall()

    return {
        "success": True,
        "data": {
            "items": [
                {
                    "id": r["id"],
                    "text_preview": r["text_preview"],
                    "created_at": r["created_at"].isoformat(),
                    "has_analysis": r["sentiment"] is not None,
                    "sentiment": r["sentiment"],
                    "emotion": r["emotion"],
                }
                for r in items
            ],
            "next_cursor": None,
        },
        "message": "Entries loaded",
        "status_code": 200,
    }


@app.get("/journal/entries/{entry_id}")
def get_entry(entry_id: str, x_user_id: str = Header()):
    _validate_uuid(entry_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, text, input_type, sentiment, emotion, confidence, mood_summary, created_at "
                "FROM journal_entries WHERE id = %s AND user_id = %s",
                (entry_id, x_user_id)
            )
            entry = cur.fetchone()

    if not entry:
        raise HTTPException(404, "Entry not found")

    analysis = None
    if entry["sentiment"]:
        analysis = {
            "sentiment": entry["sentiment"],
            "emotion": entry["emotion"],
            "confidence": entry["confidence"],
            "mood_summary": entry["mood_summary"],
        }

    return {
        "success": True,
        "data": {
            "entry": {
                "id": entry["id"],
                "text": entry["text"],
                "input_type": entry["input_type"],
                "created_at": entry["created_at"].isoformat(),
            },
            "analysis": analysis,
        },
    }


@app.delete("/journal/entries/{entry_id}")
def delete_entry(entry_id: str, x_user_id: str = Header()):
    _validate_uuid(entry_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM journal_entries WHERE id = %s AND user_id = %s RETURNING id",
                (entry_id, x_user_id)
            )
            deleted = cur.fetchone()
            conn.commit()

    if not deleted:
        raise HTTPException(404, "Entry not found")

    return {"success": True, "data": {"deleted": True}, "message": "Entry deleted"}


# ── NLP integration ───────────────────────────────────────────────────────────

def _call_nlp(text: str, entry_id: str, user_id: str) -> Optional[dict]:
    """
    Call the NLP service synchronously, then update the journal entry with the result.
    Returns the analysis dict on success, or None if NLP is unavailable.
    """
    try:
        resp = httpx.post(
            f"{settings.nlp_service_url}/nlp/analyze",
            json={"text": text, "entry_id": entry_id},
            headers={"X-User-Id": user_id, "X-Request-Id": entry_id},
            timeout=5.0,
        )
        if resp.status_code != 200:
            logger.warning(f"NLP returned {resp.status_code}")
            return None

        nlp = resp.json().get("data", {})
        _persist_analysis(entry_id, nlp)
        return nlp

    except Exception as e:
        logger.warning(f"NLP unavailable: {e}")
        return None


def _persist_analysis(entry_id: str, nlp: dict) -> None:
    """Write NLP results back to the journal entry row."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE journal_entries SET sentiment=%s, emotion=%s, confidence=%s WHERE id=%s",
                (nlp.get("sentiment"), nlp.get("emotion"), nlp.get("confidence"), entry_id)
            )
            conn.commit()


def _validate_uuid(value: str) -> None:
    try:
        uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
