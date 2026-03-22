"""Tests for the stats analytics endpoint."""

import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.services.bounty_service import _bounty_store
from app.services.contributor_service import _store as _contributor_store
from app.models.bounty import BountyDB, BountyTier, BountyStatus
from app.models.contributor import ContributorTable

pytestmark = pytest.mark.asyncio


async def test_stats_returns_analytics(client):
    """GET /api/stats returns completion_rate and avg_time_to_completion_days."""
    # Clear any pre-existing data (from app startup/hydration)
    _bounty_store.clear()
    _contributor_store.clear()

    # Create some completed bounties with timestamps
    now = datetime.now(timezone.utc)
    completed1 = BountyDB(
        title="Bounty 1",
        reward_amount=100.0,
        tier=BountyTier.T1,
        status=BountyStatus.COMPLETED,
        created_by="user1",
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=5),
        submissions=[],
    )
    completed2 = BountyDB(
        title="Bounty 2",
        reward_amount=200.0,
        tier=BountyTier.T2,
        status=BountyStatus.COMPLETED,
        created_by="user2",
        created_at=now - timedelta(days=8),
        updated_at=now - timedelta(days=2),
        submissions=[],
    )
    open_bounty = BountyDB(
        title="Open Bounty",
        reward_amount=50.0,
        tier=BountyTier.T3,
        status=BountyStatus.OPEN,
        created_by="user3",
        created_at=now,
        submissions=[],
    )
    _bounty_store[completed1.id] = completed1
    _bounty_store[completed2.id] = completed2
    _bounty_store[open_bounty.id] = open_bounty

    # Contributor for top_contributor
    contributor = ContributorTable(
        id="11111111-1111-1111-1111-111111111111",
        username="top_dev",
        display_name="Top Dev",
        total_bounties_completed=2,
        total_earnings=Decimal("300.0"),
        reputation_score=95.0,
    )
    _contributor_store[contributor.id] = contributor

    resp = await client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_bounties_created"] == 3
    assert data["total_bounties_completed"] == 2
    assert data["total_bounties_open"] == 1
    assert data["completion_rate"] == pytest.approx((2/3)*100, 0.01)
    assert data["avg_time_to_completion_days"] == pytest.approx(((5+2)/2), 0.01)  # 5 and 2 days
    assert data["top_contributor"] is not None
    assert data["top_contributor"]["username"] == "top_dev"
