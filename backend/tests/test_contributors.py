"""Tests for contributor profiles API.

Tests verify CRUD operations through the HTTP API layer. All service
functions are async (DB-first reads) and are exercised via the ASGI
event loop through TestClient. DB reads are stubbed out to prevent
cross-test contamination from shared SQLite in-memory databases.
"""

import os
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.contributors import router as contributors_router
from app.services import contributor_service
import app.services.contributor_service as _cs_mod
import app.services.pg_store as _pg_mod

# Use a minimal test app to avoid lifespan side effects
_test_app = FastAPI()
_test_app.include_router(contributors_router, prefix="/api")
client = TestClient(_test_app)

# Save originals at import time
_ORIG_LOAD_ALL = _cs_mod._load_all_contributors_from_db
_ORIG_LOAD_ONE = _cs_mod._load_contributor_from_db
_ORIG_BY_USERNAME = _pg_mod.get_contributor_by_username


async def _stub_none():
    return None


async def _stub_none_arg(_):
    return None


@pytest.fixture(autouse=True)
def clear_store():
    """Clear cache and stub DB reads so tests use cache only."""
    contributor_service._store.clear()
    _cs_mod._load_all_contributors_from_db = _stub_none
    _cs_mod._load_contributor_from_db = _stub_none_arg
    _pg_mod.get_contributor_by_username = _stub_none_arg
    yield
    contributor_service._store.clear()
    _cs_mod._load_all_contributors_from_db = _ORIG_LOAD_ALL
    _cs_mod._load_contributor_from_db = _ORIG_LOAD_ONE
    _pg_mod.get_contributor_by_username = _ORIG_BY_USERNAME


def _create_via_api(username="alice", display_name=None, skills=None, badges=None):
    """Create a contributor through the HTTP API and return the response dict.

    If display_name is not provided, it defaults to the capitalized username
    to avoid false matches in search tests.
    """
    if display_name is None:
        display_name = username.capitalize()
    payload = {
        "username": username,
        "display_name": display_name,
        "skills": skills or ["python"],
        "badges": badges or [],
    }
    resp = client.post("/api/contributors", json=payload)
    assert resp.status_code == 201, f"Create failed: {resp.text}"
    return resp.json()


def test_create_success():
    """Successfully create a contributor via the API."""
    resp = client.post(
        "/api/contributors", json={"username": "alice", "display_name": "Alice"}
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "alice"
    assert resp.json()["stats"]["total_contributions"] == 0


def test_create_duplicate():
    """Reject duplicate username with 409."""
    _create_via_api("bob", "Bob")
    resp = client.post(
        "/api/contributors", json={"username": "bob", "display_name": "Bob"}
    )
    assert resp.status_code == 409


def test_create_invalid_username():
    """Reject username with spaces via Pydantic validation."""
    resp = client.post(
        "/api/contributors", json={"username": "a b", "display_name": "Bad"}
    )
    assert resp.status_code == 422


def test_list_empty():
    """Return empty list when no contributors exist."""
    resp = client.get("/api/contributors")
    assert resp.json()["total"] == 0


def test_list_with_data():
    """Return all contributors when no filters applied."""
    _create_via_api("alice")
    _create_via_api("bob")
    assert client.get("/api/contributors").json()["total"] == 2


def test_search():
    """Filter contributors by search query substring."""
    _create_via_api("alice")
    _create_via_api("bob")
    resp = client.get("/api/contributors?search=alice")
    assert resp.json()["total"] == 1


def test_filter_skills():
    """Filter contributors by skill overlap."""
    _create_via_api("alice", skills=["python", "rust"])
    _create_via_api("bob", skills=["javascript"])
    resp = client.get("/api/contributors?skills=rust")
    assert resp.json()["total"] == 1


def test_filter_badges():
    """Filter contributors by badge membership."""
    _create_via_api("alice", badges=["early_adopter"])
    resp = client.get("/api/contributors?badges=early_adopter")
    assert resp.json()["total"] == 1


def test_pagination():
    """Verify pagination with skip and limit."""
    for i in range(5):
        _create_via_api(f"user{i}")
    resp = client.get("/api/contributors?skip=0&limit=2")
    assert resp.json()["total"] == 5
    assert len(resp.json()["items"]) == 2


def test_get_by_id():
    """Retrieve a contributor by ID."""
    c = _create_via_api("alice")
    resp = client.get(f"/api/contributors/{c['id']}")
    assert resp.status_code == 200


def test_get_not_found():
    """Return 404 for non-existent contributor."""
    assert client.get("/api/contributors/nope").status_code == 404


def test_update():
    """Update a contributor's display name."""
    c = _create_via_api("alice")
    resp = client.patch(f"/api/contributors/{c['id']}", json={"display_name": "Updated"})
    assert resp.json()["display_name"] == "Updated"


def test_delete():
    """Delete a contributor and verify 204 response."""
    c = _create_via_api("alice")
    assert client.delete(f"/api/contributors/{c['id']}").status_code == 204
