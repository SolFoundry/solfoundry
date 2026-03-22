"""Comprehensive tests for the Bounty Marketplace API (Phase 2).

Covers: bounty creation with creator_type, marketplace browse with
filters/sort, platform vs community badges, reward range filtering,
and the full create-browse-view flow.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.api.bounties import router as bounties_router
from app.services import bounty_service

# ---------------------------------------------------------------------------
# Auth mocks — platform admin and community user
# ---------------------------------------------------------------------------

PLATFORM_USER = UserResponse(
    id="platform-admin-id",
    github_id="platform-github",
    username="solfoundry-admin",
    email="admin@solfoundry.org",
    avatar_url="http://example.com/admin.png",
    wallet_address="system",
    wallet_verified=True,
    created_at="2026-01-01T00:00:00Z",
    updated_at="2026-01-01T00:00:00Z",
)

COMMUNITY_USER = UserResponse(
    id="community-user-id",
    github_id="community-github",
    username="contributor42",
    email="dev@example.com",
    avatar_url="http://example.com/avatar.png",
    wallet_address="7Pq6kxGhN9p5vTqR2zYXJdmWn8aF4bC3eD1fH0gJ2kL",
    wallet_verified=True,
    created_at="2026-02-01T00:00:00Z",
    updated_at="2026-02-01T00:00:00Z",
)

_current_user = COMMUNITY_USER


async def override_get_current_user():
    return _current_user


# ---------------------------------------------------------------------------
# Test app
# ---------------------------------------------------------------------------

_app = FastAPI()
_app.include_router(bounties_router, prefix="/api")
_app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(_app)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def _init_db(event_loop):
    from app.database import init_db
    event_loop.run_until_complete(init_db())


@pytest.fixture(autouse=True)
def clear_store(event_loop):
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


@pytest.fixture(autouse=True)
def _reset_user():
    global _current_user
    _current_user = COMMUNITY_USER
    yield
    _current_user = COMMUNITY_USER


def _as_platform():
    global _current_user
    _current_user = PLATFORM_USER


def _as_community():
    global _current_user
    _current_user = COMMUNITY_USER


VALID_BOUNTY = {
    "title": "Build marketplace browse page",
    "description": "Create a grid/list view of all bounties with filters and sorting.",
    "tier": 2,
    "category": "frontend",
    "reward_amount": 600000,
    "required_skills": ["react", "typescript"],
    "deadline": "2026-12-31T23:59:59Z",
}


def _create(user="community", **overrides) -> dict:
    if user == "platform":
        _as_platform()
    else:
        _as_community()
    payload = {**VALID_BOUNTY, **overrides}
    resp = client.post("/api/bounties", json=payload)
    assert resp.status_code == 201, f"Create failed: {resp.text}"
    return resp.json()


# ===========================================================================
# CREATE BOUNTY — marketplace specific
# ===========================================================================


class TestCreateBountyMarketplace:
    """Tests for bounty creation in the marketplace context."""

    def test_community_bounty_creator_type(self):
        """Community user creates a bounty tagged as 'community'."""
        b = _create(user="community")
        assert b["creator_type"] == "community"
        assert b["created_by"] == COMMUNITY_USER.wallet_address

    def test_platform_bounty_creator_type(self):
        """Platform admin creates a bounty tagged as 'platform'."""
        b = _create(user="platform")
        assert b["creator_type"] == "platform"

    def test_category_persisted(self):
        """Category is stored and returned correctly."""
        b = _create(category="backend")
        assert b["category"] == "backend"

    def test_category_nullable(self):
        """Bounty can be created without a category."""
        payload = {**VALID_BOUNTY}
        del payload["category"]
        _as_community()
        resp = client.post("/api/bounties", json=payload)
        assert resp.status_code == 201
        assert resp.json()["category"] is None

    def test_reward_amount_validated(self):
        """Reject reward exceeding maximum."""
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": 1_000_001})
        assert resp.status_code == 422

    def test_create_all_tiers(self):
        """Create bounties across all three tiers."""
        for tier in [1, 2, 3]:
            b = _create(tier=tier)
            assert b["tier"] == tier

    def test_create_with_all_fields(self):
        """Full payload with all optional fields."""
        b = _create(
            github_issue_url="https://github.com/solfoundry/solfoundry/issues/99",
        )
        assert b["github_issue_url"] == "https://github.com/solfoundry/solfoundry/issues/99"
        assert b["deadline"] is not None
        assert len(b["required_skills"]) == 2

    def test_bounty_starts_as_open(self):
        """Newly created bounty has open status."""
        b = _create()
        assert b["status"] == "open"

    def test_submission_count_starts_zero(self):
        """New bounty has zero submissions."""
        b = _create()
        assert b["submission_count"] == 0
        assert b["submissions"] == []


# ===========================================================================
# BROWSE / LIST — filters and sorting
# ===========================================================================


class TestMarketplaceBrowse:
    """Tests for the marketplace browse page (GET /api/bounties)."""

    def test_list_empty_marketplace(self):
        """Empty marketplace returns zero bounties."""
        body = client.get("/api/bounties").json()
        assert body["total"] == 0
        assert body["items"] == []

    def test_list_all_bounties(self):
        """List returns both platform and community bounties."""
        _create(user="platform", title="Platform bounty")
        _create(user="community", title="Community bounty")
        body = client.get("/api/bounties").json()
        assert body["total"] == 2

    def test_filter_by_creator_type_platform(self):
        """Filter shows only platform bounties."""
        _create(user="platform", title="Official task")
        _create(user="community", title="Community task")
        body = client.get("/api/bounties?creator_type=platform").json()
        assert body["total"] == 1
        assert body["items"][0]["creator_type"] == "platform"

    def test_filter_by_creator_type_community(self):
        """Filter shows only community bounties."""
        _create(user="platform", title="Official")
        _create(user="community", title="User created")
        body = client.get("/api/bounties?creator_type=community").json()
        assert body["total"] == 1
        assert body["items"][0]["creator_type"] == "community"

    def test_filter_by_tier(self):
        """Tier filter works across all tiers."""
        _create(tier=1, title="T1 bounty")
        _create(tier=2, title="T2 bounty")
        _create(tier=3, title="T3 bounty")
        assert client.get("/api/bounties?tier=1").json()["total"] == 1
        assert client.get("/api/bounties?tier=2").json()["total"] == 1
        assert client.get("/api/bounties?tier=3").json()["total"] == 1

    def test_filter_by_status(self):
        """Status filter returns correct bounties."""
        b = _create(title="Active")
        _create(title="Also open")
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        assert client.get("/api/bounties?status=open").json()["total"] == 1
        assert client.get("/api/bounties?status=in_progress").json()["total"] == 1

    def test_filter_by_skills(self):
        """Skill filter matches bounties with matching skills."""
        _create(required_skills=["rust", "anchor"], title="Rust job")
        _create(required_skills=["react", "typescript"], title="React job")
        assert client.get("/api/bounties?skills=rust").json()["total"] == 1
        assert client.get("/api/bounties?skills=react").json()["total"] == 1
        assert client.get("/api/bounties?skills=python").json()["total"] == 0

    def test_filter_by_reward_range(self):
        """Reward range filters bounties correctly."""
        _create(reward_amount=100, title="Small")
        _create(reward_amount=5000, title="Medium")
        _create(reward_amount=500000, title="Large")
        assert client.get("/api/bounties?reward_min=1000").json()["total"] == 2
        assert client.get("/api/bounties?reward_max=1000").json()["total"] == 1
        assert client.get("/api/bounties?reward_min=1000&reward_max=10000").json()["total"] == 1

    def test_combined_filters(self):
        """Multiple filters can be combined."""
        _create(tier=1, required_skills=["rust"], reward_amount=100, title="Match")
        _create(tier=2, required_skills=["rust"], reward_amount=5000, title="Wrong tier")
        _create(tier=1, required_skills=["python"], reward_amount=100, title="Wrong skill")
        body = client.get("/api/bounties?tier=1&skills=rust").json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Match"

    def test_sort_by_newest(self):
        """Default sort returns newest first."""
        _create(title="First created")
        _create(title="Second created")
        items = client.get("/api/bounties?sort=newest").json()["items"]
        assert items[0]["title"] == "Second created"

    def test_sort_by_highest_reward(self):
        """Sort by reward_high returns highest first."""
        _create(reward_amount=100, title="Low")
        _create(reward_amount=999999, title="High")
        _create(reward_amount=5000, title="Mid")
        items = client.get("/api/bounties?sort=reward_high").json()["items"]
        assert items[0]["title"] == "High"
        assert items[-1]["title"] == "Low"

    def test_sort_by_lowest_reward(self):
        """Sort by reward_low returns lowest first."""
        _create(reward_amount=5000, title="Mid")
        _create(reward_amount=100, title="Low")
        _create(reward_amount=999999, title="High")
        items = client.get("/api/bounties?sort=reward_low").json()["items"]
        assert items[0]["title"] == "Low"
        assert items[-1]["title"] == "High"

    def test_sort_by_deadline_soonest(self):
        """Sort by deadline returns soonest first."""
        _create(deadline="2026-06-01T00:00:00Z", title="June")
        _create(deadline="2026-03-01T00:00:00Z", title="March")
        _create(deadline="2026-09-01T00:00:00Z", title="September")
        items = client.get("/api/bounties?sort=deadline").json()["items"]
        assert items[0]["title"] == "March"

    def test_sort_by_fewest_submissions(self):
        """Sort by submissions orders by count desc."""
        b1 = _create(title="Many subs")
        _create(title="No subs")
        for i in range(3):
            client.post(
                f"/api/bounties/{b1['id']}/submissions",
                json={"pr_url": f"https://github.com/org/repo/pull/{i}", "submitted_by": f"u{i}"},
            )
        items = client.get("/api/bounties?sort=submissions").json()["items"]
        assert items[0]["title"] == "Many subs"

    def test_pagination(self):
        """Pagination works with skip and limit."""
        for i in range(10):
            _create(title=f"Bounty {i}")
        body = client.get("/api/bounties?skip=0&limit=3").json()
        assert body["total"] == 10
        assert len(body["items"]) == 3
        body2 = client.get("/api/bounties?skip=3&limit=3").json()
        assert len(body2["items"]) == 3
        assert body2["items"][0]["id"] != body["items"][0]["id"]


# ===========================================================================
# BOUNTY DETAIL
# ===========================================================================


class TestBountyDetail:
    """Tests for GET /api/bounties/{id} — bounty detail page."""

    def test_detail_includes_creator_type(self):
        """Detail response includes creator_type field."""
        b = _create(user="community")
        detail = client.get(f"/api/bounties/{b['id']}").json()
        assert detail["creator_type"] == "community"

    def test_detail_includes_all_fields(self):
        """Detail response contains the full response shape."""
        b = _create()
        detail = client.get(f"/api/bounties/{b['id']}").json()
        assert "title" in detail
        assert "description" in detail
        assert "tier" in detail
        assert "reward_amount" in detail
        assert "status" in detail
        assert "creator_type" in detail
        assert "required_skills" in detail
        assert "deadline" in detail
        assert "created_by" in detail
        assert "submissions" in detail
        assert "submission_count" in detail
        assert "category" in detail
        assert "created_at" in detail
        assert "updated_at" in detail

    def test_detail_not_found(self):
        """Non-existent bounty returns 404."""
        resp = client.get("/api/bounties/non-existent-uuid")
        assert resp.status_code == 404


# ===========================================================================
# CREATOR FIELD — bounty linked to wallet
# ===========================================================================


class TestBountyCreatorField:
    """Tests verifying the bounty creator is linked to the wallet/user."""

    def test_created_by_is_wallet_address(self):
        """created_by is set to the authenticated user's wallet address."""
        b = _create(user="community")
        assert b["created_by"] == COMMUNITY_USER.wallet_address

    def test_filter_by_created_by(self):
        """Can filter bounties by specific creator wallet."""
        _create(user="community", title="Mine")
        _create(user="platform", title="Official")
        body = client.get(
            f"/api/bounties?created_by={COMMUNITY_USER.wallet_address}"
        ).json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Mine"


# ===========================================================================
# PLATFORM vs COMMUNITY BADGE
# ===========================================================================


class TestPlatformVsCommunityBadge:
    """Tests for distinguishing platform vs community bounties."""

    def test_platform_user_gets_platform_badge(self):
        """Bounty created by system/platform user is tagged as platform."""
        b = _create(user="platform")
        assert b["creator_type"] == "platform"

    def test_community_user_gets_community_badge(self):
        """Bounty created by a regular wallet is tagged as community."""
        b = _create(user="community")
        assert b["creator_type"] == "community"

    def test_badge_appears_in_list(self):
        """creator_type is present in list endpoint response items."""
        _create(user="platform", title="Platform task")
        _create(user="community", title="Community task")
        items = client.get("/api/bounties").json()["items"]
        types = {i["creator_type"] for i in items}
        assert types == {"platform", "community"}

    def test_badge_appears_in_detail(self):
        """creator_type is present in detail endpoint response."""
        b = _create(user="community")
        detail = client.get(f"/api/bounties/{b['id']}").json()
        assert "creator_type" in detail


# ===========================================================================
# END-TO-END FLOW: create → browse → view
# ===========================================================================


class TestMarketplaceFlow:
    """End-to-end marketplace workflow tests."""

    def test_create_then_browse(self):
        """Created bounty appears in the marketplace listing."""
        b = _create(title="My new bounty")
        items = client.get("/api/bounties").json()["items"]
        ids = [i["id"] for i in items]
        assert b["id"] in ids

    def test_create_then_view_detail(self):
        """Created bounty is retrievable by ID with full details."""
        b = _create(title="Detail test", description="Full description here")
        detail = client.get(f"/api/bounties/{b['id']}").json()
        assert detail["title"] == "Detail test"
        assert detail["description"] == "Full description here"
        assert detail["creator_type"] == "community"

    def test_mixed_marketplace(self):
        """Marketplace shows both platform and community bounties together."""
        _create(user="platform", title="Official bounty", tier=1, reward_amount=100000)
        _create(user="community", title="Community bounty", tier=2, reward_amount=600000)
        _create(user="community", title="Another community", tier=3, reward_amount=1000)

        body = client.get("/api/bounties").json()
        assert body["total"] == 3

        platform = client.get("/api/bounties?creator_type=platform").json()
        assert platform["total"] == 1

        community = client.get("/api/bounties?creator_type=community").json()
        assert community["total"] == 2

    def test_submit_solution_flow(self):
        """Create bounty → submit solution → verify submission count."""
        b = _create(title="Solve me")
        resp = client.post(
            f"/api/bounties/{b['id']}/submissions",
            json={
                "pr_url": "https://github.com/solfoundry/solfoundry/pull/42",
                "submitted_by": "contributor",
            },
        )
        assert resp.status_code == 201

        detail = client.get(f"/api/bounties/{b['id']}").json()
        assert detail["submission_count"] == 1
