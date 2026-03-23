"""Integration tests — Journal Service (/journal/*)"""
import pytest
import httpx


def test_create_entry(authed: httpx.Client):
    res = authed.post("/journal/entries", json={"text": "Today was a good day.", "analyze": False})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["entry"]["text"] == "Today was a good day."
    assert "id" in body["data"]["entry"]


def test_list_entries(authed: httpx.Client):
    res = authed.get("/journal/entries")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["data"]["items"], list)


def test_get_entry(authed: httpx.Client):
    # Create then fetch
    create_res = authed.post("/journal/entries", json={"text": "Specific entry text.", "analyze": False})
    entry_id = create_res.json()["data"]["entry"]["id"]

    res = authed.get(f"/journal/entries/{entry_id}")
    assert res.status_code == 200
    assert res.json()["data"]["entry"]["text"] == "Specific entry text."


def test_delete_entry(authed: httpx.Client):
    create_res = authed.post("/journal/entries", json={"text": "Delete me.", "analyze": False})
    entry_id = create_res.json()["data"]["entry"]["id"]

    del_res = authed.delete(f"/journal/entries/{entry_id}")
    assert del_res.status_code == 200

    # Should be gone
    get_res = authed.get(f"/journal/entries/{entry_id}")
    assert get_res.status_code == 404


def test_create_entry_with_analysis(authed: httpx.Client):
    """Creating an entry with analyze=True should return analysis data."""
    res = authed.post("/journal/entries", json={"text": "I feel really happy and excited today!", "analyze": True})
    assert res.status_code == 200
    body = res.json()
    analysis = body["data"]["analysis"]
    # Analysis may be None if NLP service is down, but should not error
    if analysis is not None:
        assert "sentiment" in analysis
        assert "emotion" in analysis


def test_text_too_long(authed: httpx.Client):
    res = authed.post("/journal/entries", json={"text": "x" * 10_001})
    assert res.status_code == 422


def test_empty_text(authed: httpx.Client):
    res = authed.post("/journal/entries", json={"text": "   "})
    assert res.status_code == 422


def test_invalid_entry_id(authed: httpx.Client):
    res = authed.get("/journal/entries/not-a-uuid")
    assert res.status_code == 400


def test_list_limit_cap(authed: httpx.Client):
    """limit param above 100 should be capped, not error."""
    res = authed.get("/journal/entries?limit=99999")
    assert res.status_code == 200
