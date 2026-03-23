"""
DeskBuddy Auth Service
Handles user registration, login, and JWT token generation
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from pydantic_settings import BaseSettings
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auth_service")

class Settings(BaseSettings):
    database_url: str = "postgresql://deskbuddy:deskbuddy@postgres:5432/deskbuddy_auth"
    jwt_secret: str = "DEV_SECRET_CHANGE_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    db_pool_min: int = 1
    db_pool_max: int = 10
    class Config:
        env_file = ".env"

settings = Settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
            cur.execute("SET search_path TO auth_db")
        yield conn
    finally:
        get_pool().putconn(conn)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def email_max_length(cls, v: str) -> str:
        if len(v) > 254:
            raise ValueError("Email too long")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def email_lower(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("Password is required")
        if len(v) > 128:
            raise ValueError("Password too long")
        return v


class RefreshRequest(BaseModel):
    access_token: str


app = FastAPI(title="Auth Service", version="1.0.0")

@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "service": "auth"}, "message": "Auth healthy"}


@app.post("/auth/register", status_code=201)
def register(req: RegisterRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            hashed = pwd_context.hash(req.password)
            user_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (%s, %s, %s, NOW()) RETURNING id, email, created_at",
                (user_id, req.email, hashed)
            )
            user = cur.fetchone()
            conn.commit()

    return {
        "success": True,
        "data": {
            "user": {"id": user["id"], "email": user["email"], "created_at": user["created_at"].isoformat()},
            "tokens": {"access_token": _make_token(user["id"]), "expires_in": settings.access_token_expire_minutes * 60},
        },
        "message": "Registered successfully",
        "status_code": 201,
    }


@app.post("/auth/login")
def login(req: LoginRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, created_at FROM users WHERE email = %s",
                (req.email,)
            )
            user = cur.fetchone()

    # Always run bcrypt to prevent timing-based user enumeration
    dummy_hash = "$2b$12$eImiTXuWVxfM37uY4JANjQ"
    pwd_context.verify(req.password, user["password_hash"] if user else dummy_hash)

    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "success": True,
        "data": {
            "user": {"id": user["id"], "email": user["email"], "created_at": user["created_at"].isoformat()},
            "tokens": {"access_token": _make_token(user["id"]), "expires_in": settings.access_token_expire_minutes * 60},
        },
        "message": "Login successful",
        "status_code": 200,
    }


@app.post("/auth/refresh")
def refresh(req: RefreshRequest):
    try:
        payload = jwt.decode(
            req.access_token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=401, detail="User not found")

    return {
        "success": True,
        "data": {"access_token": _make_token(user_id), "expires_in": settings.access_token_expire_minutes * 60},
        "message": "Token refreshed",
        "status_code": 200,
    }


def _make_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes), "iat": datetime.utcnow()},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
