"""Tests for milestone-based multi-stage payouts (Closes #494).

Covers the full milestone lifecycle: creation, submission, approval with
proportional payout, rejection with re-submission, sequential ordering
enforcement, and the 3-milestone integration test.

All tests use an in-memory SQLite database via the conftest.py session
fixture and mock the auth dependency to control user identity.
"""

import os
from decimal import Decimal
from unittest.mock import AsyncMock, patch

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import get_current_user
from app.api.bounties import router as bounties_router
from app.api.milestones import router as milestones_router
from app.models.user import UserResponse
from app.services import bounty_service


# ---------------------------------------------------------------------------
# Auth mocks — two users: owner and contributor
# ---------------------------------------------------------------------------

OWNER_USER = UserResponse(
    id="owner-user-id",
    github_id="owner-github-id",
    username="bountyowner",
    email="owner@example.com",
    avatar_url="http://example.com/owner.png",
    wallet_address="owner-wallet-address",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

CONTRIBUTOR_USER = UserResponse(
    id="contributor-user-id",
    github_id="contributor-github-id",
    username="contributor",
    email="contributor@example.com",
    avatar_url="http://example.com/contributor.png",
    wallet_address="contributor-wallet-address",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

OTHER_USER = UserResponse(
    id="other-user-id",
    github_id="other-github-id",
    username="other",
    email="other@example.com",
    avatar_url="http://example.com/other.png",
    wallet_address="other-wallet-address",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

# Active user override — tests swap this to simulate different users
_active_user = OWNER_USER


async def override_get_current_user():
    """Return the currently active mock user for test authentication."""
    return _active_user


# ---------------------------------------------------------------------------
# Test app & client
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(bounties_router, prefix="/api")
_test_app.include_router(milestones_router, prefix="/api")
_test_app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(_test_app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clean_bounty_store():
    """Reset the in-memory bounty store between tests."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


def _create_test_bounty(
    reward_amount: float = 100000.0,
    title: str = "Test T3 Bounty",
) -> dict:
    """Helper to create a bounty via the API as the owner user.

    Args:
        reward_amount: The reward amount in $FNDRY.
        title: The bounty title.

    Returns:
        The created bounty JSON response.
    """
    global _active_user
    _active_user = OWNER_USER
    response = client.post(
        "/api/bounties",
        json={
            "title": title,
            "description": "A multi-stage T3 bounty for testing milestones",
            "tier": 3,
            "reward_amount": reward_amount,
            "required_skills": ["python", "fastapi"],
        },
    )
    assert response.status_code == 201, f"Bounty creation failed: {response.text}"
    return response.json()


# =========================================================================
# Unit Tests — Milestone Creation
# =========================================================================


class TestMilestoneCreation:
    """Tests for milestone creation (POST /bounties/{id}/milestones)."""

    def test_create_milestones_success(self):
        """Create 3 milestones that sum to 100% on a bounty."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Database schema and migration", "percentage": "33.33"},
                    {"description": "API endpoints and service layer", "percentage": "33.34"},
                    {"description": "Tests and documentation", "percentage": "33.33"},
                ]
            },
        )
        assert response.status_code == 201, f"Response: {response.text}"
        data = response.json()
        assert data["bounty_id"] == bounty["id"]
        assert len(data["milestones"]) == 3
        assert data["milestones"][0]["milestone_number"] == 1
        assert data["milestones"][1]["milestone_number"] == 2
        assert data["milestones"][2]["milestone_number"] == 3
        assert data["milestones"][0]["status"] == "pending"

    def test_create_milestones_not_100_percent(self):
        """Reject milestones that do not sum to 100%."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Part 1", "percentage": "50"},
                    {"description": "Part 2", "percentage": "30"},
                ]
            },
        )
        # Pydantic validation will reject this at 422
        assert response.status_code == 422

    def test_create_milestones_duplicate_rejected(self):
        """Cannot create milestones twice for the same bounty."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        # First creation succeeds
        response1 = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "First half", "percentage": "50"},
                    {"description": "Second half", "percentage": "50"},
                ]
            },
        )
        assert response1.status_code == 201

        # Second creation fails with 409
        response2 = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Different split", "percentage": "100"},
                ]
            },
        )
        assert response2.status_code == 409

    def test_create_milestones_bounty_not_found(self):
        """404 when creating milestones for a non-existent bounty."""
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            "/api/bounties/nonexistent-id/milestones",
            json={
                "milestones": [
                    {"description": "Only milestone", "percentage": "100"},
                ]
            },
        )
        assert response.status_code == 404

    def test_create_milestones_not_owner(self):
        """403 when a non-owner tries to create milestones."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OTHER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Only milestone", "percentage": "100"},
                ]
            },
        )
        assert response.status_code == 403

    def test_create_two_milestones_50_50(self):
        """Create a simple 50/50 split."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Frontend", "percentage": "50"},
                    {"description": "Backend", "percentage": "50"},
                ]
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["milestones"]) == 2
        assert Decimal(data["milestones"][0]["percentage"]) == Decimal("50")


# =========================================================================
# Unit Tests — Milestone Listing
# =========================================================================


class TestMilestoneListing:
    """Tests for listing milestones (GET /bounties/{id}/milestones)."""

    def test_list_milestones_empty(self):
        """List milestones returns empty when none exist."""
        bounty = _create_test_bounty()
        response = client.get(f"/api/bounties/{bounty['id']}/milestones")
        assert response.status_code == 200
        data = response.json()
        assert len(data["milestones"]) == 0
        assert Decimal(data["total_percentage_approved"]) == Decimal("0")

    def test_list_milestones_with_data(self):
        """List milestones returns created milestones in order."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Phase 1", "percentage": "30"},
                    {"description": "Phase 2", "percentage": "40"},
                    {"description": "Phase 3", "percentage": "30"},
                ]
            },
        )

        response = client.get(f"/api/bounties/{bounty['id']}/milestones")
        assert response.status_code == 200
        data = response.json()
        assert len(data["milestones"]) == 3
        assert data["milestones"][0]["milestone_number"] == 1
        assert data["milestones"][1]["milestone_number"] == 2
        assert data["milestones"][2]["milestone_number"] == 3

    def test_list_milestones_bounty_not_found(self):
        """404 when listing milestones for a non-existent bounty."""
        response = client.get("/api/bounties/nonexistent-id/milestones")
        assert response.status_code == 404


# =========================================================================
# Unit Tests — Milestone Submission
# =========================================================================


class TestMilestoneSubmission:
    """Tests for milestone submission (POST /milestones/{id}/submit)."""

    def test_submit_milestone_success(self):
        """Contributor can submit a PENDING milestone."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Schema migration", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        _active_user = CONTRIBUTOR_USER
        response = client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "https://github.com/org/repo/pull/42"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "submitted"
        assert "pull/42" in data["description"]

    def test_submit_milestone_not_found(self):
        """404 when submitting a non-existent milestone."""
        global _active_user
        _active_user = CONTRIBUTOR_USER

        response = client.post(
            "/api/milestones/nonexistent-id/submit",
            json={"evidence": "some evidence"},
        )
        assert response.status_code == 404

    def test_submit_already_submitted_milestone(self):
        """409 when submitting a milestone that is already SUBMITTED."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Work item", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        _active_user = CONTRIBUTOR_USER
        # First submit
        client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "first submission"},
        )
        # Second submit should fail
        response = client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "duplicate submission"},
        )
        assert response.status_code == 409


# =========================================================================
# Unit Tests — Milestone Approval
# =========================================================================


class TestMilestoneApproval:
    """Tests for milestone approval (POST /milestones/{id}/approve)."""

    @patch("app.services.milestone_service._execute_milestone_payout", new_callable=AsyncMock)
    def test_approve_milestone_success(self, mock_payout):
        """Owner approves a SUBMITTED milestone, triggering payout."""
        mock_payout.return_value = "mock_tx_hash_abc123"

        bounty = _create_test_bounty(reward_amount=100000.0)
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Full delivery", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        # Submit as contributor
        _active_user = CONTRIBUTOR_USER
        client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "PR #42 merged"},
        )

        # Approve as owner
        _active_user = OWNER_USER
        response = client.post(f"/api/milestones/{milestone_id}/approve")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paid"
        assert data["payout_tx_hash"] == "mock_tx_hash_abc123"
        assert Decimal(data["payout_amount"]) == Decimal("100000.000000")

    def test_approve_not_submitted_milestone(self):
        """409 when approving a PENDING (not submitted) milestone."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Work item", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        response = client.post(f"/api/milestones/{milestone_id}/approve")
        assert response.status_code == 409

    def test_approve_not_owner(self):
        """403 when a non-owner tries to approve a milestone."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Work item", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        _active_user = CONTRIBUTOR_USER
        client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "done"},
        )

        _active_user = OTHER_USER
        response = client.post(f"/api/milestones/{milestone_id}/approve")
        assert response.status_code == 403

    @patch("app.services.milestone_service._execute_milestone_payout", new_callable=AsyncMock)
    def test_approve_out_of_order_rejected(self, mock_payout):
        """409 when approving milestone #2 before milestone #1 is approved."""
        mock_payout.return_value = "mock_tx"

        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "First", "percentage": "50"},
                    {"description": "Second", "percentage": "50"},
                ]
            },
        )
        milestones = create_resp.json()["milestones"]
        milestone_1_id = milestones[0]["id"]
        milestone_2_id = milestones[1]["id"]

        # Submit both milestones
        _active_user = CONTRIBUTOR_USER
        client.post(
            f"/api/milestones/{milestone_1_id}/submit",
            json={"evidence": "evidence for #1"},
        )
        client.post(
            f"/api/milestones/{milestone_2_id}/submit",
            json={"evidence": "evidence for #2"},
        )

        # Try to approve milestone #2 before #1 → 409
        _active_user = OWNER_USER
        response = client.post(f"/api/milestones/{milestone_2_id}/approve")
        assert response.status_code == 409
        assert "milestone #1" in response.json()["detail"].lower()


# =========================================================================
# Unit Tests — Milestone Rejection
# =========================================================================


class TestMilestoneRejection:
    """Tests for milestone rejection (POST /milestones/{id}/reject)."""

    def test_reject_milestone_success(self):
        """Owner rejects a SUBMITTED milestone."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Work item", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        _active_user = CONTRIBUTOR_USER
        client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "incomplete work"},
        )

        _active_user = OWNER_USER
        response = client.post(
            f"/api/milestones/{milestone_id}/reject",
            json={"evidence": "Missing error handling, please add try/except blocks"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert "Missing error handling" in data["description"]

    def test_reject_then_resubmit(self):
        """A rejected milestone can be re-submitted."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Work item", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        # Submit
        _active_user = CONTRIBUTOR_USER
        client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "first attempt"},
        )

        # Reject
        _active_user = OWNER_USER
        client.post(
            f"/api/milestones/{milestone_id}/reject",
            json={"evidence": "Needs more tests"},
        )

        # Re-submit
        _active_user = CONTRIBUTOR_USER
        response = client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "second attempt with tests"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "submitted"

    def test_reject_not_submitted_milestone(self):
        """409 when rejecting a PENDING milestone."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Work item", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        response = client.post(
            f"/api/milestones/{milestone_id}/reject",
            json={"evidence": "Cannot reject what was not submitted"},
        )
        assert response.status_code == 409


# =========================================================================
# Integration Test — 3-Milestone Bounty Full Lifecycle
# =========================================================================


class TestThreeMilestoneIntegration:
    """Integration test: 3-milestone bounty, approve each, verify payouts.

    Simulates a real T3 bounty with three milestones (30%, 40%, 30%),
    testing the full lifecycle from creation through sequential approval
    and proportional payout verification.
    """

    @patch("app.services.milestone_service._execute_milestone_payout", new_callable=AsyncMock)
    def test_full_three_milestone_lifecycle(self, mock_payout):
        """Create 3 milestones, submit, approve sequentially, verify payouts."""
        mock_payout.return_value = "mock_tx_hash"

        bounty = _create_test_bounty(reward_amount=100000.0)
        bounty_id = bounty["id"]

        global _active_user
        _active_user = OWNER_USER

        # Step 1: Create 3 milestones (30% + 40% + 30% = 100%)
        create_resp = client.post(
            f"/api/bounties/{bounty_id}/milestones",
            json={
                "milestones": [
                    {"description": "Database schema and models", "percentage": "30"},
                    {"description": "API endpoints and service layer", "percentage": "40"},
                    {"description": "Tests and documentation", "percentage": "30"},
                ]
            },
        )
        assert create_resp.status_code == 201
        milestones = create_resp.json()["milestones"]
        assert len(milestones) == 3

        milestone_ids = [m["id"] for m in milestones]

        # Step 2: Submit all 3 milestones as contributor
        _active_user = CONTRIBUTOR_USER
        for idx, mid in enumerate(milestone_ids, start=1):
            resp = client.post(
                f"/api/milestones/{mid}/submit",
                json={"evidence": f"Completed milestone #{idx}"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "submitted"

        # Step 3: Approve milestone #1 (30% of 100,000 = 30,000)
        _active_user = OWNER_USER
        resp1 = client.post(f"/api/milestones/{milestone_ids[0]}/approve")
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["status"] == "paid"
        assert Decimal(data1["payout_amount"]) == Decimal("30000.000000")

        # Step 4: Approve milestone #2 (40% of 100,000 = 40,000)
        resp2 = client.post(f"/api/milestones/{milestone_ids[1]}/approve")
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["status"] == "paid"
        assert Decimal(data2["payout_amount"]) == Decimal("40000.000000")

        # Step 5: Approve milestone #3 (30% of 100,000 = 30,000)
        resp3 = client.post(f"/api/milestones/{milestone_ids[2]}/approve")
        assert resp3.status_code == 200
        data3 = resp3.json()
        assert data3["status"] == "paid"
        assert Decimal(data3["payout_amount"]) == Decimal("30000.000000")

        # Step 6: Verify progress on listing
        list_resp = client.get(f"/api/bounties/{bounty_id}/milestones")
        assert list_resp.status_code == 200
        progress = list_resp.json()
        assert Decimal(progress["total_percentage_approved"]) == Decimal("100")
        assert Decimal(progress["total_percentage_paid"]) == Decimal("100")
        assert Decimal(progress["total_paid_amount"]) == Decimal("100000.000000")

        # Step 7: Verify total payouts sum to bounty reward
        total_paid = sum(
            Decimal(m["payout_amount"])
            for m in progress["milestones"]
            if m["payout_amount"]
        )
        assert total_paid == Decimal("100000.000000")

        # Step 8: Verify mock payout was called 3 times
        assert mock_payout.call_count == 3

    @patch("app.services.milestone_service._execute_milestone_payout", new_callable=AsyncMock)
    def test_sequential_approval_enforced(self, mock_payout):
        """Cannot skip milestone #1 when approving #2."""
        mock_payout.return_value = "mock_tx_hash"

        bounty = _create_test_bounty(reward_amount=90000.0)
        bounty_id = bounty["id"]

        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty_id}/milestones",
            json={
                "milestones": [
                    {"description": "Phase 1", "percentage": "33.34"},
                    {"description": "Phase 2", "percentage": "33.33"},
                    {"description": "Phase 3", "percentage": "33.33"},
                ]
            },
        )
        milestones = create_resp.json()["milestones"]

        # Submit all as contributor
        _active_user = CONTRIBUTOR_USER
        for mid in [milestones[0]["id"], milestones[1]["id"], milestones[2]["id"]]:
            client.post(
                f"/api/milestones/{mid}/submit",
                json={"evidence": "evidence"},
            )

        # Try to approve #2 first → 409
        _active_user = OWNER_USER
        resp = client.post(f"/api/milestones/{milestones[1]['id']}/approve")
        assert resp.status_code == 409

        # Approve #1 first
        resp1 = client.post(f"/api/milestones/{milestones[0]['id']}/approve")
        assert resp1.status_code == 200

        # Now #2 should work
        resp2 = client.post(f"/api/milestones/{milestones[1]['id']}/approve")
        assert resp2.status_code == 200

        # Now #3 should work
        resp3 = client.post(f"/api/milestones/{milestones[2]['id']}/approve")
        assert resp3.status_code == 200


# =========================================================================
# Edge Cases
# =========================================================================


class TestMilestoneEdgeCases:
    """Edge case tests for milestone payouts."""

    def test_single_milestone_100_percent(self):
        """A single milestone at 100% works like a regular payout."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Everything", "percentage": "100"},
                ]
            },
        )
        assert response.status_code == 201
        assert len(response.json()["milestones"]) == 1

    def test_milestone_percentages_with_decimals(self):
        """Milestones with decimal percentages (e.g. 33.33 + 33.34 + 33.33)."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Phase alpha", "percentage": "33.33"},
                    {"description": "Phase beta", "percentage": "33.34"},
                    {"description": "Phase gamma", "percentage": "33.33"},
                ]
            },
        )
        assert response.status_code == 201

    def test_empty_milestones_list_rejected(self):
        """Cannot create an empty list of milestones."""
        bounty = _create_test_bounty()
        global _active_user
        _active_user = OWNER_USER

        response = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={"milestones": []},
        )
        assert response.status_code == 422

    @patch("app.services.milestone_service._execute_milestone_payout", new_callable=AsyncMock)
    def test_payout_failure_does_not_crash(self, mock_payout):
        """Milestone approval succeeds even if payout transfer fails."""
        mock_payout.return_value = None  # Simulates transfer failure

        bounty = _create_test_bounty(reward_amount=50000.0)
        global _active_user
        _active_user = OWNER_USER

        create_resp = client.post(
            f"/api/bounties/{bounty['id']}/milestones",
            json={
                "milestones": [
                    {"description": "Deliverable", "percentage": "100"},
                ]
            },
        )
        milestone_id = create_resp.json()["milestones"][0]["id"]

        _active_user = CONTRIBUTOR_USER
        client.post(
            f"/api/milestones/{milestone_id}/submit",
            json={"evidence": "evidence"},
        )

        _active_user = OWNER_USER
        response = client.post(f"/api/milestones/{milestone_id}/approve")
        assert response.status_code == 200
        data = response.json()
        # When payout returns None, status stays APPROVED (not PAID)
        assert data["status"] == "approved"
        assert data["payout_tx_hash"] is None
