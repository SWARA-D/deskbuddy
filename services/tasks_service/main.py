"""Tasks Service - CRUD tasks"""
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings
from typing import Optional
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime
import uuid
import logging

logger = logging.getLogger("tasks_service")

class Settings(BaseSettings):
    database_url: str = "postgresql://deskbuddy:deskbuddy@postgres:5432/deskbuddy_tasks"
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
            cur.execute("SET search_path TO tasks_db")
        yield conn
    finally:
        get_pool().putconn(conn)


app = FastAPI(title="Tasks Service")


@app.on_event("shutdown")
def shutdown():
    global _pool
    if _pool is not None:
        _pool.closeall()
        logger.info("Tasks service: DB connection pool closed")


class TaskCreate(BaseModel):
    title: str
    due_at: str
    category: Optional[str] = None
    difficulty: int = 1

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        if len(v) > 200:
            raise ValueError("Title must be at most 200 characters")
        return v

    @field_validator("due_at")
    @classmethod
    def validate_due_at(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v)
        except ValueError:
            raise ValueError("due_at must be a valid ISO 8601 datetime")
        return v

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("difficulty must be between 1 and 5")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) > 50:
                raise ValueError("Category must be at most 50 characters")
        return v


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"todo", "in_progress", "done"}:
            raise ValueError("status must be one of: todo, in_progress, done")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Title cannot be empty")
            if len(v) > 200:
                raise ValueError("Title must be at most 200 characters")
        return v


@app.get("/health")
def health():
    return {"success": True}


@app.post("/tasks")
def create(t: TaskCreate, x_user_id: str = Header()):
    _validate_user_id(x_user_id)
    tid = str(uuid.uuid4())
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO tasks (id, user_id, title, category, difficulty, due_at, status, created_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,'todo',NOW()) RETURNING id,title,due_at,status",
                (tid, x_user_id, t.title, t.category, t.difficulty, t.due_at)
            )
            r = cur.fetchone()
            conn.commit()

    return {"success": True, "data": {"task": dict(r)}}


@app.get("/tasks")
def list_tasks(x_user_id: str = Header(), limit: int = 50, offset: int = 0):
    _validate_user_id(x_user_id)
    limit  = min(max(1, limit), 200)
    offset = max(0, offset)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, due_at, status FROM tasks "
                "WHERE user_id = %s ORDER BY due_at LIMIT %s OFFSET %s",
                (x_user_id, limit, offset),
            )
            items = cur.fetchall()

            # Total count for the caller to compute page count
            cur.execute(
                "SELECT COUNT(*) AS total FROM tasks WHERE user_id = %s",
                (x_user_id,),
            )
            total = cur.fetchone()["total"]

    has_more = (offset + limit) < total
    return {
        "success": True,
        "data": {
            "items":    [dict(i) for i in items],
            "total":    total,
            "limit":    limit,
            "offset":   offset,
            "has_more": has_more,
        },
    }


ALLOWED_UPDATE_FIELDS = {"status", "title"}

@app.patch("/tasks/{task_id}")
def update_task(task_id: str, t: TaskUpdate, x_user_id: str = Header()):
    _validate_user_id(x_user_id)
    _validate_uuid(task_id)

    fields = {}
    if t.status is not None:
        fields["status"] = t.status
    if t.title is not None:
        fields["title"] = t.title
    if not fields:
        raise HTTPException(400, "No fields to update")

    # Whitelist guard: ensure only known column names enter the SQL fragment
    if not fields.keys() <= ALLOWED_UPDATE_FIELDS:
        raise HTTPException(422, "Invalid fields")

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [task_id, x_user_id]

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE tasks SET {set_clause} WHERE id = %s AND user_id = %s RETURNING id,title,due_at,status",
                values
            )
            updated = cur.fetchone()
            conn.commit()

    if not updated:
        raise HTTPException(404, "Task not found")

    return {"success": True, "data": {"task": dict(updated)}}


def _validate_uuid(value: str) -> None:
    try:
        uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")


def _validate_user_id(user_id: str) -> None:
    """Reject x_user_id values that are not valid UUIDs."""
    try:
        uuid.UUID(user_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid user identity")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005)
