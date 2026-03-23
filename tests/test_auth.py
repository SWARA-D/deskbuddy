"""Integration tests — Auth Service (/auth/*)"""
import pytest
import httpx


def test_health(client: httpx.Client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_register_and_login(client: httpx.Client):
    """Full register → login flow with a fresh email."""
    import uuid
    email = f"newuser_{uuid.uuid4().hex[:8]}@test.com"
    password = "securepass99"

    # Register
    res = client.post("/auth/register", json={"email": email, "password": password})
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert "access_token" in body["data"]["tokens"]
    assert body["data"]["user"]["email"] == email

    # Login
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    assert "access_token" in res.json()["data"]["tokens"]


def test_duplicate_register(client: httpx.Client, auth_token: str):
    """Re-registering with the same email returns 400."""
    from tests.conftest import TEST_EMAIL, TEST_PASSWORD
    res = client.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert res.status_code == 400


def test_login_wrong_password(client: httpx.Client):
    from tests.conftest import TEST_EMAIL
    res = client.post("/auth/login", json={"email": TEST_EMAIL, "password": "wrongpassword"})
    assert res.status_code == 401


def test_login_nonexistent_user(client: httpx.Client):
    res = client.post("/auth/login", json={"email": "ghost@test.com", "password": "anything"})
    assert res.status_code == 401


def test_password_too_short(client: httpx.Client):
    res = client.post("/auth/register", json={"email": "short@test.com", "password": "abc"})
    assert res.status_code == 422


def test_invalid_email(client: httpx.Client):
    res = client.post("/auth/register", json={"email": "not-an-email", "password": "validpassword"})
    assert res.status_code == 422


def test_refresh_token(client: httpx.Client, auth_token: str):
    res = client.post("/auth/refresh", json={"access_token": auth_token})
    assert res.status_code == 200
    new_token = res.json()["data"]["access_token"]
    assert isinstance(new_token, str)
    assert len(new_token) > 20


def test_unauthenticated_access(client: httpx.Client):
    """Protected endpoints return 401 without a token."""
    res = client.get("/journal/entries")
    assert res.status_code == 401
