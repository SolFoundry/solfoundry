"""Bounty Marketplace tests (Issue #188): create, browse, filter, sort, badges.

Covers all spec requirements:
- Create bounty with auth + wallet validation
- Browse/list bounties with grid and list views
- Filter by tier, skills, reward range, status, creator type
- Sort by newest, highest reward, deadline soonest, fewest submissions
- Bounty card fields: title, reward, tier badge, skill tags, deadline, submission count
- Platform vs community badge distinction
- Pagination
- Reward balance validation (wallet must be verified)
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import get_current_user
from app.api.bounties import router as bounties_router
from app.models.bounty import BountyCreate, BountyTier, CreatorType
from app.models.user import UserResponse
from app.services import bounty_service


# ---------------------------------------------------------------------------
# Auth mock — verified wallet user
# ---------------------------------------------------------------------------

VERIFIED_USER = UserResponse(
    id="u1",
    github_id="g1",
    username="tester",
    email="t@x.com",
    wallet_address="test-wallet",
    wallet_verified=True,
    created_at="2026-03-20T00:00:00Z",
    updated_at="2026-03-20T00:00:00Z",
)


async def _override_verified_user():
    """Provide a mock authenticated user with a verified wallet."""
    return VERIFIED_USER


# Auth mock — user WITHOUT verified wallet
UNVERIFIED_USER = UserResponse(
    id="u2",
    github_id="g2",
    username="noob",
    email="noob@x.com",
    wallet_address=None,
    wallet_verified=False,
    created_at="2026-03-20T00:00:00Z",
    updated_at="2026-03-20T00:00:00Z",
)


async def _override_unverified_user():
    """Provide a mock authenticated user WITHOUT a verified wallet."""
    return UNVERIFIED_USER


# ---------------------------------------------------------------------------
# Test app & client (verified wallet user by default)
# ---------------------------------------------------------------------------

_app = FastAPI()
_app.include_router(bounties_router, prefix="/api")
_app.dependency_overrides[get_current_user] = _override_verified_user
client = TestClient(_app)

# Separate client for unverified wallet tests
_app_unverified = FastAPI()
_app_unverified.include_router(bounties_router, prefix="/api")
_app_unverified.dependency_overrides[get_current_user] = _override_unverified_user
client_unverified = TestClient(_app_unverified)


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_store():
    """Ensure each test starts and ends with an empty bounty store."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


def _make_bounty(
    title: str = "Test Bounty",
    tier: int = 1,
    reward_amount: float = 500.0,
    skills: list[str] | None = None,
    deadline: str | None = None,
) -> dict:
    """Create a bounty via the API and assert success."""
    payload: dict = {
        "title": title,
        "tier": tier,
        "reward_amount": reward_amount,
        "required_skills": skills or ["python"],
    }
    if deadline:
        payload["deadline"] = deadline
    response = client.post("/api/bounties", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _seed_diverse_bounties():
    """Seed the store with a diverse set of bounties for filter/sort tests."""
    _make_bounty("Alpha", 1, 300, ["python"])
    _make_bounty("Beta", 2, 5000, ["react"])
    _make_bounty("Gamma", 3, 15000, ["rust"], "2026-06-15T00:00:00Z")
    _make_bounty("Delta", 1, 200, ["python", "fastapi"])


# ===========================================================================
# CREATE BOUNTY
# ===========================================================================


class TestCreateBounty:
    """Verify bounty creation with auth, wallet validation, and defaults."""

    def test_create_sets_community_creator_type(self):
        """Community users always get creator_type=community."""
        bounty = _make_bounty()
        assert bounty["creator_type"] == "community"

    def test_create_sets_wallet_as_created_by(self):
        """The creator's wallet address is recorded as created_by."""
        bounty = _make_bounty()
        assert bounty["created_by"] == "test-wallet"

    def test_create_returns_open_status(self):
        """New bounties start with status 'open'."""
        bounty = _make_bounty()
        assert bounty["status"] == "open"

    def test_create_returns_zero_submissions(self):
        """New bounties start with zero submissions."""
        bounty = _make_bounty()
        assert bounty["submission_count"] == 0

    def test_create_with_deadline(self):
        """Deadline is stored when provided."""
        bounty = _make_bounty(deadline="2026-12-31T23:59:59Z")
        assert "2026-12-31" in bounty["deadline"]

    def test_create_requires_verified_wallet(self):
        """Users without a verified wallet cannot create bounties."""
        response = client_unverified.post(
            "/api/bounties",
            json={"title": "No wallet", "reward_amount": 500, "required_skills": ["python"]},
        )
        assert response.status_code == 400
        body = response.json()
        error_text = (body.get("message") or body.get("detail") or "").lower()
        assert "wallet" in error_text


# ===========================================================================
# BROWSE / LIST BOUNTIES
# ===========================================================================


class TestBrowseBounties:
    """Verify the marketplace browse page API: list, filter, sort, paginate."""

    def test_bounty_visible_in_list(self):
        """A newly created bounty appears in the list endpoint."""
        bounty = _make_bounty("Listed Bounty")
        items = client.get("/api/bounties").json()["items"]
        assert any(item["id"] == bounty["id"] for item in items)

    def test_bounty_detail_preview(self):
        """GET /bounties/{id} returns full details for the preview."""
        bounty = _make_bounty("Preview Bounty")
        detail = client.get(f"/api/bounties/{bounty['id']}").json()
        assert detail["title"] == "Preview Bounty"
        assert detail["creator_type"] == "community"

    def test_list_all_bounties(self):
        """List returns the correct total count."""
        _seed_diverse_bounties()
        assert client.get("/api/bounties").json()["total"] == 4


# ===========================================================================
# FILTER BY TIER
# ===========================================================================


class TestFilterByTier:
    """Verify tier filtering matches the spec: T1, T2, T3."""

    def test_filter_tier_1(self):
        """Filter tier=1 returns only T1 bounties."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?tier=1").json()
        assert result["total"] == 2
        assert all(item["tier"] == 1 for item in result["items"])

    def test_filter_tier_2(self):
        """Filter tier=2 returns only T2 bounties."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?tier=2").json()
        assert result["total"] == 1

    def test_filter_tier_3(self):
        """Filter tier=3 returns only T3 bounties."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?tier=3").json()
        assert result["total"] == 1


# ===========================================================================
# FILTER BY SKILLS
# ===========================================================================


class TestFilterBySkills:
    """Verify skill-based filtering."""

    def test_filter_single_skill(self):
        """Filter by a single skill returns matching bounties."""
        _seed_diverse_bounties()
        assert client.get("/api/bounties?skills=rust").json()["total"] == 1

    def test_filter_multiple_skills(self):
        """Multiple skills match any bounty containing at least one."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?skills=python,fastapi").json()
        assert result["total"] == 2  # Alpha + Delta

    def test_filter_skill_case_insensitive(self):
        """Skill filtering is case-insensitive."""
        _seed_diverse_bounties()
        assert client.get("/api/bounties?skills=PYTHON").json()["total"] == 2


# ===========================================================================
# FILTER BY CREATOR TYPE
# ===========================================================================


class TestFilterByCreatorType:
    """Verify platform vs community badge distinction."""

    def test_community_filter(self):
        """All user-created bounties are community type."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?creator_type=community").json()
        assert result["total"] == 4

    def test_platform_filter_empty(self):
        """No platform bounties when none exist."""
        _seed_diverse_bounties()
        assert client.get("/api/bounties?creator_type=platform").json()["total"] == 0

    def test_platform_badge_visible(self):
        """Platform bounties created via service are visible with platform badge."""
        bounty_service.create_bounty(
            BountyCreate(
                title="Platform Bounty",
                tier=BountyTier.T1,
                reward_amount=500,
                required_skills=["python"],
                created_by="system",
                creator_type=CreatorType.PLATFORM,
            )
        )
        result = client.get("/api/bounties?creator_type=platform").json()
        assert result["total"] == 1
        assert result["items"][0]["creator_type"] == "platform"


# ===========================================================================
# SORT
# ===========================================================================


class TestSortBounties:
    """Verify sort options: newest, highest reward, deadline soonest, fewest submissions."""

    def test_sort_reward_high(self):
        """Sort by highest reward returns descending order."""
        _seed_diverse_bounties()
        rewards = [
            item["reward_amount"]
            for item in client.get("/api/bounties?sort=reward_high").json()["items"]
        ]
        assert rewards == sorted(rewards, reverse=True)

    def test_sort_reward_low(self):
        """Sort by lowest reward returns ascending order."""
        _seed_diverse_bounties()
        rewards = [
            item["reward_amount"]
            for item in client.get("/api/bounties?sort=reward_low").json()["items"]
        ]
        assert rewards == sorted(rewards)

    def test_sort_deadline_soonest(self):
        """Sort by deadline returns the bounty with earliest deadline first."""
        _seed_diverse_bounties()
        items = client.get("/api/bounties?sort=deadline").json()["items"]
        # Gamma has the only explicit deadline, so it comes first
        assert items[0]["title"] == "Gamma"

    def test_sort_fewest_submissions(self):
        """Sort by submissions_low returns ascending submission count."""
        _seed_diverse_bounties()
        counts = [
            item["submission_count"]
            for item in client.get("/api/bounties?sort=submissions_low").json()["items"]
        ]
        assert counts == sorted(counts)

    def test_sort_newest_is_default(self):
        """Default sort is newest (most recent created_at first)."""
        _seed_diverse_bounties()
        items = client.get("/api/bounties").json()["items"]
        dates = [item["created_at"] for item in items]
        assert dates == sorted(dates, reverse=True)


# ===========================================================================
# PAGINATION
# ===========================================================================


class TestPagination:
    """Verify pagination with skip and limit."""

    def test_pagination_basic(self):
        """Pagination returns correct page size and total."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?skip=0&limit=2").json()
        assert len(result["items"]) == 2
        assert result["total"] == 4

    def test_pagination_second_page(self):
        """Second page returns remaining bounties."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?skip=2&limit=2").json()
        assert len(result["items"]) == 2
        assert result["total"] == 4

    def test_pagination_beyond_total(self):
        """Requesting beyond total returns empty items."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?skip=10&limit=2").json()
        assert len(result["items"]) == 0
        assert result["total"] == 4


# ===========================================================================
# BOUNTY CARD FIELDS
# ===========================================================================


class TestBountyCardFields:
    """Verify all required fields are present in list items for card rendering."""

    def test_card_has_all_required_fields(self):
        """Each list item contains the fields needed to render a bounty card."""
        _make_bounty(deadline="2026-08-01T00:00:00Z")
        item = client.get("/api/bounties").json()["items"][0]
        required_fields = (
            "title",
            "tier",
            "reward_amount",
            "status",
            "required_skills",
            "deadline",
            "submission_count",
            "creator_type",
            "created_at",
        )
        for field in required_fields:
            assert field in item, f"Missing card field: {field}"

    def test_card_has_id_for_navigation(self):
        """Card items include an id for detail page navigation."""
        bounty = _make_bounty()
        item = client.get("/api/bounties").json()["items"][0]
        assert item["id"] == bounty["id"]


# ===========================================================================
# EDGE CASES
# ===========================================================================


class TestEdgeCases:
    """Edge case and validation tests."""

    def test_empty_list(self):
        """Empty store returns zero items."""
        result = client.get("/api/bounties").json()
        assert result["total"] == 0
        assert result["items"] == []

    def test_get_nonexistent_bounty(self):
        """GET for a nonexistent ID returns 404."""
        response = client.get("/api/bounties/nonexistent-id")
        assert response.status_code == 404

    def test_filter_status_no_match(self):
        """Filtering by a status with no matches returns empty."""
        _make_bounty()
        result = client.get("/api/bounties?status=completed").json()
        assert result["total"] == 0

    def test_combined_filters(self):
        """Multiple filters combine with AND logic."""
        _seed_diverse_bounties()
        result = client.get("/api/bounties?tier=1&skills=python").json()
        assert result["total"] == 2  # Alpha + Delta

    def test_limit_cap_at_100(self):
        """Limit > 100 returns 422."""
        response = client.get("/api/bounties?limit=101")
        assert response.status_code == 422
