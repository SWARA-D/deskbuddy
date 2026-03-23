"""
Shared test fixtures for DeskBuddy integration tests.

Usage:
    docker-compose up -d          # start services
    pip install pytest httpx
    pytest tests/ -v
"""
import pytest
import httpx
import os

BASE_URL = os.getenv("DESKBUDDY_API_URL", "http://localhost:8080")

# A registered test user — created once per session
TEST_EMAIL    = "test_integration@deskbuddy.test"
TEST_PASSWORD = "testpassword123"


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=15) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client: httpx.Client) -> str:
    """Register (or login if already exists) and return a valid JWT."""
    # Try register
    res = client.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if res.status_code == 400 and "already registered" in res.json().get("detail", ""):
        # Already registered — log in
        res = client.post("/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})

    assert res.status_code in (200, 201), f"Auth failed: {res.text}"
    return res.json()["data"]["tokens"]["access_token"]


@pytest.fixture(scope="session")
def authed(client: httpx.Client, auth_token: str) -> httpx.Client:
    """Return a client with the Authorization header pre-set."""
    authed_client = httpx.Client(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=15,
    )
    yield authed_client
    authed_client.close()
