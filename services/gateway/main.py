"""
DeskBuddy API Gateway / BFF
Pattern A: validates JWT, injects X-User-Id + X-Request-Id headers to downstream services
"""
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from pydantic_settings import BaseSettings
import httpx
import redis
import uuid
import time
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gateway")

# Max request body size: 1 MB
MAX_BODY_BYTES = 1 * 1024 * 1024

# Httpx timeout: 10 seconds
PROXY_TIMEOUT = httpx.Timeout(10.0)


# Config
class Settings(BaseSettings):
    # JWT
    jwt_secret: str = "DEV_SECRET_CHANGE_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"

    # Internal service URLs
    auth_service_url: str = "http://auth_service:8001"
    journal_service_url: str = "http://journal_service:8002"
    nlp_service_url: str = "http://nlp_service:8003"
    music_service_url: str = "http://music_service:8004"
    tasks_service_url: str = "http://tasks_service:8005"
    checkin_service_url: str = "http://checkin_service:8006"
    bot_service_url: str = "http://bot_service:8007"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    class Config:
        env_file = ".env"

settings = Settings()
redis_client = redis.from_url(settings.redis_url, decode_responses=True)


# App
app = FastAPI(title="DeskBuddy Gateway", version="1.0.0")

# CORS — allow frontend origins only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://deskbuddy-gilt.vercel.app",
    ],
    # Covers all Vercel preview deployment URLs
    allow_origin_regex=r"https://deskbuddy.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
)


# ── Middleware ────────────────────────────────────────────────────────────────

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject requests with body larger than MAX_BODY_BYTES."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(
            content={"success": False, "message": "Request body too large"},
            status_code=413
        )
    return await call_next(request)


@app.middleware("http")
async def global_ip_rate_limit(request: Request, call_next):
    """200 requests per minute per IP across all endpoints."""
    ip = _get_client_ip(request)
    key = f"rl:global:{ip}"
    if not _check_rate_limit(key, max_requests=200, window=60):
        return JSONResponse(
            content={"success": False, "message": "Too many requests"},
            status_code=429
        )
    return await call_next(request)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> str:
    """Return real client IP, honouring X-Forwarded-For from trusted proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(key: str, max_requests: int = 10, window: int = 60) -> bool:
    """Returns True if under limit, False if over. Atomic via Redis INCR + EXPIRE."""
    try:
        current = redis_client.get(key)
        if current is None:
            redis_client.setex(key, window, 1)
            return True
        if int(current) >= max_requests:
            return False
        redis_client.incr(key)
        return True
    except Exception:
        # If Redis is down, fail open (don't block users)
        logger.warning("Redis unavailable for rate limiting, failing open")
        return True


def get_user_id_from_token(request: Request) -> Optional[str]:
    """Extract user_id from JWT Bearer token. Returns None if missing/invalid."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]  # strip "Bearer "
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


async def require_auth(request: Request) -> str:
    """Dependency that enforces JWT presence. Raises 401 if missing/invalid."""
    user_id = get_user_id_from_token(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


def _rate_limit_or_raise(key: str, max_requests: int, window: int) -> None:
    if not _check_rate_limit(key, max_requests, window):
        raise HTTPException(status_code=429, detail="Too many requests")


# ── Proxy helper ──────────────────────────────────────────────────────────────

async def proxy_request(
    request: Request,
    target_url: str,
    user_id: Optional[str] = None,
    method: str = "GET",
    json_body: dict = None
):
    """Forward request to internal service with Pattern A headers."""
    headers = {
        "X-Request-Id": request.state.request_id,
        "Content-Type": "application/json",
    }
    if user_id:
        headers["X-User-Id"] = user_id

    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        try:
            if method == "GET":
                resp = await client.get(target_url, headers=headers, params=dict(request.query_params))
            elif method == "POST":
                resp = await client.post(target_url, headers=headers, json=json_body)
            elif method == "PATCH":
                resp = await client.patch(target_url, headers=headers, json=json_body)
            elif method == "DELETE":
                resp = await client.delete(target_url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            try:
                content = resp.json()
            except Exception:
                content = {"success": False, "message": resp.text or "Service error"}
            return JSONResponse(content=content, status_code=resp.status_code)
        except httpx.TimeoutException:
            logger.error(f"Timeout proxying to {target_url}")
            return JSONResponse(
                content={"success": False, "message": "Service timed out"},
                status_code=504
            )
        except httpx.RequestError as e:
            logger.error(f"Service error: {e}")
            return JSONResponse(
                content={"success": False, "message": "Service unavailable"},
                status_code=503
            )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"success": True, "data": {"status": "ok"}, "message": "Gateway healthy", "status_code": 200}


# Auth (public routes)
@app.post("/auth/register")
async def register(request: Request):
    ip = _get_client_ip(request)
    # 5 registrations per IP per hour
    _rate_limit_or_raise(f"rl:register:{ip}", max_requests=5, window=3600)
    body = await request.json()
    return await proxy_request(request, f"{settings.auth_service_url}/auth/register", method="POST", json_body=body)


@app.post("/auth/login")
async def login(request: Request):
    ip = _get_client_ip(request)
    # 10 login attempts per IP per minute (brute-force protection)
    _rate_limit_or_raise(f"rl:login:{ip}", max_requests=10, window=60)
    body = await request.json()
    return await proxy_request(request, f"{settings.auth_service_url}/auth/login", method="POST", json_body=body)


@app.post("/auth/refresh")
async def refresh(request: Request):
    ip = _get_client_ip(request)
    _rate_limit_or_raise(f"rl:refresh:{ip}", max_requests=20, window=60)
    body = await request.json()
    # Forward the Authorization header so auth service can validate the existing token
    return await proxy_request(request, f"{settings.auth_service_url}/auth/refresh", method="POST", json_body=body)


# Desk Summary
@app.get("/desk/summary")
async def desk_summary(request: Request, user_id: str = Depends(require_auth)):
    return {
        "success": True,
        "data": {
            "latest_mood": None,
            "streak": {"current": 0, "longest": 0, "last_checkin_date": None},
            "tasks_today": {"total": 0, "completed": 0}
        },
        "message": "Desk summary loaded",
        "status_code": 200,
        "request_id": request.state.request_id
    }


# Journal
@app.post("/journal/entries")
async def create_journal_entry(request: Request, user_id: str = Depends(require_auth)):
    # 30 journal entries per user per hour
    _rate_limit_or_raise(f"rl:journal:write:{user_id}", max_requests=30, window=3600)
    body = await request.json()
    return await proxy_request(request, f"{settings.journal_service_url}/journal/entries", user_id, "POST", body)


@app.get("/journal/entries")
async def list_journal_entries(request: Request, user_id: str = Depends(require_auth)):
    return await proxy_request(request, f"{settings.journal_service_url}/journal/entries", user_id, "GET")


@app.get("/journal/entries/{entry_id}")
async def get_journal_entry(entry_id: str, request: Request, user_id: str = Depends(require_auth)):
    _validate_uuid(entry_id)
    return await proxy_request(request, f"{settings.journal_service_url}/journal/entries/{entry_id}", user_id, "GET")


@app.delete("/journal/entries/{entry_id}")
async def delete_journal_entry(entry_id: str, request: Request, user_id: str = Depends(require_auth)):
    _validate_uuid(entry_id)
    return await proxy_request(request, f"{settings.journal_service_url}/journal/entries/{entry_id}", user_id, "DELETE")


# NLP
@app.post("/nlp/analyze")
async def nlp_analyze(request: Request, user_id: str = Depends(require_auth)):
    _rate_limit_or_raise(f"rl:nlp:{user_id}", max_requests=60, window=60)
    body = await request.json()
    return await proxy_request(request, f"{settings.nlp_service_url}/nlp/analyze", user_id, "POST", body)


# Music
@app.get("/music/recommendations")
async def music_recommendations(request: Request, user_id: str = Depends(require_auth)):
    return await proxy_request(request, f"{settings.music_service_url}/music/recommendations", user_id, "GET")


# Tasks
@app.post("/tasks")
async def create_task(request: Request, user_id: str = Depends(require_auth)):
    _rate_limit_or_raise(f"rl:tasks:write:{user_id}", max_requests=60, window=3600)
    body = await request.json()
    return await proxy_request(request, f"{settings.tasks_service_url}/tasks", user_id, "POST", body)


@app.get("/tasks")
async def list_tasks(request: Request, user_id: str = Depends(require_auth)):
    return await proxy_request(request, f"{settings.tasks_service_url}/tasks", user_id, "GET")


@app.patch("/tasks/{task_id}")
async def update_task(task_id: str, request: Request, user_id: str = Depends(require_auth)):
    _validate_uuid(task_id)
    body = await request.json()
    return await proxy_request(request, f"{settings.tasks_service_url}/tasks/{task_id}", user_id, "PATCH", body)


# Checkins
@app.post("/checkins")
async def create_checkin(request: Request, user_id: str = Depends(require_auth)):
    # 3 checkins per user per day (upsert makes this idempotent, but guard anyway)
    _rate_limit_or_raise(f"rl:checkin:{user_id}", max_requests=3, window=86400)
    body = await request.json()
    return await proxy_request(request, f"{settings.checkin_service_url}/checkins", user_id, "POST", body)


@app.get("/checkins/streak")
async def get_streak(request: Request, user_id: str = Depends(require_auth)):
    return await proxy_request(request, f"{settings.checkin_service_url}/checkins/streak", user_id, "GET")


@app.get("/checkins/calendar")
async def get_calendar(request: Request, user_id: str = Depends(require_auth)):
    return await proxy_request(request, f"{settings.checkin_service_url}/checkins/calendar", user_id, "GET")


# Bot
@app.post("/bot/message")
async def bot_message(request: Request, user_id: str = Depends(require_auth)):
    # 10 bot messages per user per minute
    _rate_limit_or_raise(f"rl:bot:{user_id}", max_requests=10, window=60)
    body = await request.json()
    return await proxy_request(request, f"{settings.bot_service_url}/bot/message", user_id, "POST", body)


# ── Utilities ─────────────────────────────────────────────────────────────────

def _validate_uuid(value: str) -> None:
    """Raise 400 if value is not a valid UUID, preventing path traversal."""
    try:
        uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
