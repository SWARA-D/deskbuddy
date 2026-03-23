"""Integration tests — Bot Service (/bot/message)"""
import pytest
import httpx


def test_bot_greeting(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "Hello!"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert isinstance(body["data"]["reply"], str)
    assert len(body["data"]["reply"]) > 0


def test_bot_task_intent(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "add a new task"})
    assert res.status_code == 200
    assert res.json()["data"]["intent"] == "add_task"


def test_bot_music_intent(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "suggest a playlist"})
    assert res.status_code == 200
    assert res.json()["data"]["intent"] == "music"


def test_bot_journal_intent(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "I want to write in my journal"})
    assert res.status_code == 200
    assert res.json()["data"]["intent"] == "journal"


def test_bot_streak_intent(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "show my streak"})
    assert res.status_code == 200
    assert res.json()["data"]["intent"] == "streak"


def test_bot_help_intent(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "help"})
    assert res.status_code == 200
    assert res.json()["data"]["intent"] == "help"


def test_bot_unknown_intent(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "xyzzy frobnicator"})
    assert res.status_code == 200
    assert res.json()["data"]["intent"] == "unknown"


def test_bot_message_too_long(authed: httpx.Client):
    res = authed.post("/bot/message", json={"message": "x" * 501})
    assert res.status_code == 422


def test_bot_rate_limit(authed: httpx.Client):
    """Sending 11+ messages rapidly should trigger 429."""
    responses = [
        authed.post("/bot/message", json={"message": f"message {i}"})
        for i in range(12)
    ]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, "Rate limit was not triggered after 10 requests"


def test_bot_unauthenticated(client: httpx.Client):
    res = client.post("/bot/message", json={"message": "hello"})
    assert res.status_code == 401
