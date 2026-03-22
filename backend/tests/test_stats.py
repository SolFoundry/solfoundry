"""Tests for bounty stats API endpoint.

This module tests:
- Normal stats response
- Empty state (no bounties, no contributors)
- Cache behavior (returns cached data within TTL)
"""

import pytest


from fastapi.testclient import TestClient

from app.main import app
from app.api import stats as stats_module


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def clear_stores():
    """Clear bounty and contributor stores before each test."""
    from app.services.bounty_service import _bounty_store
    from app.services.contributor_service import _store as _contributor_store

    _bounty_store.clear()
    _contributor_store.clear()
    # Also clear cache
    stats_module._cache.clear()
    yield
    _bounty_store.clear()
    _contributor_store.clear()
    stats_module._cache.clear()


class TestStatsEndpoint:
    """Test suite for /api/stats endpoint."""

    def test_empty_state(self, client, clear_stores):
        """Test response when no bounties or contributors exist."""
        response = client.get("/api/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["total_bounties_created"] == 0
        assert data["total_bounties_completed"] == 0
        assert data["total_bounties_open"] == 0
        assert data["total_contributors"] == 0
        assert data["total_fndry_paid"] == 0
        assert data["total_prs_reviewed"] == 0
        assert data["top_contributor"] is None

    def test_normal_response(self, client, clear_stores):
        """Test response with bounties and contributors."""
        from app.services.bounty_service import _bounty_store
        from app.services.contributor_service import _store as _contributor_store
        from app.models.bounty import BountyDB
        from app.models.contributor import ContributorDB
        import uuid

        # Create a contributor
        contributor_id = str(uuid.uuid4())
        contributor = ContributorDB(
            id=uuid.UUID(contributor_id),
            username="testuser",
            total_bounties_completed=5,
        )
        _contributor_store[contributor_id] = contributor

        # Create bounties
        bounty1 = BountyDB(
            id="bounty-1",
            title="Test Bounty 1",
            tier="tier-1",
            reward_amount=50000,
            status="completed",
            submissions=[],
        )
        bounty2 = BountyDB(
            id="bounty-2",
            title="Test Bounty 2",
            tier="tier-2",
            reward_amount=75000,
            status="open",
            submissions=[],
        )
        _bounty_store["bounty-1"] = bounty1
        _bounty_store["bounty-2"] = bounty2

        response = client.get("/api/stats")

        assert response.status_code == 200
        data = response.json()
        assert data["total_bounties_created"] == 2
        assert data["total_bounties_completed"] == 1
        assert data["total_bounties_open"] == 1
        assert data["total_contributors"] == 1
        assert data["total_fndry_paid"] == 50000
        assert data["top_contributor"]["username"] == "testuser"
        assert data["top_contributor"]["bounties_completed"] == 5
        assert data["bounties_by_tier"]["tier-1"]["completed"] == 1
        assert data["bounties_by_tier"]["tier-2"]["open"] == 1

    def test_cache_behavior(self, client, clear_stores):
        """Test that cache is used within TTL."""
        # First request computes fresh
        response1 = client.get("/api/stats")
        assert response1.status_code == 200

        # Check cache was populated
        assert "bounty_stats" in stats_module._cache

        # Second request should use cache
        response2 = client.get("/api/stats")
        assert response2.status_code == 200

        # Both should have same data
        assert response1.json() == response2.json()

    def test_no_auth_required(self, client, clear_stores):
        """Test that stats endpoint requires no authentication."""
        # Request without any auth headers
        response = client.get("/api/stats")

        # Should succeed without 401 Unauthorized
        assert response.status_code == 200

    def test_tier_breakdown(self, client, clear_stores):
        """Test tier breakdown statistics."""
        from app.services.bounty_service import _bounty_store
        from app.models.bounty import BountyDB

        # Create bounties in different tiers
        bounties = [
            BountyDB(
                id="t1-open",
                title="T1 Open",
                tier="tier-1",
                reward_amount=50000,
                status="open",
                submissions=[],
            ),
            BountyDB(
                id="t1-done",
                title="T1 Done",
                tier="tier-1",
                reward_amount=50000,
                status="completed",
                submissions=[],
            ),
            BountyDB(
                id="t2-open",
                title="T2 Open",
                tier="tier-2",
                reward_amount=75000,
                status="open",
                submissions=[],
            ),
            BountyDB(
                id="t3-done",
                title="T3 Done",
                tier="tier-3",
                reward_amount=100000,
                status="completed",
                submissions=[],
            ),
        ]
        for b in bounties:
            _bounty_store[b.id] = b

        response = client.get("/api/stats")
        data = response.json()

        assert data["bounties_by_tier"]["tier-1"]["open"] == 1
        assert data["bounties_by_tier"]["tier-1"]["completed"] == 1
        assert data["bounties_by_tier"]["tier-2"]["open"] == 1
        assert data["bounties_by_tier"]["tier-2"]["completed"] == 0
        assert data["bounties_by_tier"]["tier-3"]["open"] == 0
        assert data["bounties_by_tier"]["tier-3"]["completed"] == 1
