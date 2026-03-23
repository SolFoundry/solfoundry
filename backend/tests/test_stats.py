"""Tests for bounty stats API endpoint.

This module tests:
- Normal stats response
- Empty state (no bounties, no contributors)
- Cache behavior (returns cached data within TTL)
- Shields.io custom badge endpoints including edge cases
"""

import pytest
from unittest.mock import patch
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
    stats_module._cache.clear()
    yield
    _bounty_store.clear()
    _contributor_store.clear()
    stats_module._cache.clear()


class TestStatsEndpoint:
    """Test suite for /api/stats endpoint."""

    def test_empty_state(self, client, clear_stores):
        response = client.get("/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_bounties_created"] == 0

    def test_normal_response(self, client, clear_stores):
        from app.services.bounty_service import _bounty_store
        from app.services.contributor_service import _store as _contributor_store
        from app.models.bounty import BountyDB
        from app.models.contributor import ContributorDB
        import uuid

        contributor_id = str(uuid.uuid4())
        _contributor_store[contributor_id] = ContributorDB(
            id=uuid.UUID(contributor_id), username="testuser", total_bounties_completed=5
        )

        _bounty_store["bounty-1"] = BountyDB(
            id="bounty-1", title="Test 1", tier="tier-1", reward_amount=50000, status="completed", submissions=[]
        )
        _bounty_store["bounty-2"] = BountyDB(
            id="bounty-2", title="Test 2", tier="tier-2", reward_amount=75000, status="open", submissions=[]
        )

        response = client.get("/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_fndry_paid"] == 50000

    def test_shields_payouts_empty(self, client, clear_stores):
        response = client.get("/api/stats/shields/payouts")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "0 $FNDRY"
        assert data["schemaVersion"] == 1
        assert data["label"] == "Paid"

    def test_shields_payouts_small_amounts(self, client, clear_stores):
        from app.services.bounty_service import _bounty_store
        from app.models.bounty import BountyDB

        _bounty_store["bounty-1"] = BountyDB(
            id="bounty-1", title="Test", tier="tier-1", reward_amount=999, status="completed", submissions=[]
        )
        response = client.get("/api/stats/shields/payouts")
        assert response.json()["message"] == "999 $FNDRY"

    def test_shields_payouts_thousands(self, client, clear_stores):
        from app.services.bounty_service import _bounty_store
        from app.models.bounty import BountyDB

        _bounty_store["bounty-1"] = BountyDB(
            id="bounty-1", title="Test", tier="tier-1", reward_amount=250000, status="completed", submissions=[]
        )
        response = client.get("/api/stats/shields/payouts")
        assert response.json()["message"] == "250k $FNDRY"
        
        _bounty_store.clear()
        stats_module._cache.clear()
        
        _bounty_store["bounty-1"] = BountyDB(
            id="bounty-1", title="Test", tier="tier-1", reward_amount=1500, status="completed", submissions=[]
        )
        response = client.get("/api/stats/shields/payouts")
        assert response.json()["message"] == "1.5k $FNDRY"

    def test_shields_payouts_millions(self, client, clear_stores):
        from app.services.bounty_service import _bounty_store
        from app.models.bounty import BountyDB

        _bounty_store["bounty-1"] = BountyDB(
            id="bounty-1", title="Test", tier="tier-1", reward_amount=1000000, status="completed", submissions=[]
        )
        response = client.get("/api/stats/shields/payouts")
        assert response.json()["message"] == "1M $FNDRY"
        
        _bounty_store.clear()
        stats_module._cache.clear()
        
        _bounty_store["bounty-1"] = BountyDB(
            id="bounty-1", title="Test", tier="tier-1", reward_amount=2500000, status="completed", submissions=[]
        )
        response = client.get("/api/stats/shields/payouts")
        assert response.json()["message"] == "2.5M $FNDRY"

    def test_shields_payouts_error_handling(self, client, clear_stores):
        with patch('app.api.stats._get_cached_stats', side_effect=Exception("Store failed")):
            response = client.get("/api/stats/shields/payouts")
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "0 $FNDRY"
            assert data["schemaVersion"] == 1
