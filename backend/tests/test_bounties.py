"""Comprehensive tests for Bounty CRUD REST API (Issue #3).

Covers: create, list (pagination/filters), get, update (with status transitions),
delete, submit solution, list submissions, and edge cases.

All bounty service mutations are now async. The TestClient's synchronous
interface triggers them via the ASGI loop automatically.
"""

import os
from collections import deque

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.api.bounties import router as bounties_router
from app.models.bounty import (
    BountyStatus,
    VALID_STATUS_TRANSITIONS,
)
from app.services import bounty_service

# ---------------------------------------------------------------------------
# Auth Mock
# ---------------------------------------------------------------------------

MOCK_USER = UserResponse(
    id="test-user-id",
    github_id="test-github-id",
    username="testuser",
    email="test@example.com",
    avatar_url="http://example.com/avatar.png",
    wallet_address="test-wallet-address",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)


async def override_get_current_user():
    """Return a mock user for test authentication."""
    return MOCK_USER


# ---------------------------------------------------------------------------
# Test app & client
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(bounties_router, prefix="/api")
_test_app.dependency_overrides[get_current_user] = override_get_current_user


@_test_app.get("/health")
async def health_check():
    """Simple health endpoint for integration sanity tests."""
    return {"status": "ok"}


client = TestClient(_test_app)

# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

import asyncio  # noqa: E402

@pytest.fixture(scope="module")
def event_loop():
    """Create a dedicated event loop for module-scoped async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def _init_db(event_loop):
    """Initialize the database schema once per module."""
    from app.database import init_db
    event_loop.run_until_complete(init_db())


VALID_BOUNTY = {
    "title": "Fix smart contract bug",
    "description": "There is a critical bug in the token transfer logic that needs fixing.",
    "tier": 2,
    "reward_amount": 500.0,
    "required_skills": ["solidity", "rust"],
}


@pytest.fixture(autouse=True)
def clear_store(event_loop):
    """Ensure each test starts and ends with empty bounty stores.

    Clears both the in-memory cache and the SQLite test database tables
    to ensure full isolation between tests.
    """
    from app.database import get_db_session

    async def _clear_db():
        from sqlalchemy import text
        try:
            async with get_db_session() as session:
                await session.execute(text("DELETE FROM bounty_submissions"))
                await session.execute(text("DELETE FROM bounties"))
                await session.commit()
        except Exception:
            pass

    bounty_service._bounty_store.clear()
    event_loop.run_until_complete(_clear_db())
    yield
    bounty_service._bounty_store.clear()
    event_loop.run_until_complete(_clear_db())


def _create_bounty(**overrides) -> dict:
    """Helper: create a bounty via the HTTP API and return its dict."""
    payload = {**VALID_BOUNTY, **overrides}
    resp = client.post("/api/bounties", json=payload)
    assert resp.status_code == 201, f"Create failed: {resp.text}"
    return resp.json()


def _status_path(start: BountyStatus, end: BountyStatus):
    """BFS through VALID_STATUS_TRANSITIONS to find a path from start to end."""
    if start == end:
        return [start]
    queue = deque([(start, [start])])
    seen = {start}
    while queue:
        current, path = queue.popleft()
        for next_status in VALID_STATUS_TRANSITIONS.get(current, set()):
            if next_status == end:
                return path + [next_status]
            if next_status not in seen:
                seen.add(next_status)
                queue.append((next_status, path + [next_status]))
    return None


# ===========================================================================
# CREATE
# ===========================================================================


class TestCreateBounty:
    """Tests for the POST /api/bounties endpoint."""

    def test_create_success(self):
        """Successfully create a bounty with all required fields."""
        resp = client.post("/api/bounties", json=VALID_BOUNTY)
        assert resp.status_code == 201
        body = resp.json()
        assert body["title"] == VALID_BOUNTY["title"]
        assert body["status"] == "open"
        assert body["tier"] == 2
        assert body["reward_amount"] == 500.0
        assert set(body["required_skills"]) == {"solidity", "rust"}
        assert body["submission_count"] == 0
        assert body["submissions"] == []
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body

    def test_create_with_all_fields(self):
        """Create a bounty with optional fields populated."""
        payload = {
            **VALID_BOUNTY,
            "deadline": "2026-12-31T23:59:59Z",
            "created_by": "alice",
            "github_issue_url": "https://github.com/org/repo/issues/42",
        }
        resp = client.post("/api/bounties", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["created_by"] == MOCK_USER.wallet_address
        assert body["github_issue_url"] == "https://github.com/org/repo/issues/42"
        assert "2026-12-31" in body["deadline"]

    def test_create_minimal(self):
        """Create a bounty with only required fields (title + reward)."""
        resp = client.post(
            "/api/bounties", json={"title": "Min bounty", "reward_amount": 1.0}
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["description"] == ""
        assert body["tier"] == 2
        assert body["created_by"] == MOCK_USER.wallet_address
        assert body["required_skills"] == []

    def test_create_invalid_title_empty(self):
        """Reject empty title."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": ""})
        assert resp.status_code == 422

    def test_create_invalid_title_too_short(self):
        """Reject title shorter than minimum length."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": "ab"})
        assert resp.status_code == 422

    def test_create_title_at_max_length(self):
        """Accept title at exactly the maximum length."""
        long_title = "A" * 200
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": long_title})
        assert resp.status_code == 201
        assert resp.json()["title"] == long_title

    def test_create_title_over_max_length(self):
        """Reject title exceeding maximum length."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": "A" * 201})
        assert resp.status_code == 422

    def test_create_invalid_reward_zero(self):
        """Reject zero reward amount."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": 0})
        assert resp.status_code == 422

    def test_create_invalid_reward_negative(self):
        """Reject negative reward amount."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": -10})
        assert resp.status_code == 422

    def test_create_reward_at_minimum(self):
        """Accept reward at the minimum boundary (0.01)."""
        resp = client.post(
            "/api/bounties", json={**VALID_BOUNTY, "reward_amount": 0.01}
        )
        assert resp.status_code == 201
        assert resp.json()["reward_amount"] == 0.01

    def test_create_reward_above_max(self):
        """Reject reward exceeding maximum."""
        resp = client.post(
            "/api/bounties", json={**VALID_BOUNTY, "reward_amount": 1_000_001}
        )
        assert resp.status_code == 422

    def test_create_invalid_tier(self):
        """Reject invalid tier value."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "tier": 99})
        assert resp.status_code == 422

    def test_create_tier_1(self):
        """Accept tier 1 bounty."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "tier": 1})
        assert resp.status_code == 201
        assert resp.json()["tier"] == 1

    def test_skills_normalised(self):
        """Verify skills are lowercased and trimmed."""
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": ["Rust", " SOLIDITY ", "  wasm  "]},
        )
        assert resp.status_code == 201
        skills = resp.json()["required_skills"]
        assert "rust" in skills
        assert "solidity" in skills
        assert "wasm" in skills

    def test_skills_empty_strings_filtered(self):
        """Verify empty skill strings are filtered out."""
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": ["", "  ", "rust"]},
        )
        assert resp.status_code == 201
        assert resp.json()["required_skills"] == ["rust"]

    def test_skills_too_many(self):
        """Reject skill list exceeding maximum count."""
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": [f"skill{i}" for i in range(25)]},
        )
        assert resp.status_code == 422

    def test_skills_invalid_format(self):
        """Reject skills with invalid characters (spaces)."""
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": ["valid", "has spaces"]},
        )
        assert resp.status_code == 422

    def test_create_special_characters_in_title(self):
        """Accept title with special characters (XSS-like content)."""
        title = "Fix bug: handle <script>alert(xss)</script> & quotes"
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": title})
        assert resp.status_code == 201
        assert resp.json()["title"] == title

    def test_create_invalid_github_url(self):
        """Reject non-GitHub URL in github_issue_url."""
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "github_issue_url": "https://gitlab.com/repo/issues/1"},
        )
        assert resp.status_code == 422

    def test_create_returns_unique_ids(self):
        """Verify each created bounty gets a unique ID."""
        ids = set()
        for _ in range(10):
            resp = client.post("/api/bounties", json=VALID_BOUNTY)
            ids.add(resp.json()["id"])
        assert len(ids) == 10


# ===========================================================================
# LIST
# ===========================================================================


class TestListBounties:
    """Tests for the GET /api/bounties endpoint."""

    def test_list_empty(self):
        """Return empty list when no bounties exist."""
        resp = client.get("/api/bounties")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []
        assert body["skip"] == 0
        assert body["limit"] == 20

    def test_list_with_data(self):
        """Return all bounties when no filters are applied."""
        _create_bounty(title="Bnt 1")
        _create_bounty(title="Bnt 2")
        body = client.get("/api/bounties").json()
        assert body["total"] == 2
        assert len(body["items"]) == 2

    def test_list_item_shape(self):
        """Verify list item contains expected keys."""
        _create_bounty()
        item = client.get("/api/bounties").json()["items"][0]
        expected_keys = {
            "id", "title", "tier", "reward_amount", "status",
            "required_skills", "github_issue_url", "deadline",
            "created_by", "submissions", "submission_count",
            "category", "creator_type", "created_at",
        }
        assert set(item.keys()) == expected_keys

    def test_filter_by_status(self):
        """Filter bounties by lifecycle status."""
        b = _create_bounty(title="Alpha")
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        _create_bounty(title="Beta")
        assert client.get("/api/bounties?status=open").json()["total"] == 1
        assert client.get("/api/bounties?status=in_progress").json()["total"] == 1
        assert client.get("/api/bounties?status=completed").json()["total"] == 0

    def test_filter_by_tier(self):
        """Filter bounties by tier."""
        _create_bounty(tier=1)
        _create_bounty(tier=2)
        _create_bounty(tier=3)
        assert client.get("/api/bounties?tier=1").json()["total"] == 1
        assert client.get("/api/bounties?tier=2").json()["total"] == 1
        assert client.get("/api/bounties?tier=3").json()["total"] == 1

    def test_filter_by_skills(self):
        """Filter bounties by required skills."""
        _create_bounty(title="Rust wasm project", required_skills=["rust", "wasm"])
        _create_bounty(title="Python project", required_skills=["python"])
        _create_bounty(title="Rust python mix", required_skills=["rust", "python"])
        assert client.get("/api/bounties?skills=rust").json()["total"] == 2
        assert client.get("/api/bounties?skills=wasm").json()["total"] == 1
        assert client.get("/api/bounties?skills=python").json()["total"] == 2

    def test_filter_skills_case_insensitive(self):
        """Verify skill filtering is case-insensitive."""
        _create_bounty(required_skills=["rust"])
        assert client.get("/api/bounties?skills=RUST").json()["total"] == 1

    def test_filter_skills_nonexistent(self):
        """Return empty when filtering by non-matching skill."""
        _create_bounty(required_skills=["rust"])
        assert client.get("/api/bounties?skills=java").json()["total"] == 0

    def test_pagination_basic(self):
        """Verify basic pagination with skip and limit."""
        for i in range(5):
            _create_bounty(title=f"Bounty {i}")
        body = client.get("/api/bounties?skip=0&limit=2").json()
        assert body["total"] == 5
        assert len(body["items"]) == 2

    def test_pagination_skip_beyond_total(self):
        """Return empty items when skip exceeds total count."""
        _create_bounty()
        _create_bounty()
        body = client.get("/api/bounties?skip=100&limit=10").json()
        assert body["total"] == 2
        assert body["items"] == []

    def test_pagination_limit_exceeds_remaining(self):
        """Return remaining items when limit exceeds what is available."""
        for i in range(3):
            _create_bounty(title=f"Bounty item {i}")
        body = client.get("/api/bounties?skip=1&limit=100").json()
        assert body["total"] == 3
        assert len(body["items"]) == 2

    def test_combined_filters(self):
        """Verify multiple filters can be combined."""
        _create_bounty(title="Match", tier=1, required_skills=["rust"])
        _create_bounty(title="Wrong tier", tier=2, required_skills=["rust"])
        _create_bounty(title="Wrong skill", tier=1, required_skills=["python"])
        assert client.get("/api/bounties?tier=1&skills=rust").json()["total"] == 1

    def test_limit_max_100(self):
        """Reject limit above maximum (100)."""
        resp = client.get("/api/bounties?limit=101")
        assert resp.status_code == 422

    def test_skip_negative(self):
        """Reject negative skip value."""
        resp = client.get("/api/bounties?skip=-1")
        assert resp.status_code == 422

    def test_limit_zero(self):
        """Reject zero limit."""
        resp = client.get("/api/bounties?limit=0")
        assert resp.status_code == 422


# ===========================================================================
# GET SINGLE
# ===========================================================================


class TestGetBounty:
    """Tests for the GET /api/bounties/{id} endpoint."""

    def test_get_success(self):
        """Retrieve a bounty by its ID."""
        b = _create_bounty()
        bid = b["id"]
        resp = client.get(f"/api/bounties/{bid}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == bid
        assert body["title"] == VALID_BOUNTY["title"]
        assert "submissions" in body
        assert "submission_count" in body

    def test_get_not_found(self):
        """Return 404 for non-existent bounty."""
        resp = client.get("/api/bounties/nonexistent-id")
        assert resp.status_code == 404
        body = resp.json()
        error_text = body.get("message", body.get("detail", "")).lower()
        assert "not found" in error_text

    def test_get_includes_submissions(self):
        """Verify get response includes submission data."""
        b = _create_bounty()
        bid = b["id"]
        client.post(
            f"/api/bounties/{bid}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/1", "submitted_by": "alice"},
        )
        body = client.get(f"/api/bounties/{bid}").json()
        assert body["submission_count"] == 1
        assert len(body["submissions"]) == 1
        assert body["submissions"][0]["submitted_by"] == MOCK_USER.wallet_address

    def test_get_response_shape(self):
        """Verify response contains all expected fields."""
        b = _create_bounty()
        bid = b["id"]
        body = client.get(f"/api/bounties/{bid}").json()
        required_keys = {
            "id", "title", "description", "tier", "reward_amount",
            "status", "creator_type", "github_issue_url", "required_skills",
            "deadline", "created_by", "submissions", "submission_count",
            "category", "github_issue_number", "github_repo",
            "created_at", "updated_at",
            "winner_submission_id", "winner_wallet", "payout_tx_hash",
            "payout_at", "claimed_by", "claimed_at", "claim_deadline",
        }
        assert set(body.keys()) == required_keys


# ===========================================================================
# UPDATE
# ===========================================================================


class TestUpdateBounty:
    """Tests for the PATCH /api/bounties/{id} endpoint."""

    def test_update_title(self):
        """Update bounty title."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"title": "New title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New title"

    def test_update_description(self):
        """Update bounty description."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"description": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated"

    def test_update_reward_amount(self):
        """Update bounty reward amount."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"reward_amount": 999.99})
        assert resp.status_code == 200
        assert resp.json()["reward_amount"] == 999.99

    def test_update_multiple_fields(self):
        """Update multiple fields in one PATCH request."""
        b = _create_bounty()
        resp = client.patch(
            f"/api/bounties/{b['id']}",
            json={"title": "Updated title", "description": "New desc", "reward_amount": 123.0},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Updated title"
        assert body["description"] == "New desc"
        assert body["reward_amount"] == 123.0

    def test_update_not_found(self):
        """Return 404 when updating non-existent bounty."""
        resp = client.patch("/api/bounties/nope", json={"title": "Anything"})
        assert resp.status_code == 404

    def test_update_invalid_title_too_short(self):
        """Reject title update shorter than minimum."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"title": "ab"})
        assert resp.status_code == 422

    def test_update_invalid_reward(self):
        """Reject negative reward update."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"reward_amount": -5})
        assert resp.status_code == 422

    def test_update_preserves_unset_fields(self):
        """Verify unset fields are not modified."""
        b = _create_bounty()
        original_desc = b["description"]
        resp = client.patch(f"/api/bounties/{b['id']}", json={"title": "Changed title"})
        assert resp.status_code == 200
        assert resp.json()["description"] == original_desc

    def test_update_skills_normalised(self):
        """Verify skills are normalised on update."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"required_skills": ["python", "go"]})
        assert resp.status_code == 200
        assert set(resp.json()["required_skills"]) == {"python", "go"}

    def test_update_updates_timestamp(self):
        """Verify updated_at changes on update."""
        b = _create_bounty()
        original_updated = b["updated_at"]
        resp = client.patch(f"/api/bounties/{b['id']}", json={"title": "New name"})
        new_updated = resp.json()["updated_at"]
        assert str(new_updated) >= str(original_updated)

    # --- Status transitions ---

    def test_status_open_to_in_progress(self):
        """Verify open to in_progress transition is allowed."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_status_full_lifecycle(self):
        """Verify full bounty lifecycle: open -> in_progress -> completed -> paid."""
        b = _create_bounty()
        for status in ["in_progress", "completed", "paid"]:
            resp = client.patch(f"/api/bounties/{b['id']}", json={"status": status})
            assert resp.status_code == 200
            assert resp.json()["status"] == status

    def test_invalid_open_to_completed(self):
        """Reject direct transition from open to completed."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        assert resp.status_code == 400
        assert "Invalid status transition" in resp.json().get("message", resp.json().get("detail", ""))

    def test_invalid_open_to_paid(self):
        """Reject direct transition from open to paid."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"status": "paid"})
        assert resp.status_code == 400

    def test_paid_is_terminal(self):
        """Verify paid is a terminal state (no transitions allowed)."""
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "paid"})
        for status in ["open", "in_progress", "completed"]:
            resp = client.patch(f"/api/bounties/{b['id']}", json={"status": status})
            assert resp.status_code == 400

    def test_in_progress_back_to_open(self):
        """Verify in_progress can transition back to open."""
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        resp = client.patch(f"/api/bounties/{b['id']}", json={"status": "open"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

    def test_completed_back_to_in_progress(self):
        """Verify completed can transition back to in_progress."""
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        resp = client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_invalid_status_value(self):
        """Reject invalid status string."""
        b = _create_bounty()
        resp = client.patch(f"/api/bounties/{b['id']}", json={"status": "invalid"})
        assert resp.status_code == 422


# ===========================================================================
# STATUS TRANSITION EXHAUSTIVE CHECK
# ===========================================================================


class TestStatusTransitions:
    """Exhaustively verify every invalid status transition is rejected."""

    def test_transition_map_integrity(self):
        """Verify transition map covers all statuses."""
        assert VALID_STATUS_TRANSITIONS[BountyStatus.OPEN] == {
            BountyStatus.IN_PROGRESS, BountyStatus.CANCELLED
        }
        assert VALID_STATUS_TRANSITIONS[BountyStatus.PAID] == set()
        for s in BountyStatus:
            assert s in VALID_STATUS_TRANSITIONS

    def test_all_invalid_transitions_rejected(self):
        """For every (current, target) pair NOT in the allowed map, confirm 400."""
        for current in BountyStatus:
            allowed = VALID_STATUS_TRANSITIONS.get(current, set())
            for target in BountyStatus:
                if target in allowed or target == current:
                    continue
                b = _create_bounty()
                bid = b["id"]
                path = _status_path(BountyStatus.OPEN, current)
                if path is None:
                    continue
                for step in path[1:]:
                    resp = client.patch(
                        f"/api/bounties/{bid}", json={"status": step.value}
                    )
                    assert resp.status_code == 200
                resp = client.patch(
                    f"/api/bounties/{bid}", json={"status": target.value}
                )
                assert resp.status_code == 400, (
                    f"{current.value} -> {target.value} should be rejected, "
                    f"got {resp.status_code}"
                )


# ===========================================================================
# DELETE
# ===========================================================================


class TestDeleteBounty:
    """Tests for the DELETE /api/bounties/{id} endpoint."""

    def test_delete_success(self):
        """Successfully delete a bounty."""
        b = _create_bounty()
        resp = client.delete(f"/api/bounties/{b['id']}")
        assert resp.status_code == 204
        assert client.get(f"/api/bounties/{b['id']}").status_code == 404

    def test_delete_not_found(self):
        """Return 404 for non-existent bounty."""
        assert client.delete("/api/bounties/nope").status_code == 404

    def test_delete_idempotent(self):
        """Second delete returns 404."""
        b = _create_bounty()
        assert client.delete(f"/api/bounties/{b['id']}").status_code == 204
        assert client.delete(f"/api/bounties/{b['id']}").status_code == 404

    def test_delete_removes_from_list(self):
        """Verify deleted bounty disappears from list."""
        b1 = _create_bounty(title="Stay bounty")
        b2 = _create_bounty(title="Remove bounty")
        client.delete(f"/api/bounties/{b2['id']}")
        body = client.get("/api/bounties").json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == b1["id"]

    def test_delete_does_not_affect_other_bounties(self):
        """Verify other bounties are unaffected by deletion."""
        b1 = _create_bounty(title="Keep this")
        b2 = _create_bounty(title="Delete this")
        client.delete(f"/api/bounties/{b2['id']}")
        resp = client.get(f"/api/bounties/{b1['id']}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Keep this"


# ===========================================================================
# SUBMIT SOLUTION
# ===========================================================================


class TestSubmitSolution:
    """Tests for the POST /api/bounties/{id}/submit endpoint."""

    def test_submit_success(self):
        """Successfully submit a PR solution."""
        b = _create_bounty()
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/42", "submitted_by": "alice"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["pr_url"] == "https://github.com/org/repo/pull/42"
        assert body["bounty_id"] == b["id"]
        assert body["submitted_by"] == MOCK_USER.wallet_address
        assert body["notes"] is None

    def test_submit_with_notes(self):
        """Submit with optional notes."""
        b = _create_bounty()
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/1",
                "submitted_by": "bob",
                "notes": "Fixed edge case in token transfer",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["notes"] == "Fixed edge case in token transfer"

    def test_submit_bounty_not_found(self):
        """Return 404 when submitting to non-existent bounty."""
        resp = client.post(
            "/api/bounties/nonexistent/submit",
            json={"pr_url": "https://github.com/org/repo/pull/1", "submitted_by": "alice"},
        )
        assert resp.status_code == 404

    def test_submit_invalid_pr_url(self):
        """Reject non-GitHub PR URL."""
        b = _create_bounty()
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "not-a-github-url", "submitted_by": "alice"},
        )
        assert resp.status_code == 422

    def test_submit_empty_pr_url(self):
        """Reject empty PR URL."""
        b = _create_bounty()
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "", "submitted_by": "alice"},
        )
        assert resp.status_code == 422

    def test_submit_empty_submitted_by(self):
        """Reject empty submitted_by."""
        b = _create_bounty()
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/1", "submitted_by": ""},
        )
        assert resp.status_code == 422

    def test_submit_duplicate_rejected(self):
        """Reject duplicate PR URL on the same bounty."""
        b = _create_bounty()
        url = "https://github.com/org/repo/pull/42"
        client.post(f"/api/bounties/{b['id']}/submit", json={"pr_url": url, "submitted_by": "alice"})
        resp = client.post(f"/api/bounties/{b['id']}/submit", json={"pr_url": url, "submitted_by": "bob"})
        assert resp.status_code == 400
        assert "already been submitted" in resp.json().get("message", resp.json().get("detail", ""))

    def test_submit_on_completed_bounty_rejected(self):
        """Reject submission on a completed bounty."""
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/99", "submitted_by": "alice"},
        )
        assert resp.status_code == 400
        assert "not accepting" in resp.json().get("message", resp.json().get("detail", ""))

    def test_submit_on_paid_bounty_rejected(self):
        """Reject submission on a paid bounty."""
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "paid"})
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/99", "submitted_by": "alice"},
        )
        assert resp.status_code == 400

    def test_submit_on_in_progress_accepted(self):
        """Accept submission on an in_progress bounty."""
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        resp = client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/5", "submitted_by": "alice"},
        )
        assert resp.status_code == 201

    def test_multiple_submissions(self):
        """Accept multiple different submissions on the same bounty."""
        b = _create_bounty()
        for i in range(3):
            resp = client.post(
                f"/api/bounties/{b['id']}/submit",
                json={"pr_url": f"https://github.com/org/repo/pull/{i}", "submitted_by": f"user{i}"},
            )
            assert resp.status_code == 201
        body = client.get(f"/api/bounties/{b['id']}").json()
        assert body["submission_count"] == 3
        assert len(body["submissions"]) == 3

    def test_same_pr_different_bounties_accepted(self):
        """Same PR URL can be submitted to different bounties."""
        b1 = _create_bounty(title="First bounty")
        b2 = _create_bounty(title="Second bounty")
        url = "https://github.com/org/repo/pull/42"
        r1 = client.post(f"/api/bounties/{b1['id']}/submit", json={"pr_url": url, "submitted_by": "alice"})
        r2 = client.post(f"/api/bounties/{b2['id']}/submit", json={"pr_url": url, "submitted_by": "alice"})
        assert r1.status_code == 201
        assert r2.status_code == 201


# ===========================================================================
# GET SUBMISSIONS
# ===========================================================================


class TestGetSubmissions:
    """Tests for the GET /api/bounties/{id}/submissions endpoint."""

    def test_empty_submissions(self):
        """Return empty list when no submissions exist."""
        b = _create_bounty()
        resp = client.get(f"/api/bounties/{b['id']}/submissions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_with_data(self):
        """Return submissions after they are created."""
        b = _create_bounty()
        client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/1", "submitted_by": "alice"},
        )
        client.post(
            f"/api/bounties/{b['id']}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/2", "submitted_by": "bob"},
        )
        resp = client.get(f"/api/bounties/{b['id']}/submissions")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_not_found(self):
        """Return 404 for non-existent bounty."""
        resp = client.get("/api/bounties/nope/submissions")
        assert resp.status_code == 404

    def test_submission_response_shape(self):
        """Verify submission response contains expected keys."""
        b = _create_bounty()
        client.post(
            f"/api/bounties/{b['id']}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/1",
                "submitted_by": "alice",
                "notes": "Test notes",
            },
        )
        sub = client.get(f"/api/bounties/{b['id']}/submissions").json()[0]
        core_keys = {
            "id", "bounty_id", "pr_url", "submitted_by",
            "notes", "status", "ai_score", "submitted_at",
        }
        assert core_keys.issubset(set(sub.keys()))


# ===========================================================================
# HEALTH CHECK (integration sanity)
# ===========================================================================


class TestHealth:
    """Basic health check test."""

    def test_health(self):
        """Verify health endpoint returns ok."""
        assert client.get("/health").json() == {"status": "ok"}
