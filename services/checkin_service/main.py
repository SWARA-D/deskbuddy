"""Checkin Service - Daily check-ins and streak tracking"""
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings
from typing import Optional
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager, asynccontextmanager
from datetime import date
import uuid
import logging

logger = logging.getLogger("checkin_service")


def _validate_user_id(user_id: str) -> None:
    """Reject x_user_id values that are not valid UUIDs.

    The gateway injects this header after JWT validation, so it must always be
    a UUID. Accepting arbitrary strings would open the door to data cross-over
    if the trust model is ever bypassed.
    """
    try:
        uuid.UUID(user_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid user identity")

class Settings(BaseSettings):
    database_url: str = "postgresql://deskbuddy:deskbuddy@postgres:5432/deskbuddy_checkin"
    db_pool_min: int = 1
    db_pool_max: int = 10
    class Config:
        env_file = ".env"

settings = Settings()

# Connection pool — created once at startup
_pool: pool.ThreadedConnectionPool = None

def get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(
            settings.db_pool_min,
            settings.db_pool_max,
            settings.database_url,
        )
    return _pool

@contextmanager
def get_db():
    conn = get_pool().getconn()
    conn.cursor_factory = RealDictCursor
    try:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO checkin_db")
        yield conn
    finally:
        get_pool().putconn(conn)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # shutdown: close DB connection pool
    global _pool
    if _pool is not None:
        _pool.closeall()
        logger.info("Checkin service: DB connection pool closed")


app = FastAPI(title="Checkin Service", lifespan=lifespan)


class CheckinCreate(BaseModel):
    checkin_date: str
    caption: Optional[str] = None

    @field_validator("checkin_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("checkin_date must be a valid date in YYYY-MM-DD format")
        return v

    @field_validator("caption")
    @classmethod
    def validate_caption(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) > 500:
                raise ValueError("Caption must be at most 500 characters")
        return v


@app.get("/health")
def health():
    return {"success": True}


@app.post("/checkins")
def checkin(c: CheckinCreate, x_user_id: str = Header()):
    _validate_user_id(x_user_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO daily_checkins (id, user_id, checkin_date, caption, created_at) "
                "VALUES (%s,%s,%s,%s,NOW()) ON CONFLICT (user_id, checkin_date) "
                "DO UPDATE SET caption=EXCLUDED.caption",
                (str(uuid.uuid4()), x_user_id, c.checkin_date, c.caption)
            )
            conn.commit()

    streak = _compute_streak(x_user_id)
    return {
        "success": True,
        "data": {
            "checkin_date": c.checkin_date,
            "streak": streak,
        }
    }


@app.get("/checkins/streak")
def streak(x_user_id: str = Header()):
    _validate_user_id(x_user_id)
    return {"success": True, "data": _compute_streak(x_user_id)}


@app.get("/checkins/calendar")
def calendar(x_user_id: str = Header()):
    _validate_user_id(x_user_id)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT checkin_date, caption FROM daily_checkins "
                "WHERE user_id = %s ORDER BY checkin_date DESC LIMIT 90",
                (x_user_id,)
            )
            rows = cur.fetchall()

    return {
        "success": True,
        "data": {"items": [{"checkin_date": str(r["checkin_date"]), "caption": r["caption"]} for r in rows]}
    }


# ── Streak calculation ────────────────────────────────────────────────────────

def _compute_streak(user_id: str) -> dict:
    """
    Computes current and longest streak using the consecutive-date grouping trick:
    subtract the row-number (as days) from each checkin_date — consecutive dates
    produce the same group key, so we can GROUP BY that key.
    """
    sql = """
        WITH dated AS (
            SELECT DISTINCT checkin_date
            FROM daily_checkins
            WHERE user_id = %s
        ),
        ranked AS (
            SELECT checkin_date,
                   checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date))::integer AS grp
            FROM dated
        ),
        streaks AS (
            SELECT grp,
                   COUNT(*)::integer    AS streak_len,
                   MAX(checkin_date)    AS last_date,
                   MIN(checkin_date)    AS first_date
            FROM ranked
            GROUP BY grp
        )
        SELECT
            COALESCE((
                SELECT streak_len FROM streaks
                WHERE last_date >= CURRENT_DATE - 1
                ORDER BY last_date DESC
                LIMIT 1
            ), 0) AS current_streak,
            COALESCE(MAX(streak_len), 0) AS longest_streak,
            (SELECT last_date::text FROM streaks ORDER BY last_date DESC LIMIT 1) AS last_checkin_date
        FROM streaks
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (user_id,))
            row = cur.fetchone()

    if not row:
        return {"current": 0, "longest": 0, "last_checkin_date": None}

    return {
        "current":           row["current_streak"],
        "longest":           row["longest_streak"],
        "last_checkin_date": row["last_checkin_date"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8006)
