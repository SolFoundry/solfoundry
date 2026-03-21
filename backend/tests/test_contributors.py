"""Tests for contributor profiles API."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import contributor_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_store():
    contributor_service._store.clear()
    yield
    contributor_service._store.clear()


def _create(username="alice", display_name=None, skills=None, badges=None):
    if display_name is None: display_name = username.capitalize()
    from app.models.contributor import ContributorCreate

    return contributor_service.create_contributor(
        ContributorCreate(
            username=username,
            display_name=display_name,
            skills=skills or ["python"],
            badges=badges or [],
        )
    )


def test_create_success():
    resp = client.post(
        "/api/contributors", json={"username": "alice", "display_name": "Alice"}
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "alice"
    assert resp.json()["stats"]["total_contributions"] == 0


def test_create_duplicate():
    _create("bob")
    resp = client.post(
        "/api/contributors", json={"username": "bob", "display_name": "Bob"}
    )
    assert resp.status_code == 409


def test_create_invalid_username():
    resp = client.post(
        "/api/contributors", json={"username": "a b", "display_name": "Bad"}
    )
    assert resp.status_code == 422


def test_list_empty():
    resp = client.get("/api/contributors")
    assert resp.json()["total"] == 0


def test_list_with_data():
    _create("alice")
    _create("bob")
    assert client.get("/api/contributors").json()["total"] == 2


def test_search():
    _create("alice")
    _create("bob")
    resp = client.get("/api/contributors?search=alice")
    assert resp.json()["total"] == 1


def test_filter_skills():
    _create("alice", skills=["python", "rust"])
    _create("bob", skills=["javascript"])
    resp = client.get("/api/contributors?skills=rust")
    assert resp.json()["total"] == 1


def test_filter_badges():
    _create("alice", badges=["early_adopter"])
    resp = client.get("/api/contributors?badges=early_adopter")
    assert resp.json()["total"] == 1


def test_pagination():
    for i in range(5):
        _create(f"user{i}")
    resp = client.get("/api/contributors?skip=0&limit=2")
    assert resp.json()["total"] == 5
    assert len(resp.json()["items"]) == 2


def test_get_by_id():
    c = _create("alice")
    resp = client.get(f"/api/contributors/{c.id}")
    assert resp.status_code == 200


def test_get_not_found():
    assert client.get("/api/contributors/nope").status_code == 404


def test_update():
    c = _create("alice")
    resp = client.patch(f"/api/contributors/{c.id}", json={"display_name": "Updated"})
    assert resp.json()["display_name"] == "Updated"


def test_delete():
    c = _create("alice")
    assert client.delete(f"/api/contributors/{c.id}").status_code == 204
