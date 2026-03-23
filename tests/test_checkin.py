"""Integration tests — Checkin Service (/checkins/*)"""
import pytest
import httpx
from datetime import date, timedelta


def _today() -> str:
    return date.today().isoformat()

def _yesterday() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


def test_checkin(authed: httpx.Client):
    res = authed.post("/checkins", json={"checkin_date": _today(), "caption": "Feeling good!"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["checkin_date"] == _today()
    assert "streak" in body["data"]


def test_checkin_upsert(authed: httpx.Client):
    """Checking in twice on the same day should update the caption, not error."""
    authed.post("/checkins", json={"checkin_date": _today(), "caption": "First caption"})
    res = authed.post("/checkins", json={"checkin_date": _today(), "caption": "Updated caption"})
    assert res.status_code == 200


def test_streak(authed: httpx.Client):
    res = authed.get("/checkins/streak")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "current" in data
    assert "longest" in data
    assert isinstance(data["current"], int)
    assert isinstance(data["longest"], int)
    assert data["current"] >= 1  # we just checked in


def test_calendar(authed: httpx.Client):
    res = authed.get("/checkins/calendar")
    assert res.status_code == 200
    items = res.json()["data"]["items"]
    assert isinstance(items, list)
    assert any(item["checkin_date"] == _today() for item in items)


def test_invalid_date(authed: httpx.Client):
    res = authed.post("/checkins", json={"checkin_date": "not-a-date"})
    assert res.status_code == 422


def test_caption_too_long(authed: httpx.Client):
    res = authed.post("/checkins", json={"checkin_date": _today(), "caption": "x" * 501})
    assert res.status_code == 422


def test_streak_increases_with_consecutive_days(authed: httpx.Client):
    """Check in yesterday and today — streak should be at least 2."""
    authed.post("/checkins", json={"checkin_date": _yesterday()})
    authed.post("/checkins", json={"checkin_date": _today()})
    res = authed.get("/checkins/streak")
    assert res.json()["data"]["current"] >= 2
