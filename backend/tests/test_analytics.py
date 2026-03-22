"""Tests for the Contributor Analytics API endpoints.

Verifies the four analytics endpoint groups:
1. Leaderboard rankings with quality scores and filtering
2. Contributor profile analytics with completion history
3. Bounty completion statistics by tier and category
4. Platform health metrics and growth trends

Uses the in-memory SQLite test database and seeded contributor data.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.database import engine
from app.main import app
from app.models.contributor import ContributorTable
from app.services import contributor_service
from app.services.analytics_service import (
    _derive_quality_score,
    _derive_tier,
    get_bounty_analytics,
    get_contributor_profile_analytics,
    get_leaderboard_analytics,
    get_platform_health,
    invalidate_analytics_cache,
)
from tests.conftest import run_async

client = TestClient(app)


def _seed_contributor(
    username: str,
    display_name: str,
    total_earnings: float = 0.0,
    bounties_completed: int = 0,
    reputation: float = 0.0,
    skills: list[str] | None = None,
    badges: list[str] | None = None,
    bio: str = "",
) -> ContributorTable:
    """Insert a contributor into PostgreSQL for testing.

    Args:
        username: GitHub username.
        display_name: Display name for the leaderboard.
        total_earnings: Total $FNDRY earned.
        bounties_completed: Number of bounties completed.
        reputation: Reputation score (0-100).
        skills: List of skill strings.
        badges: List of badge strings (e.g. ['tier-1']).
        bio: Short bio string.

    Returns:
        The inserted ContributorTable ORM instance.
    """
    row_data = {
        "id": uuid.uuid4(),
        "username": username,
        "display_name": display_name,
        "avatar_url": f"https://github.com/{username}.png",
        "total_earnings": Decimal(str(total_earnings)),
        "total_bounties_completed": bounties_completed,
        "reputation_score": float(reputation),
        "skills": skills or [],
        "badges": badges or [],
        "bio": bio,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    row = run_async(contributor_service.upsert_contributor(row_data))
    contributor_service._store[str(row.id)] = row
    return row


@pytest.fixture(autouse=True)
def _clean():
    """Reset database, store, and cache before every test."""

    async def _clear():
        """Delete all rows from the contributors table."""
        from sqlalchemy import delete

        async with engine.begin() as conn:
            await conn.execute(delete(ContributorTable))

    run_async(_clear())
    contributor_service._store.clear()
    invalidate_analytics_cache()
    yield
    run_async(_clear())
    contributor_service._store.clear()
    invalidate_analytics_cache()


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestDeriveQualityScore:
    """Tests for the quality score derivation helper."""

    def test_zero_bounties_returns_zero(self):
        """Zero bounties completed should yield a zero quality score."""
        assert _derive_quality_score(50.0, 0) == 0.0

    def test_positive_reputation_and_bounties(self):
        """Positive reputation and bounties produce a score between 0 and 10."""
        score = _derive_quality_score(80.0, 5)
        assert 0.0 < score <= 10.0

    def test_high_reputation_capped_at_ten(self):
        """Quality score should never exceed 10.0."""
        score = _derive_quality_score(150.0, 20)
        assert score <= 10.0

    def test_volume_bonus_applies(self):
        """More bounties should increase the score slightly."""
        score_few = _derive_quality_score(50.0, 1)
        score_many = _derive_quality_score(50.0, 10)
        assert score_many >= score_few


class TestDeriveTier:
    """Tests for the tier derivation from badges."""

    def test_no_badges_returns_tier_one(self):
        """No badges should default to tier 1."""
        assert _derive_tier([]) == 1

    def test_tier_one_badge(self):
        """A tier-1 badge should return tier 1."""
        assert _derive_tier(["tier-1"]) == 1

    def test_tier_two_badge(self):
        """A tier-2 badge should return tier 2."""
        assert _derive_tier(["tier-2"]) == 2

    def test_tier_three_badge(self):
        """A tier-3 badge should return tier 3."""
        assert _derive_tier(["tier-3"]) == 3

    def test_multiple_badges_returns_highest(self):
        """Multiple tier badges should return the highest tier."""
        assert _derive_tier(["tier-1", "tier-3", "tier-2"]) == 3

    def test_non_tier_badges_ignored(self):
        """Non-tier badges should not affect the tier calculation."""
        assert _derive_tier(["early-adopter", "security-expert"]) == 1


# ---------------------------------------------------------------------------
# Leaderboard Analytics endpoint tests
# ---------------------------------------------------------------------------


class TestLeaderboardAnalyticsEndpoint:
    """Tests for GET /api/analytics/leaderboard."""

    def test_empty_leaderboard_returns_empty(self):
        """Empty database should return zero entries."""
        response = client.get("/api/analytics/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["entries"] == []

    def test_single_contributor_in_leaderboard(self):
        """A single contributor should appear at rank 1."""
        _seed_contributor("alice", "Alice", total_earnings=1000.0, bounties_completed=5)
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["entries"]) == 1
        assert data["entries"][0]["rank"] == 1
        assert data["entries"][0]["username"] == "alice"

    def test_leaderboard_sorting_by_earnings(self):
        """Contributors should be sorted by total_earned descending by default."""
        _seed_contributor("low", "Low", total_earnings=100.0)
        _seed_contributor("high", "High", total_earnings=5000.0)
        _seed_contributor("mid", "Mid", total_earnings=1000.0)
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard")
        data = response.json()
        usernames = [entry["username"] for entry in data["entries"]]
        assert usernames == ["high", "mid", "low"]

    def test_leaderboard_pagination(self):
        """Pagination parameters should limit and offset results."""
        for i in range(5):
            _seed_contributor(
                f"user{i}", f"User {i}", total_earnings=float(1000 * (5 - i))
            )
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard?page=1&per_page=2")
        data = response.json()
        assert data["total"] == 5
        assert len(data["entries"]) == 2
        assert data["entries"][0]["rank"] == 1

    def test_leaderboard_search_filter(self):
        """Search parameter should filter by username substring."""
        _seed_contributor("alice_dev", "Alice", total_earnings=500.0)
        _seed_contributor("bob_builder", "Bob", total_earnings=300.0)
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard?search=alice")
        data = response.json()
        assert data["total"] == 1
        assert data["entries"][0]["username"] == "alice_dev"

    def test_leaderboard_tier_filter(self):
        """Tier parameter should filter by contributor tier badge."""
        _seed_contributor("t1_dev", "T1", total_earnings=200.0, badges=["tier-1"])
        _seed_contributor("t2_dev", "T2", total_earnings=800.0, badges=["tier-2"])
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard?tier=2")
        data = response.json()
        assert data["total"] == 1
        assert data["entries"][0]["username"] == "t2_dev"

    def test_leaderboard_category_filter(self):
        """Category parameter should filter by contributor skills."""
        _seed_contributor("fe_dev", "FE", total_earnings=300.0, skills=["frontend"])
        _seed_contributor("be_dev", "BE", total_earnings=600.0, skills=["backend"])
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard?category=frontend")
        data = response.json()
        assert data["total"] == 1
        assert data["entries"][0]["username"] == "fe_dev"

    def test_leaderboard_quality_score_populated(self):
        """Quality score should be computed and included in response."""
        _seed_contributor(
            "quality_dev", "Quality", total_earnings=500.0,
            bounties_completed=10, reputation=80.0,
        )
        invalidate_analytics_cache()
        response = client.get("/api/analytics/leaderboard")
        data = response.json()
        assert data["entries"][0]["quality_score"] > 0.0

    def test_leaderboard_invalid_sort_returns_400(self):
        """Invalid sort_by parameter should return 400."""
        response = client.get("/api/analytics/leaderboard?sort_by=invalid")
        assert response.status_code == 400

    def test_leaderboard_invalid_time_range_returns_400(self):
        """Invalid time_range parameter should return 400."""
        response = client.get("/api/analytics/leaderboard?time_range=invalid")
        assert response.status_code == 400

    def test_leaderboard_ascending_sort(self):
        """Ascending sort should reverse the order."""
        _seed_contributor("low", "Low", total_earnings=100.0)
        _seed_contributor("high", "High", total_earnings=5000.0)
        invalidate_analytics_cache()
        response = client.get(
            "/api/analytics/leaderboard?sort_order=asc"
        )
        data = response.json()
        usernames = [entry["username"] for entry in data["entries"]]
        assert usernames == ["high", "low"] or usernames == ["low", "high"]
        # With asc sort, lower earnings should come first
        assert data["entries"][0]["total_earned"] <= data["entries"][-1]["total_earned"]


# ---------------------------------------------------------------------------
# Contributor Profile Analytics endpoint tests
# ---------------------------------------------------------------------------


class TestContributorProfileEndpoint:
    """Tests for GET /api/analytics/contributors/{username}."""

    def test_contributor_not_found_returns_404(self):
        """Non-existent contributor should return 404."""
        response = client.get("/api/analytics/contributors/nonexistent")
        assert response.status_code == 404

    def test_contributor_profile_found(self):
        """Existing contributor should return full profile analytics."""
        _seed_contributor(
            "alice", "Alice Dev", total_earnings=2000.0,
            bounties_completed=8, reputation=75.0,
            skills=["python", "fastapi", "react"],
            badges=["tier-2", "early-adopter"],
            bio="Full-stack developer",
        )
        invalidate_analytics_cache()
        response = client.get("/api/analytics/contributors/alice")
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "alice"
        assert data["display_name"] == "Alice Dev"
        assert data["total_earned"] == 2000.0
        assert data["bounties_completed"] == 8
        assert data["tier"] == 2
        assert data["quality_score"] > 0.0
        assert "python" in data["top_skills"]
        assert "tier-2" in data["badges"]
        assert data["bio"] == "Full-stack developer"

    def test_contributor_profile_includes_tier_progression(self):
        """Profile should include tier progression records."""
        _seed_contributor(
            "tier3_dev", "Tier 3", total_earnings=5000.0,
            bounties_completed=15, reputation=90.0,
            badges=["tier-3"],
        )
        invalidate_analytics_cache()
        response = client.get("/api/analytics/contributors/tier3_dev")
        data = response.json()
        assert len(data["tier_progression"]) == 3
        assert data["tier_progression"][0]["tier"] == 1
        assert data["tier_progression"][2]["tier"] == 3

    def test_contributor_profile_completions_by_tier(self):
        """Profile should include completions_by_tier dictionary."""
        _seed_contributor(
            "analyzer", "Analyzer", total_earnings=1000.0,
            bounties_completed=5, reputation=60.0,
        )
        invalidate_analytics_cache()
        response = client.get("/api/analytics/contributors/analyzer")
        data = response.json()
        assert "completions_by_tier" in data
        assert isinstance(data["completions_by_tier"], dict)


# ---------------------------------------------------------------------------
# Bounty Analytics endpoint tests
# ---------------------------------------------------------------------------


class TestBountyAnalyticsEndpoint:
    """Tests for GET /api/analytics/bounties."""

    def test_bounty_analytics_returns_200(self):
        """Bounty analytics endpoint should return 200."""
        response = client.get("/api/analytics/bounties")
        assert response.status_code == 200
        data = response.json()
        assert "by_tier" in data
        assert "by_category" in data
        assert "overall_completion_rate" in data

    def test_bounty_analytics_has_three_tiers(self):
        """Response should always include stats for all three tiers."""
        response = client.get("/api/analytics/bounties")
        data = response.json()
        assert len(data["by_tier"]) == 3
        tiers = [tier["tier"] for tier in data["by_tier"]]
        assert tiers == [1, 2, 3]

    def test_bounty_analytics_with_time_range(self):
        """Time range parameter should be accepted."""
        response = client.get("/api/analytics/bounties?time_range=30d")
        assert response.status_code == 200

    def test_bounty_analytics_invalid_time_range(self):
        """Invalid time_range should return 400."""
        response = client.get("/api/analytics/bounties?time_range=invalid")
        assert response.status_code == 400

    def test_bounty_analytics_completion_rate_range(self):
        """Completion rates should be between 0 and 100."""
        response = client.get("/api/analytics/bounties")
        data = response.json()
        assert 0.0 <= data["overall_completion_rate"] <= 100.0
        for tier_stat in data["by_tier"]:
            assert 0.0 <= tier_stat["completion_rate"] <= 100.0


# ---------------------------------------------------------------------------
# Platform Health endpoint tests
# ---------------------------------------------------------------------------


class TestPlatformHealthEndpoint:
    """Tests for GET /api/analytics/platform."""

    def test_platform_health_returns_200(self):
        """Platform health endpoint should return 200."""
        response = client.get("/api/analytics/platform")
        assert response.status_code == 200
        data = response.json()
        assert "total_contributors" in data
        assert "total_bounties" in data
        assert "growth_trend" in data

    def test_platform_health_counts_contributors(self):
        """Platform health should count contributors from PostgreSQL."""
        _seed_contributor("dev1", "Dev 1", total_earnings=100.0)
        _seed_contributor("dev2", "Dev 2", total_earnings=200.0)
        invalidate_analytics_cache()
        response = client.get("/api/analytics/platform")
        data = response.json()
        assert data["total_contributors"] >= 2

    def test_platform_health_has_growth_trend(self):
        """Growth trend should contain daily data points."""
        response = client.get("/api/analytics/platform")
        data = response.json()
        assert isinstance(data["growth_trend"], list)
        assert len(data["growth_trend"]) > 0
        for point in data["growth_trend"]:
            assert "date" in point
            assert "bounties_created" in point
            assert "bounties_completed" in point

    def test_platform_health_with_time_range(self):
        """Time range parameter should be accepted."""
        response = client.get("/api/analytics/platform?time_range=7d")
        assert response.status_code == 200
        data = response.json()
        assert len(data["growth_trend"]) == 7

    def test_platform_health_bounties_by_status(self):
        """Bounties by status should be a dictionary."""
        response = client.get("/api/analytics/platform")
        data = response.json()
        assert isinstance(data["bounties_by_status"], dict)

    def test_platform_health_nonnegative_values(self):
        """All numeric metrics should be non-negative."""
        response = client.get("/api/analytics/platform")
        data = response.json()
        assert data["total_contributors"] >= 0
        assert data["active_contributors"] >= 0
        assert data["total_bounties"] >= 0
        assert data["open_bounties"] >= 0
        assert data["completed_bounties"] >= 0
        assert data["total_fndry_paid"] >= 0.0


# ---------------------------------------------------------------------------
# Service-level tests (direct function calls)
# ---------------------------------------------------------------------------


class TestAnalyticsServiceDirect:
    """Direct tests for analytics service functions."""

    def test_leaderboard_analytics_service(self):
        """Service function should return proper LeaderboardAnalyticsResponse."""
        _seed_contributor("svc_test", "Service Test", total_earnings=500.0)
        invalidate_analytics_cache()
        result = run_async(get_leaderboard_analytics())
        assert result.total >= 1
        assert any(entry.username == "svc_test" for entry in result.entries)

    def test_contributor_profile_service_not_found(self):
        """Service should return None for non-existent contributor."""
        result = run_async(get_contributor_profile_analytics("nonexistent"))
        assert result is None

    def test_contributor_profile_service_found(self):
        """Service should return profile for existing contributor."""
        _seed_contributor("profile_test", "Profile Test", total_earnings=300.0)
        invalidate_analytics_cache()
        result = run_async(get_contributor_profile_analytics("profile_test"))
        assert result is not None
        assert result.username == "profile_test"

    def test_bounty_analytics_service(self):
        """Service function should return BountyAnalyticsResponse."""
        invalidate_analytics_cache()
        result = run_async(get_bounty_analytics())
        assert len(result.by_tier) == 3

    def test_platform_health_service(self):
        """Service function should return PlatformHealthResponse."""
        invalidate_analytics_cache()
        result = run_async(get_platform_health())
        assert result.total_contributors >= 0
        assert len(result.growth_trend) > 0

    def test_cache_returns_same_result(self):
        """Successive calls should return cached results."""
        _seed_contributor("cache_test", "Cache Test", total_earnings=100.0)
        invalidate_analytics_cache()
        result1 = run_async(get_leaderboard_analytics())
        result2 = run_async(get_leaderboard_analytics())
        assert result1.total == result2.total

    def test_cache_invalidation_refreshes_data(self):
        """Invalidating cache should cause fresh data fetch."""
        _seed_contributor("first", "First", total_earnings=100.0)
        invalidate_analytics_cache()
        result1 = run_async(get_leaderboard_analytics())
        assert result1.total >= 1

        _seed_contributor("second", "Second", total_earnings=200.0)
        invalidate_analytics_cache()
        result2 = run_async(get_leaderboard_analytics())
        assert result2.total >= 2
