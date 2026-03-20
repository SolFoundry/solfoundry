"""Tests for bounty claiming functionality (Issue #16)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import bounty_service
from app.models.bounty import BountyStatus


client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_store():
    """Clear the bounty store before each test."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


class TestClaimBounty:
    """Tests for POST /bounties/{bounty_id}/claim endpoint."""

    def test_claim_open_bounty(self):
        """Test claiming an open bounty succeeds."""
        create_resp = client.post(
            "/api/bounties",
            json={
                "title": "Test Bounty",
                "description": "Test description",
                "tier": 2,
                "reward_amount": 100.0,
                "created_by": "admin",
            },
        )
        assert create_resp.status_code == 201
        bounty_id = create_resp.json()["id"]

        claim_resp = client.post(
            f"/api/bounties/{bounty_id}/claim",
            json={"claimant_id": "user123"},
        )
        assert claim_resp.status_code == 200
        
        data = claim_resp.json()
        assert data["status"] == "claimed"
        assert data["claimant_id"] == "user123"
        assert data["claimed_at"] is not None

    def test_claim_nonexistent_bounty(self):
        """Test claiming a non-existent bounty returns 404."""
        resp = client.post(
            "/api/bounties/nonexistent/claim",
            json={"claimant_id": "user123"},
        )
        assert resp.status_code == 404

    def test_claim_already_claimed_bounty(self):
        """Test claiming an already claimed bounty fails."""
        create_resp = client.post(
            "/api/bounties",
            json={
                "title": "Test Bounty",
                "reward_amount": 100.0,
                "created_by": "admin",
            },
        )
        bounty_id = create_resp.json()["id"]
        
        client.post(
            f"/api/bounties/{bounty_id}/claim",
            json={"claimant_id": "user1"},
        )

        resp = client.post(
            f"/api/bounties/{bounty_id}/claim",
            json={"claimant_id": "user2"},
        )
        assert resp.status_code == 400


class TestUnclaimBounty:
    """Tests for DELETE /bounties/{bounty_id}/claim endpoint."""

    def test_unclaim_by_claimant(self):
        """Test unclaiming by the claimant succeeds."""
        create_resp = client.post(
            "/api/bounties",
            json={
                "title": "Test Bounty",
                "reward_amount": 100.0,
                "created_by": "admin",
            },
        )
        bounty_id = create_resp.json()["id"]
        
        client.post(
            f"/api/bounties/{bounty_id}/claim",
            json={"claimant_id": "user123"},
        )

        resp = client.delete(
            f"/api/bounties/{bounty_id}/claim?claimant_id=user123"
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["status"] == "open"
        assert data["claimant_id"] is None


class TestGetClaimant:
    """Tests for GET /bounties/{bounty_id}/claimant endpoint."""

    def test_get_claimant_for_claimed_bounty(self):
        """Test getting claimant for a claimed bounty."""
        create_resp = client.post(
            "/api/bounties",
            json={
                "title": "Test Bounty",
                "reward_amount": 100.0,
                "created_by": "admin",
            },
        )
        bounty_id = create_resp.json()["id"]
        
        client.post(
            f"/api/bounties/{bounty_id}/claim",
            json={"claimant_id": "user123"},
        )

        resp = client.get(f"/api/bounties/{bounty_id}/claimant")
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["bounty_id"] == bounty_id
        assert data["claimant_id"] == "user123"

    def test_get_claimant_for_unclaimed_bounty(self):
        """Test getting claimant for an unclaimed bounty returns 404."""
        create_resp = client.post(
            "/api/bounties",
            json={
                "title": "Test Bounty",
                "reward_amount": 100.0,
                "created_by": "admin",
            },
        )
        bounty_id = create_resp.json()["id"]

        resp = client.get(f"/api/bounties/{bounty_id}/claimant")
        # Returns 400 when bounty exists but is not claimed
        assert resp.status_code == 400


class TestGetClaimHistory:
    """Tests for GET /bounties/{bounty_id}/claim-history endpoint."""

    def test_get_claim_history(self):
        """Test getting claim history for a bounty."""
        create_resp = client.post(
            "/api/bounties",
            json={
                "title": "Test Bounty",
                "reward_amount": 100.0,
                "created_by": "admin",
            },
        )
        bounty_id = create_resp.json()["id"]
        
        client.post(
            f"/api/bounties/{bounty_id}/claim",
            json={"claimant_id": "user123"},
        )

        client.delete(
            f"/api/bounties/{bounty_id}/claim?claimant_id=user123"
        )

        resp = client.get(f"/api/bounties/{bounty_id}/claim-history")
        assert resp.status_code == 200
        
        data = resp.json()
        assert data["total"] == 2