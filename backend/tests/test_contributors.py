"""Tests for contributor profiles API with PostgreSQL persistence.

Verifies that the contributor CRUD endpoints work correctly against
the async PostgreSQL-backed contributor service.  Uses an in-memory
SQLite database for test isolation.
"""

import uuid
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import engine
from app.api.contributors import router as contributors_router
from app.models.contributor import ContributorCreate, ContributorTable
from app.services import contributor_service
from tests.conftest import run_async

# Use a minimal test app to avoid lifespan side effects
_test_app = FastAPI()
_test_app.include_router(contributors_router, prefix="/api")
client = TestClient(_test_app)


@pytest.fixture(autouse=True)
def clean_database():
    """Reset the contributors table before and after each test.

    Deletes all rows to ensure full isolation between tests.
    """

    async def _clear():
        """Delete all rows from the contributors table."""
        from sqlalchemy import delete

        async with engine.begin() as conn:
            await conn.execute(delete(ContributorTable))

    run_async(_clear())
    contributor_service._store.clear()
    yield
    run_async(_clear())
    contributor_service._store.clear()


def _create(username="alice", display_name="Alice", skills=None, badges=None):
    """Helper to create a contributor via the async service.

    Args:
        username: GitHub username.
        display_name: Display name.
        skills: List of skill strings.
        badges: List of badge strings.

    Returns:
        A ``ContributorResponse`` for the newly created contributor.
    """
    return run_async(
        contributor_service.create_contributor(
            ContributorCreate(
                username=username,
                display_name=display_name,
                skills=skills or ["python"],
                badges=badges or [],
            )
        )
    )


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


# -- Create endpoint tests --------------------------------------------------


def test_create_success():
    """POST /contributors creates a new contributor and returns 201."""
    resp = client.post(
        "/api/contributors",
        json={"username": "alice", "display_name": "Alice"},
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "alice"
    assert resp.json()["stats"]["total_contributions"] == 0


def test_create_duplicate():
    """POST /contributors with existing username returns 409."""
    _create("bob")
    resp = client.post(
        "/api/contributors",
        json={"username": "bob", "display_name": "Bob"},
    )
    assert resp.status_code == 409


def test_create_invalid_username():
    """POST /contributors with spaces in username returns 422."""
    resp = client.post(
        "/api/contributors",
        json={"username": "a b", "display_name": "Bad"},
    )
    assert resp.status_code == 422


# -- List endpoint tests ----------------------------------------------------


def test_list_empty():
    """GET /contributors with no data returns total=0."""
    resp = client.get("/api/contributors")
    assert resp.json()["total"] == 0


def test_list_with_data():
    """GET /contributors returns correct total with seeded data."""
    _create("alice")
    _create("bob")
    assert client.get("/api/contributors").json()["total"] == 2


def test_search():
    """GET /contributors?search= filters by username substring."""
    client.post(
        "/api/contributors", json={"username": "alice", "display_name": "Alice"}
    )
    client.post(
        "/api/contributors", json={"username": "bob", "display_name": "Bob"}
    )
    resp = client.get("/api/contributors?search=alice")
    assert resp.json()["total"] == 1


def test_filter_skills():
    """GET /contributors?skills= filters by skill name."""
    _create("alice", skills=["python", "rust"])
    _create("bob", skills=["javascript"])
    resp = client.get("/api/contributors?skills=rust")
    assert resp.json()["total"] == 1


def test_filter_badges():
    """GET /contributors?badges= filters by badge name."""
    _create("alice", badges=["early_adopter"])
    resp = client.get("/api/contributors?badges=early_adopter")
    assert resp.json()["total"] == 1


def test_pagination():
    """GET /contributors respects skip and limit parameters."""
    for i in range(5):
        _create_via_api(f"user{i}")
    resp = client.get("/api/contributors?skip=0&limit=2")
    assert resp.json()["total"] == 5
    assert len(resp.json()["items"]) == 2


# -- Get by ID tests -------------------------------------------------------


def test_get_by_id():
    """GET /contributors/{id} returns 200 for existing contributor."""
    contributor = _create("alice")
    resp = client.get(f"/api/contributors/{contributor.id}")
    assert resp.status_code == 200


def test_get_not_found():
    """GET /contributors/{id} returns 404 for non-existent ID."""
    assert client.get("/api/contributors/nope").status_code == 404


# -- Update tests -----------------------------------------------------------


def test_update():
    """PATCH /contributors/{id} updates the display name."""
    contributor = _create("alice")
    resp = client.patch(
        f"/api/contributors/{contributor.id}",
        json={"display_name": "Updated"},
    )
    assert resp.json()["display_name"] == "Updated"


# -- Delete tests -----------------------------------------------------------


def test_delete():
    """DELETE /contributors/{id} returns 204 on success."""
    contributor = _create("alice")
    assert client.delete(f"/api/contributors/{contributor.id}").status_code == 204


def test_delete_not_found():
    """DELETE /contributors/{id} returns 404 for non-existent ID."""
    fake_id = str(uuid.uuid4())
    assert client.delete(f"/api/contributors/{fake_id}").status_code == 404


# -- Persistence tests (new for PostgreSQL migration) -----------------------


def test_contributor_persists_after_create():
    """Created contributor is retrievable by ID from the database."""
    contributor = _create("persistent")
    fetched = run_async(contributor_service.get_contributor(contributor.id))
    assert fetched is not None
    assert fetched.username == "persistent"


def test_upsert_creates_new():
    """upsert_contributor creates a new row when username does not exist."""
    row = run_async(
        contributor_service.upsert_contributor(
            {
                "id": uuid.uuid4(),
                "username": "upsert_new",
                "display_name": "Upsert New",
                "total_earnings": Decimal("1000"),
                "reputation_score": 50.0,
            }
        )
    )
    assert row.username == "upsert_new"


def test_upsert_updates_existing():
    """upsert_contributor updates an existing row by username."""
    _create("upsert_existing", display_name="Original")
    row = run_async(
        contributor_service.upsert_contributor(
            {
                "id": uuid.uuid4(),
                "username": "upsert_existing",
                "display_name": "Updated Via Upsert",
                "total_earnings": Decimal("5000"),
                "reputation_score": 75.0,
            }
        )
    )
    assert row.display_name == "Updated Via Upsert"


def test_count_contributors():
    """count_contributors returns correct total."""
    _create("count_a")
    _create("count_b")
    count = run_async(contributor_service.count_contributors())
    assert count == 2


def test_list_contributor_ids():
    """list_contributor_ids returns all UUIDs."""
    _create("id_a")
    _create("id_b")
    ids = run_async(contributor_service.list_contributor_ids())
    assert len(ids) == 2


def test_get_contributor_by_username():
    """get_contributor_by_username returns correct contributor."""
    _create("username_lookup")
    result = run_async(
        contributor_service.get_contributor_by_username("username_lookup")
    )
    assert result is not None
    assert result.username == "username_lookup"


def test_get_contributor_by_username_not_found():
    """get_contributor_by_username returns None for missing username."""
    result = run_async(
        contributor_service.get_contributor_by_username("nonexistent")
    )
    assert result is None


def test_update_reputation_score():
    """update_reputation_score persists the new score."""
    contributor = _create("rep_update")

    async def _update_and_check():
        """Update score then verify."""
        await contributor_service.update_reputation_score(contributor.id, 42.5)
        return await contributor_service.get_contributor_db(contributor.id)

    row = run_async(_update_and_check())
    assert row is not None
    assert row.reputation_score == 42.5


def test_numeric_earnings_precision():
    """total_earnings uses Numeric for financial precision."""
    row = run_async(
        contributor_service.upsert_contributor(
            {
                "id": uuid.uuid4(),
                "username": "precise_earner",
                "display_name": "Precise",
                "total_earnings": Decimal("1234567.89"),
                "reputation_score": 0.0,
            }
        )
    )
    assert float(row.total_earnings) == 1234567.89


def test_refresh_store_cache():
    """refresh_store_cache populates _store from database."""
    _create("cache_test")
    run_async(contributor_service.refresh_store_cache())
    assert len(contributor_service._store) >= 1
    usernames = [c.username for c in contributor_service._store.values()]
    assert "cache_test" in usernames


def test_stats_in_response():
    """ContributorResponse includes correct stats object."""
    contributor = _create("stats_user")
    assert contributor.stats.total_contributions == 0
    assert contributor.stats.total_bounties_completed == 0
    assert contributor.stats.total_earnings == 0.0
    assert contributor.stats.reputation_score == 0.0


def test_backward_compatible_schema():
    """API response matches the original Pydantic schema exactly."""
    resp = client.post(
        "/api/contributors",
        json={
            "username": "schema_check",
            "display_name": "Schema Check",
            "skills": ["python"],
            "badges": ["tier-1"],
            "social_links": {"github": "https://github.com/test"},
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert "username" in data
    assert "display_name" in data
    assert "email" in data
    assert "avatar_url" in data
    assert "bio" in data
    assert "skills" in data
    assert "badges" in data
    assert "social_links" in data
    assert "stats" in data
    assert "created_at" in data
    assert "updated_at" in data
    stats = data["stats"]
    assert "total_contributions" in stats
    assert "total_bounties_completed" in stats
    assert "total_earnings" in stats
    assert "reputation_score" in stats
