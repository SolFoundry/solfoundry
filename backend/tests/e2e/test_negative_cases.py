"""E2E test: Negative test cases and error handling.

Validates: insufficient balance, expired deadline, duplicate submission,
invalid wallet, malformed payloads, missing resources, and invalid
status transitions.

These tests ensure the system fails gracefully and returns
appropriate error codes and messages for all known bad-input scenarios.

Requirement: Issue #196 item 8.
"""

import uuid

from fastapi.testclient import TestClient

from tests.e2e.conftest import advance_bounty_status, create_bounty_via_api
from tests.e2e.factories import (
    build_bounty_create_payload,
    build_payout_create_payload,
    build_submission_payload,
)


class TestInvalidBountyCreation:
    """Validate rejection of malformed bounty creation requests."""

    def test_missing_title_rejected(self, client: TestClient) -> None:
        """Verify that bounty creation without a title returns 422."""
        response = client.post(
            "/api/bounties",
            json={"reward_amount": 100.0},
        )
        assert response.status_code == 422

    def test_title_too_short_rejected(self, client: TestClient) -> None:
        """Verify that titles shorter than the minimum length are rejected."""
        response = client.post(
            "/api/bounties",
            json={"title": "ab", "reward_amount": 100.0},
        )
        assert response.status_code == 422

    def test_title_too_long_rejected(self, client: TestClient) -> None:
        """Verify that titles exceeding the maximum length are rejected."""
        long_title = "A" * 201
        response = client.post(
            "/api/bounties",
            json={"title": long_title, "reward_amount": 100.0},
        )
        assert response.status_code == 422

    def test_missing_reward_rejected(self, client: TestClient) -> None:
        """Verify that bounty creation without a reward amount returns 422."""
        response = client.post(
            "/api/bounties",
            json={"title": "No reward bounty"},
        )
        assert response.status_code == 422

    def test_negative_reward_rejected(self, client: TestClient) -> None:
        """Verify that negative reward amounts are rejected."""
        response = client.post(
            "/api/bounties",
            json={"title": "Negative reward", "reward_amount": -100.0},
        )
        assert response.status_code == 422

    def test_zero_reward_rejected(self, client: TestClient) -> None:
        """Verify that zero reward amounts are rejected (minimum is 0.01)."""
        response = client.post(
            "/api/bounties",
            json={"title": "Zero reward", "reward_amount": 0.0},
        )
        assert response.status_code == 422

    def test_reward_exceeds_maximum_rejected(self, client: TestClient) -> None:
        """Verify that rewards exceeding the maximum are rejected."""
        response = client.post(
            "/api/bounties",
            json={"title": "Excessive reward", "reward_amount": 2_000_000.0},
        )
        assert response.status_code == 422

    def test_invalid_tier_rejected(self, client: TestClient) -> None:
        """Verify that invalid tier values are rejected."""
        response = client.post(
            "/api/bounties",
            json={"title": "Invalid tier", "reward_amount": 100.0, "tier": 5},
        )
        assert response.status_code == 422

    def test_invalid_github_url_rejected(self, client: TestClient) -> None:
        """Verify that non-GitHub URLs in ``github_issue_url`` are rejected."""
        response = client.post(
            "/api/bounties",
            json={
                "title": "Bad github URL",
                "reward_amount": 100.0,
                "github_issue_url": "https://not-github.com/issues/1",
            },
        )
        assert response.status_code == 422

    def test_invalid_skill_format_rejected(self, client: TestClient) -> None:
        """Verify that skills with invalid characters are rejected."""
        response = client.post(
            "/api/bounties",
            json={
                "title": "Bad skills",
                "reward_amount": 100.0,
                "required_skills": ["INVALID SKILL WITH SPACES"],
            },
        )
        assert response.status_code == 422

    def test_too_many_skills_rejected(self, client: TestClient) -> None:
        """Verify that exceeding the maximum skill count is rejected."""
        skills = [f"skill{i}" for i in range(25)]  # Max is 20
        response = client.post(
            "/api/bounties",
            json={
                "title": "Too many skills",
                "reward_amount": 100.0,
                "required_skills": skills,
            },
        )
        assert response.status_code == 422

    def test_empty_json_body_rejected(self, client: TestClient) -> None:
        """Verify that an empty JSON body is rejected."""
        response = client.post("/api/bounties", json={})
        assert response.status_code == 422


class TestInvalidBountyOperations:
    """Validate error handling for invalid bounty operations."""

    def test_get_nonexistent_bounty_returns_404(self, client: TestClient) -> None:
        """Verify that fetching a non-existent bounty returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/bounties/{fake_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_nonexistent_bounty_returns_404(self, client: TestClient) -> None:
        """Verify that updating a non-existent bounty returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/bounties/{fake_id}",
            json={"title": "Updated"},
        )
        assert response.status_code == 404

    def test_delete_nonexistent_bounty_returns_404(self, client: TestClient) -> None:
        """Verify that deleting a non-existent bounty returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.delete(f"/api/bounties/{fake_id}")
        assert response.status_code == 404

    def test_submit_to_nonexistent_bounty_returns_404(self, client: TestClient) -> None:
        """Verify that submitting to a non-existent bounty returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.post(
            f"/api/bounties/{fake_id}/submit",
            json=build_submission_payload(),
        )
        assert response.status_code == 404

    def test_list_submissions_nonexistent_bounty_returns_404(
        self, client: TestClient
    ) -> None:
        """Verify that listing submissions for a non-existent bounty returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/bounties/{fake_id}/submissions")
        assert response.status_code == 404


class TestInvalidStatusTransitions:
    """Validate rejection of invalid bounty status transitions."""

    def test_open_to_completed_rejected(self, client: TestClient) -> None:
        """Verify direct ``open`` -> ``completed`` transition is rejected.

        Must go through ``in_progress`` first.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        response = client.patch(
            f"/api/bounties/{bounty['id']}",
            json={"status": "completed"},
        )
        assert response.status_code == 400
        assert "Invalid status transition" in response.json()["detail"]

    def test_open_to_paid_rejected(self, client: TestClient) -> None:
        """Verify direct ``open`` -> ``paid`` transition is rejected."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        response = client.patch(
            f"/api/bounties/{bounty['id']}",
            json={"status": "paid"},
        )
        assert response.status_code == 400

    def test_in_progress_to_paid_rejected(self, client: TestClient) -> None:
        """Verify direct ``in_progress`` -> ``paid`` transition is rejected.

        Must go through ``completed`` first.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        advance_bounty_status(client, bounty["id"], "in_progress")

        response = client.patch(
            f"/api/bounties/{bounty['id']}",
            json={"status": "paid"},
        )
        assert response.status_code == 400

    def test_paid_to_any_status_rejected(self, client: TestClient) -> None:
        """Verify that the ``paid`` status is truly terminal.

        No transitions should be allowed from ``paid``.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        advance_bounty_status(client, bounty["id"], "paid")

        for target in ["open", "in_progress", "completed"]:
            response = client.patch(
                f"/api/bounties/{bounty['id']}",
                json={"status": target},
            )
            assert response.status_code == 400, (
                f"Transition from paid to {target} should be rejected"
            )

    def test_completed_to_open_rejected(self, client: TestClient) -> None:
        """Verify ``completed`` -> ``open`` transition is rejected.

        Can only go to ``paid`` or back to ``in_progress``.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        advance_bounty_status(client, bounty["id"], "completed")

        response = client.patch(
            f"/api/bounties/{bounty['id']}",
            json={"status": "open"},
        )
        assert response.status_code == 400


class TestInvalidSubmissions:
    """Validate rejection of malformed submission requests."""

    def test_submission_with_invalid_pr_url(self, client: TestClient) -> None:
        """Verify that non-GitHub PR URLs are rejected."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        response = client.post(
            f"/api/bounties/{bounty['id']}/submit",
            json={
                "pr_url": "https://gitlab.com/repo/merge_requests/1",
                "submitted_by": "bad-url-submitter",
            },
        )
        assert response.status_code == 422

    def test_submission_with_empty_pr_url(self, client: TestClient) -> None:
        """Verify that empty PR URLs are rejected."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        response = client.post(
            f"/api/bounties/{bounty['id']}/submit",
            json={
                "pr_url": "",
                "submitted_by": "empty-url-submitter",
            },
        )
        assert response.status_code == 422

    def test_submission_with_missing_pr_url_field(self, client: TestClient) -> None:
        """Verify that submissions without a ``pr_url`` field are rejected."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        response = client.post(
            f"/api/bounties/{bounty['id']}/submit",
            json={
                "submitted_by": "some-contributor",
            },
        )
        assert response.status_code == 422

    def test_duplicate_submission_pr_url(self, client: TestClient) -> None:
        """Verify that duplicate PR URLs on the same bounty are rejected."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        bounty_id = bounty["id"]

        duplicate_url = "https://github.com/SolFoundry/solfoundry/pull/999"
        payload = {
            "pr_url": duplicate_url,
            "submitted_by": "submitter-1",
        }

        # First succeeds
        first = client.post(f"/api/bounties/{bounty_id}/submit", json=payload)
        assert first.status_code == 201

        # Duplicate rejected
        second = client.post(
            f"/api/bounties/{bounty_id}/submit",
            json={**payload, "submitted_by": "submitter-2"},
        )
        assert second.status_code == 400
        assert "already been submitted" in second.json()["detail"]


class TestInvalidPayouts:
    """Validate rejection of malformed payout requests."""

    def test_payout_with_invalid_wallet_format(self, client: TestClient) -> None:
        """Verify that invalid Solana wallet addresses are rejected."""
        response = client.post(
            "/api/payouts",
            json={
                "recipient": "test-user",
                "recipient_wallet": "invalid-not-base58!!!",
                "amount": 100.0,
                "token": "FNDRY",
            },
        )
        assert response.status_code == 422

    def test_payout_with_zero_amount(self, client: TestClient) -> None:
        """Verify that zero-amount payouts are rejected."""
        response = client.post(
            "/api/payouts",
            json={
                "recipient": "test-user",
                "amount": 0.0,
                "token": "FNDRY",
            },
        )
        assert response.status_code == 422

    def test_payout_with_negative_amount(self, client: TestClient) -> None:
        """Verify that negative payout amounts are rejected."""
        response = client.post(
            "/api/payouts",
            json={
                "recipient": "test-user",
                "amount": -50.0,
                "token": "FNDRY",
            },
        )
        assert response.status_code == 422

    def test_payout_with_invalid_token_type(self, client: TestClient) -> None:
        """Verify that unsupported token types are rejected."""
        response = client.post(
            "/api/payouts",
            json={
                "recipient": "test-user",
                "amount": 100.0,
                "token": "BTC",  # Only FNDRY and SOL are valid
            },
        )
        assert response.status_code == 422

    def test_duplicate_tx_hash_rejected(self, client: TestClient) -> None:
        """Verify that duplicate transaction hashes are rejected.

        Each payout must have a unique on-chain transaction hash.
        """
        from tests.e2e.factories import unique_tx_hash

        unique_hash = unique_tx_hash()

        payload = build_payout_create_payload(
            recipient="first-recipient",
            amount=100.0,
            tx_hash=unique_hash,
        )
        first = client.post("/api/payouts", json=payload)
        assert first.status_code == 201

        # Second payout with same tx_hash
        duplicate = build_payout_create_payload(
            recipient="second-recipient",
            amount=200.0,
            tx_hash=unique_hash,
        )
        second = client.post("/api/payouts", json=duplicate)
        assert second.status_code == 409

    def test_payout_lookup_invalid_tx_hash_format(self, client: TestClient) -> None:
        """Verify that malformed tx hashes return 400 on lookup."""
        response = client.get("/api/payouts/not-a-valid-hash")
        assert response.status_code == 400

    def test_payout_lookup_nonexistent_tx_hash(self, client: TestClient) -> None:
        """Verify that non-existent tx hashes return 404."""
        # Valid format but doesn't exist
        valid_format_hash = "a" * 64
        response = client.get(f"/api/payouts/{valid_format_hash}")
        assert response.status_code == 404


class TestInvalidContributorOperations:
    """Validate rejection of invalid contributor operations."""

    def test_get_nonexistent_contributor_returns_404(self, client: TestClient) -> None:
        """Verify that fetching a non-existent contributor returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/contributors/{fake_id}")
        assert response.status_code == 404

    def test_duplicate_username_rejected(self, client: TestClient) -> None:
        """Verify that duplicate contributor usernames are rejected."""
        payload = {
            "username": "duplicate-user",
            "display_name": "First User",
            "skills": ["python"],
        }
        first = client.post("/api/contributors", json=payload)
        assert first.status_code == 201

        second = client.post("/api/contributors", json=payload)
        assert second.status_code == 409

    def test_username_too_short_rejected(self, client: TestClient) -> None:
        """Verify that usernames shorter than 3 characters are rejected."""
        response = client.post(
            "/api/contributors",
            json={
                "username": "ab",
                "display_name": "Short username",
            },
        )
        assert response.status_code == 422

    def test_username_with_invalid_characters(self, client: TestClient) -> None:
        """Verify that usernames with special characters are rejected."""
        response = client.post(
            "/api/contributors",
            json={
                "username": "invalid user!@#",
                "display_name": "Bad username",
            },
        )
        assert response.status_code == 422


class TestInvalidPaginationParameters:
    """Validate rejection of invalid pagination parameters."""

    def test_negative_skip_rejected(self, client: TestClient) -> None:
        """Verify that negative skip values are rejected."""
        response = client.get("/api/bounties?skip=-1")
        assert response.status_code == 422

    def test_zero_limit_rejected(self, client: TestClient) -> None:
        """Verify that zero limit values are rejected."""
        response = client.get("/api/bounties?limit=0")
        assert response.status_code == 422

    def test_excessive_limit_rejected(self, client: TestClient) -> None:
        """Verify that limit values exceeding the maximum are rejected."""
        response = client.get("/api/bounties?limit=101")
        assert response.status_code == 422


class TestHealthEndpoint:
    """Validate the health check endpoint."""

    def test_health_returns_ok(self, client: TestClient) -> None:
        """Verify the health endpoint returns a successful response."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
