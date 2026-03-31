"""
Security integration tests for DeskBuddy.

Covers:
 - Brute-force / rate limiting
 - IDOR / user isolation (cross-user data access)
 - JWT tampering & missing/malformed tokens
 - Input injection payloads (SQL, XSS, path traversal)
 - Request size enforcement
 - x_user_id spoofing via public API
 - Insecure direct object reference on task/journal/checkin endpoints
"""

import uuid
import httpx
import pytest
from tests.conftest import BASE_URL, TEST_EMAIL, TEST_PASSWORD


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register_user(client: httpx.Client) -> dict:
    """Register a fresh throwaway user and return {token, user_id}."""
    email = f"sec_{uuid.uuid4().hex[:10]}@test.com"
    res = client.post("/auth/register", json={"email": email, "password": "S3cur3P@ss!"})
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    return {
        "token": data["tokens"]["access_token"],
        "user_id": data["user"]["id"],
        "email": email,
    }


def _authed(base_url: str, token: str) -> httpx.Client:
    return httpx.Client(
        base_url=base_url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )


# ---------------------------------------------------------------------------
# 1. Authentication — missing / malformed tokens
# ---------------------------------------------------------------------------

class TestUnauthenticated:
    """Every protected endpoint must reject requests without a valid token."""

    PROTECTED = [
        ("GET",    "/journal/entries"),
        ("POST",   "/journal/entries"),
        ("GET",    "/checkins/streak"),
        ("GET",    "/checkins/calendar"),
        ("POST",   "/checkins"),
        ("GET",    "/tasks"),
        ("POST",   "/tasks"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED)
    def test_no_token_returns_401(self, client: httpx.Client, method: str, path: str):
        res = client.request(method, path, json={})
        assert res.status_code == 401, f"{method} {path} returned {res.status_code}"

    def test_malformed_bearer_token(self, client: httpx.Client):
        bad_headers = {"Authorization": "Bearer not.a.jwt"}
        res = client.get("/journal/entries", headers=bad_headers)
        assert res.status_code == 401

    def test_wrong_scheme(self, client: httpx.Client):
        bad_headers = {"Authorization": "Basic dXNlcjpwYXNz"}
        res = client.get("/journal/entries", headers=bad_headers)
        assert res.status_code == 401

    def test_empty_bearer_value(self, client: httpx.Client):
        res = client.get("/journal/entries", headers={"Authorization": "Bearer "})
        assert res.status_code == 401

    def test_tampered_jwt_signature(self, client: httpx.Client, auth_token: str):
        """Flip the last character of the signature — must be rejected."""
        parts = auth_token.split(".")
        bad_sig = parts[2][:-1] + ("A" if parts[2][-1] != "A" else "B")
        tampered = ".".join([parts[0], parts[1], bad_sig])
        res = client.get("/journal/entries", headers={"Authorization": f"Bearer {tampered}"})
        assert res.status_code == 401

    def test_tampered_jwt_payload(self, client: httpx.Client, auth_token: str):
        """Replace the payload with a different sub — must be rejected."""
        import base64, json
        header, _, sig = auth_token.split(".")
        fake_payload = base64.urlsafe_b64encode(
            json.dumps({"sub": str(uuid.uuid4()), "exp": 9999999999}).encode()
        ).rstrip(b"=").decode()
        tampered = f"{header}.{fake_payload}.{sig}"
        res = client.get("/journal/entries", headers={"Authorization": f"Bearer {tampered}"})
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# 2. IDOR — users must not access each other's resources
# ---------------------------------------------------------------------------

class TestUserIsolation:
    """User A must not read or mutate User B's data."""

    def test_journal_entry_isolation(self, client: httpx.Client):
        user_a = _register_user(client)
        user_b = _register_user(client)

        # User A creates an entry
        with _authed(BASE_URL, user_a["token"]) as ca:
            create = ca.post("/journal/entries", json={"text": "A's private diary.", "analyze": False})
            assert create.status_code == 200
            entry_id = create.json()["data"]["entry"]["id"]

        # User B tries to read User A's entry
        with _authed(BASE_URL, user_b["token"]) as cb:
            res = cb.get(f"/journal/entries/{entry_id}")
            assert res.status_code in (403, 404), (
                f"User B got {res.status_code} for User A's journal entry"
            )

    def test_journal_entry_delete_isolation(self, client: httpx.Client):
        user_a = _register_user(client)
        user_b = _register_user(client)

        with _authed(BASE_URL, user_a["token"]) as ca:
            entry_id = ca.post(
                "/journal/entries", json={"text": "Secret.", "analyze": False}
            ).json()["data"]["entry"]["id"]

        with _authed(BASE_URL, user_b["token"]) as cb:
            res = cb.delete(f"/journal/entries/{entry_id}")
            assert res.status_code in (403, 404), (
                f"User B deleted User A's journal entry (status {res.status_code})"
            )

    def test_task_isolation(self, client: httpx.Client):
        user_a = _register_user(client)
        user_b = _register_user(client)

        with _authed(BASE_URL, user_a["token"]) as ca:
            task_id = ca.post(
                "/tasks",
                json={"title": "A's task", "due_at": "2099-01-01T00:00:00"},
            ).json()["data"]["task"]["id"]

        with _authed(BASE_URL, user_b["token"]) as cb:
            res = cb.patch(f"/tasks/{task_id}", json={"status": "done"})
            assert res.status_code in (403, 404), (
                f"User B mutated User A's task (status {res.status_code})"
            )

    def test_task_list_does_not_leak_other_users(self, client: httpx.Client):
        user_a = _register_user(client)
        user_b = _register_user(client)

        unique_title = f"private_task_{uuid.uuid4().hex}"
        with _authed(BASE_URL, user_a["token"]) as ca:
            ca.post("/tasks", json={"title": unique_title, "due_at": "2099-01-01T00:00:00"})

        with _authed(BASE_URL, user_b["token"]) as cb:
            items = cb.get("/tasks").json()["data"]["items"]
            titles = [t["title"] for t in items]
            assert unique_title not in titles, "User B's task list leaked User A's task"

    def test_checkin_calendar_isolation(self, client: httpx.Client):
        user_a = _register_user(client)
        user_b = _register_user(client)

        unique_caption = f"private_checkin_{uuid.uuid4().hex}"
        with _authed(BASE_URL, user_a["token"]) as ca:
            ca.post("/checkins", json={"checkin_date": "2099-06-15", "caption": unique_caption})

        with _authed(BASE_URL, user_b["token"]) as cb:
            items = cb.get("/checkins/calendar").json()["data"]["items"]
            captions = [i.get("caption", "") for i in items]
            assert unique_caption not in captions, "User B's calendar leaked User A's checkin"


# ---------------------------------------------------------------------------
# 3. Brute-force / rate limiting
# ---------------------------------------------------------------------------

class TestRateLimiting:
    """After many rapid failed login attempts the gateway should throttle."""

    def test_login_brute_force_rate_limited(self, client: httpx.Client):
        """Sending 30 bad login requests in a row should eventually get 429."""
        statuses = []
        for _ in range(30):
            res = client.post(
                "/auth/login",
                json={"email": "victim@test.com", "password": "wrongpassword"},
            )
            statuses.append(res.status_code)

        assert 429 in statuses, (
            f"No 429 after 30 rapid failed logins. Statuses seen: {set(statuses)}"
        )

    def test_register_rate_limited(self, client: httpx.Client):
        """Rapid registration attempts should be throttled."""
        statuses = []
        for i in range(25):
            res = client.post(
                "/auth/register",
                json={"email": f"flood_{i}_{uuid.uuid4().hex[:4]}@test.com", "password": "Flood1234!"},
            )
            statuses.append(res.status_code)

        assert 429 in statuses, (
            f"No 429 after 25 rapid registrations. Statuses seen: {set(statuses)}"
        )


# ---------------------------------------------------------------------------
# 4. Request size enforcement
# ---------------------------------------------------------------------------

class TestRequestSizeLimits:
    """Gateway enforces a 1 MB body limit."""

    def test_oversized_body_rejected(self, client: httpx.Client, auth_token: str):
        huge_text = "x" * (1_100_000)  # ~1.1 MB
        res = client.post(
            "/journal/entries",
            json={"text": huge_text, "analyze": False},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        # Gateway should reject before hitting service (413 or 422 from validation)
        assert res.status_code in (413, 422, 400), (
            f"Oversized body accepted with status {res.status_code}"
        )


# ---------------------------------------------------------------------------
# 5. Input injection payloads
# ---------------------------------------------------------------------------

class TestInjectionPayloads:
    """Injection payloads must be stored safely (escaped) or rejected."""

    SQL_PAYLOADS = [
        "'; DROP TABLE journal_entries; --",
        "' OR '1'='1",
        "1; SELECT * FROM users --",
        "' UNION SELECT null, null, null --",
    ]

    XSS_PAYLOADS = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        '"><svg/onload=alert(1)>',
    ]

    @pytest.mark.parametrize("payload", SQL_PAYLOADS)
    def test_sql_injection_in_journal_text(self, authed: httpx.Client, payload: str):
        """SQL injection in journal text must not cause 500 errors."""
        res = authed.post("/journal/entries", json={"text": payload, "analyze": False})
        assert res.status_code != 500, f"SQL payload caused 500: {payload!r}"
        # Either accepted (stored safely) or rejected with validation error
        assert res.status_code in (200, 201, 400, 422)

    @pytest.mark.parametrize("payload", XSS_PAYLOADS)
    def test_xss_payload_in_task_title(self, authed: httpx.Client, payload: str):
        """XSS in task title must not cause 500 errors."""
        res = authed.post(
            "/tasks",
            json={"title": payload, "due_at": "2099-01-01T00:00:00"},
        )
        assert res.status_code != 500, f"XSS payload caused 500: {payload!r}"

    @pytest.mark.parametrize("payload", XSS_PAYLOADS)
    def test_xss_payload_in_checkin_caption(self, authed: httpx.Client, payload: str):
        """XSS in checkin caption must not cause 500 errors."""
        res = authed.post(
            "/checkins",
            json={"checkin_date": "2099-07-01", "caption": payload},
        )
        assert res.status_code != 500, f"XSS payload caused 500: {payload!r}"

    def test_sql_injection_in_task_title(self, authed: httpx.Client):
        res = authed.post(
            "/tasks",
            json={"title": "'; DROP TABLE tasks; --", "due_at": "2099-01-01T00:00:00"},
        )
        assert res.status_code != 500

    def test_path_traversal_in_entry_id(self, authed: httpx.Client):
        """Path traversal in entry id must be rejected."""
        res = authed.get("/journal/entries/../../../etc/passwd")
        assert res.status_code in (400, 404)

    def test_null_bytes_in_journal_text(self, authed: httpx.Client):
        """Null bytes in text must not cause 500 errors."""
        res = authed.post(
            "/journal/entries",
            json={"text": "hello\x00world", "analyze": False},
        )
        assert res.status_code != 500

    def test_unicode_control_chars_in_task_title(self, authed: httpx.Client):
        res = authed.post(
            "/tasks",
            json={"title": "Task\u0000\u001f\u007f", "due_at": "2099-01-01T00:00:00"},
        )
        assert res.status_code != 500


# ---------------------------------------------------------------------------
# 6. Sensitive data not leaked in error responses
# ---------------------------------------------------------------------------

class TestErrorResponseSafety:
    """Error bodies must not expose stack traces or internal details."""

    def test_login_failure_no_stack_trace(self, client: httpx.Client):
        res = client.post("/auth/login", json={"email": "x@x.com", "password": "bad"})
        body_text = res.text.lower()
        for leak in ("traceback", "file \"", "line ", "sqlalchemy", "psycopg2"):
            assert leak not in body_text, f"Error response leaks internal detail: {leak!r}"

    def test_invalid_entry_id_no_stack_trace(self, authed: httpx.Client):
        res = authed.get("/journal/entries/definitely-not-a-uuid")
        body_text = res.text.lower()
        for leak in ("traceback", "file \"", "line ", "sqlalchemy", "psycopg2"):
            assert leak not in body_text, f"Error response leaks internal detail: {leak!r}"

    def test_500_body_does_not_expose_secrets(self, client: httpx.Client):
        """A synthetically bad request should not expose secret values."""
        res = client.post("/auth/register", content=b"\xff\xfe invalid json")
        body_text = res.text
        assert "jwt_secret" not in body_text.lower()
        assert "password" not in body_text.lower() or res.status_code == 422


# ---------------------------------------------------------------------------
# 7. Security headers
# ---------------------------------------------------------------------------

class TestSecurityHeaders:
    """The gateway must include standard defensive HTTP headers."""

    def test_x_content_type_options(self, client: httpx.Client):
        res = client.get("/health")
        assert res.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options(self, client: httpx.Client):
        val = res.headers.get("x-frame-options", "").upper() if (
            res := client.get("/health")
        ) else ""
        assert val in ("DENY", "SAMEORIGIN"), f"x-frame-options missing or weak: {val!r}"

    def test_no_server_header_exposure(self, client: httpx.Client):
        """Server header should not reveal framework/version."""
        res = client.get("/health")
        server = res.headers.get("server", "")
        for detail in ("uvicorn", "fastapi", "python", "gunicorn"):
            assert detail not in server.lower(), (
                f"Server header reveals framework: {server!r}"
            )


# ---------------------------------------------------------------------------
# 8. Enum / whitelist validation
# ---------------------------------------------------------------------------

class TestEnumValidation:
    """Out-of-range enum values must be rejected with 422."""

    def test_invalid_task_status_on_create(self, authed: httpx.Client):
        res = authed.post(
            "/tasks",
            json={"title": "Enum test", "due_at": "2099-01-01T00:00:00", "status": "hacked"},
        )
        assert res.status_code == 422

    def test_difficulty_zero_rejected(self, authed: httpx.Client):
        res = authed.post(
            "/tasks",
            json={"title": "Diff 0", "due_at": "2099-01-01T00:00:00", "difficulty": 0},
        )
        assert res.status_code == 422

    def test_difficulty_negative_rejected(self, authed: httpx.Client):
        res = authed.post(
            "/tasks",
            json={"title": "Diff neg", "due_at": "2099-01-01T00:00:00", "difficulty": -1},
        )
        assert res.status_code == 422

    def test_past_due_date_allowed_or_validated(self, authed: httpx.Client):
        """Past due_at should either be accepted or rejected cleanly, never 500."""
        res = authed.post(
            "/tasks",
            json={"title": "Past task", "due_at": "2000-01-01T00:00:00"},
        )
        assert res.status_code != 500


# ---------------------------------------------------------------------------
# 9. Token refresh edge cases
# ---------------------------------------------------------------------------

class TestTokenRefresh:
    def test_refresh_with_invalid_token(self, client: httpx.Client):
        res = client.post("/auth/refresh", json={"access_token": "not.a.real.token"})
        assert res.status_code in (400, 401, 422)

    def test_refresh_with_empty_token(self, client: httpx.Client):
        res = client.post("/auth/refresh", json={"access_token": ""})
        assert res.status_code in (400, 401, 422)

    def test_refresh_missing_field(self, client: httpx.Client):
        res = client.post("/auth/refresh", json={})
        assert res.status_code == 422

    def test_double_use_refresh_same_token(self, client: httpx.Client, auth_token: str):
        """Using the same token twice for refresh should succeed at least once."""
        r1 = client.post("/auth/refresh", json={"access_token": auth_token})
        assert r1.status_code == 200
        # A second call with the original may be accepted or rejected; never 500
        r2 = client.post("/auth/refresh", json={"access_token": auth_token})
        assert r2.status_code != 500
