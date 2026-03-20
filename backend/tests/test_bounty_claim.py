"""Tests for bounty claiming functionality (Issue #16)."""

import pytest
from datetime import datetime, timezone, timedelta

from app.models.bounty import (
    BountyDB,
    BountyTier,
    BountyStatus,
    BountyClaimRequest,
    T2_MIN_REPUTATION,
    T3_MIN_REPUTATION,
)
from app.services import bounty_service


@pytest.fixture(autouse=True)
def clear_store():
    """Clear the bounty store before and after each test."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


@pytest.fixture
def sample_bounty_t2():
    """Create a sample T2 bounty for testing."""
    bounty = BountyDB(
        title="Test T2 Bounty",
        description="Test description",
        tier=BountyTier.T2,
        reward_amount=100.0,
        status=BountyStatus.OPEN,
    )
    bounty_service._bounty_store[bounty.id] = bounty
    return bounty


@pytest.fixture
def sample_bounty_t3():
    """Create a sample T3 bounty for testing."""
    bounty = BountyDB(
        title="Test T3 Bounty",
        description="Complex task",
        tier=BountyTier.T3,
        reward_amount=1000.0,
        status=BountyStatus.OPEN,
    )
    bounty_service._bounty_store[bounty.id] = bounty
    return bounty


@pytest.fixture
def sample_bounty_t1():
    """Create a sample T1 bounty for testing."""
    bounty = BountyDB(
        title="Test T1 Bounty",
        description="Simple task",
        tier=BountyTier.T1,
        reward_amount=10.0,
        status=BountyStatus.OPEN,
    )
    bounty_service._bounty_store[bounty.id] = bounty
    return bounty


class TestClaimBounty:
    """Tests for the claim_bounty endpoint."""

    def test_claim_t2_bounty_success(self, sample_bounty_t2):
        """Test successfully claiming a T2 bounty."""
        claim_data = BountyClaimRequest(
            claimant_id="user-123",
            reputation=T2_MIN_REPUTATION,
        )
        result, error = bounty_service.claim_bounty(sample_bounty_t2.id, claim_data)
        assert error is None
        assert result.status == BountyStatus.CLAIMED
        assert result.claimant_id == "user-123"

    def test_claim_t3_bounty_requires_application(self, sample_bounty_t3):
        """Test that T3 bounties require an application plan."""
        claim_data = BountyClaimRequest(
            claimant_id="user-123",
            reputation=T3_MIN_REPUTATION,
            application=None,
        )
        result, error = bounty_service.claim_bounty(sample_bounty_t3.id, claim_data)
        assert error == "Tier 3 bounties require an application plan"
        assert result is None

    def test_claim_t1_bounty_fails(self, sample_bounty_t1):
        """Test that T1 bounties cannot be claimed."""
        claim_data = BountyClaimRequest(claimant_id="user-123", reputation=100)
        result, error = bounty_service.claim_bounty(sample_bounty_t1.id, claim_data)
        assert error == "Tier 1 bounties do not support claiming. Submit directly."
        assert result is None

    def test_claim_bounty_insufficient_reputation_t2(self, sample_bounty_t2):
        """Test that insufficient reputation prevents claiming T2."""
        claim_data = BountyClaimRequest(
            claimant_id="user-123",
            reputation=T2_MIN_REPUTATION - 1,
        )
        result, error = bounty_service.claim_bounty(sample_bounty_t2.id, claim_data)
        assert "Insufficient reputation" in error
        assert result is None

    def test_claim_bounty_not_found(self):
        """Test claiming a non-existent bounty."""
        claim_data = BountyClaimRequest(claimant_id="user-123", reputation=100)
        result, error = bounty_service.claim_bounty("nonexistent-id", claim_data)
        assert error == "Bounty not found"
        assert result is None


class TestUnclaimBounty:
    """Tests for the unclaim_bounty endpoint."""

    def test_unclaim_success(self, sample_bounty_t2):
        """Test successfully releasing a claim."""
        claim_data = BountyClaimRequest(
            claimant_id="user-123",
            reputation=T2_MIN_REPUTATION,
        )
        bounty_service.claim_bounty(sample_bounty_t2.id, claim_data)
        result, error = bounty_service.unclaim_bounty(sample_bounty_t2.id, "user-123")
        assert error is None
        assert result.status == BountyStatus.OPEN
        assert result.claimant_id is None

    def test_unclaim_wrong_user(self, sample_bounty_t2):
        """Test that only the claimant can release a claim."""
        claim_data = BountyClaimRequest(
            claimant_id="actual-claimant",
            reputation=T2_MIN_REPUTATION,
        )
        bounty_service.claim_bounty(sample_bounty_t2.id, claim_data)
        result, error = bounty_service.unclaim_bounty(sample_bounty_t2.id, "wrong-user")
        assert error == "Only the current claimant can release the claim"
        assert result is None


class TestGetClaimant:
    """Tests for the get_claimant endpoint."""

    def test_get_claimant_success(self, sample_bounty_t2):
        """Test getting claimant info for a claimed bounty."""
        claim_data = BountyClaimRequest(
            claimant_id="user-123",
            reputation=T2_MIN_REPUTATION,
        )
        bounty_service.claim_bounty(sample_bounty_t2.id, claim_data)
        result, error = bounty_service.get_claimant(sample_bounty_t2.id)
        assert error is None
        assert result.claimant_id == "user-123"

    def test_get_claimant_unclaimed_bounty(self, sample_bounty_t2):
        """Test getting claimant for an unclaimed bounty."""
        result, error = bounty_service.get_claimant(sample_bounty_t2.id)
        assert error == "Bounty is not currently claimed"
        assert result is None


class TestReleaseExpiredClaims:
    """Tests for the release_expired_claims background task."""

    def test_release_expired_claims(self, sample_bounty_t2):
        """Test releasing expired claims."""
        claim_data = BountyClaimRequest(
            claimant_id="user-123",
            reputation=T2_MIN_REPUTATION,
        )
        bounty_service.claim_bounty(sample_bounty_t2.id, claim_data)
        bounty = bounty_service._bounty_store[sample_bounty_t2.id]
        bounty.claim_deadline = datetime.now(timezone.utc) - timedelta(days=1)
        released_count = bounty_service.release_expired_claims()
        assert released_count == 1
        assert bounty.status == BountyStatus.OPEN
