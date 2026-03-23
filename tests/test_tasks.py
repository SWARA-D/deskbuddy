"""Integration tests — Tasks Service (/tasks/*)"""
import pytest
import httpx
from datetime import datetime, timedelta


def _future_date(days: int = 3) -> str:
    return (datetime.now() + timedelta(days=days)).isoformat()


def test_create_task(authed: httpx.Client):
    res = authed.post("/tasks", json={"title": "Write tests", "due_at": _future_date(), "difficulty": 2})
    assert res.status_code == 200
    task = res.json()["data"]["task"]
    assert task["title"] == "Write tests"
    assert task["status"] == "todo"


def test_list_tasks(authed: httpx.Client):
    res = authed.get("/tasks")
    assert res.status_code == 200
    assert isinstance(res.json()["data"]["items"], list)


def test_update_task_status(authed: httpx.Client):
    create_res = authed.post("/tasks", json={"title": "Update me", "due_at": _future_date()})
    task_id = create_res.json()["data"]["task"]["id"]

    patch_res = authed.patch(f"/tasks/{task_id}", json={"status": "done"})
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["task"]["status"] == "done"


def test_invalid_status(authed: httpx.Client):
    create_res = authed.post("/tasks", json={"title": "Status test", "due_at": _future_date()})
    task_id = create_res.json()["data"]["task"]["id"]

    res = authed.patch(f"/tasks/{task_id}", json={"status": "invalid_status"})
    assert res.status_code == 422


def test_difficulty_out_of_range(authed: httpx.Client):
    res = authed.post("/tasks", json={"title": "Hard task", "due_at": _future_date(), "difficulty": 10})
    assert res.status_code == 422


def test_invalid_due_at(authed: httpx.Client):
    res = authed.post("/tasks", json={"title": "Bad date", "due_at": "not-a-date"})
    assert res.status_code == 422


def test_empty_title(authed: httpx.Client):
    res = authed.post("/tasks", json={"title": "   ", "due_at": _future_date()})
    assert res.status_code == 422


def test_invalid_task_id(authed: httpx.Client):
    res = authed.patch("/tasks/not-a-uuid", json={"status": "done"})
    assert res.status_code == 400
