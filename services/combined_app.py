"""
DeskBuddy — Combined entry point for Render deployment.

Starts all 7 internal microservices as background daemon threads,
then serves the API Gateway on $PORT.

Render start command:
    python services/combined_app.py

Required env vars on Render (in addition to DATABASE_URL, REDIS_URL, JWT_SECRET, etc.):
    AUTH_SERVICE_URL    = http://localhost:8001
    JOURNAL_SERVICE_URL = http://localhost:8002
    NLP_SERVICE_URL     = http://localhost:8003
    MUSIC_SERVICE_URL   = http://localhost:8004
    TASKS_SERVICE_URL   = http://localhost:8005
    CHECKIN_SERVICE_URL = http://localhost:8006
    BOT_SERVICE_URL     = http://localhost:8007
"""
import os
import sys
import threading
import time
import logging

# Make sure 'services/' is on the path so each service module resolves correctly
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("combined")

# ── Internal services ─────────────────────────────────────────────────────────

_SERVICES = [
    ("auth_service.main:app",    8001),
    ("journal_service.main:app", 8002),
    ("nlp_service.main:app",     8003),
    ("music_service.main:app",   8004),
    ("tasks_service.main:app",   8005),
    ("checkin_service.main:app", 8006),
    ("bot_service.main:app",     8007),
]


def _run_service(app_path: str, port: int) -> None:
    """Run a single uvicorn service. Called in a daemon thread."""
    uvicorn.run(app_path, host="127.0.0.1", port=port, log_level="warning")


def _start_background_services() -> None:
    for app_path, port in _SERVICES:
        t = threading.Thread(target=_run_service, args=(app_path, port), daemon=True)
        t.name = f"svc-{port}"
        t.start()
        logger.info(f"Started {app_path} on :{port}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    _start_background_services()

    # Give services time to bind their ports before the gateway starts accepting traffic
    time.sleep(3)

    public_port = int(os.environ.get("PORT", 8080))
    logger.info(f"Starting gateway on :{public_port}")
    uvicorn.run("gateway.main:app", host="0.0.0.0", port=public_port, log_level="info")
