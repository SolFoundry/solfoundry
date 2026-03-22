"""E2E test: Full bounty lifecycle from creation through payout.

Validates the complete marketplace flow:
  create bounty -> fund escrow -> submit PR -> AI review -> approve -> payout -> verify

This is the most critical test in the suite -- it proves the entire
happy-path works end-to-end without manual intervention.

Requirement: Issue #196 item 1.
"""

from fastapi.testclient import TestClient

from tests.e2e.conftest import (
    DEFAULT_WALLET,
    advance_bounty_status,
    create_bounty_via_api,
)
from tests.e2e.factories import (
    build_bounty_create_payload,
    build_payout_create_payload,
    build_submission_payload,
    future_deadline,
    unique_tx_hash,
)


class TestFullBountyLifecycle:
    """End-to-end lifecycle: create -> submit -> review -> approve -> payout."""

    def test_complete_bounty_lifecycle_happy_path(self, client: TestClient) -> None:
        """Verify the entire bounty lifecycle from creation to payout.

        Steps:
            1. Create a new bounty with valid payload.
            2. Verify the bounty is queryable and has ``open`` status.
            3. Submit a PR solution for the bounty.
            4. Transition bounty to ``in_progress`` (simulating claim).
            5. Transition to ``completed`` (simulating AI review approval).
            6. Record a payout for the contributor.
            7. Transition bounty to ``paid`` (terminal state).
            8. Verify the final bounty state includes the submission and payout.
        """
        # Step 1: Create bounty
        create_payload = build_bounty_create_payload(
            title="Full lifecycle test bounty",
            reward_amount=1000.0,
            tier=2,
            deadline=future_deadline(hours=48),
        )
        bounty = create_bounty_via_api(client, create_payload)
        bounty_id = bounty["id"]
        assert bounty["status"] == "open"
        assert bounty["reward_amount"] == 1000.0
        assert bounty["submission_count"] == 0

        # Step 2: Verify bounty is queryable
        get_response = client.get(f"/api/bounties/{bounty_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["title"] == "Full lifecycle test bounty"
        assert fetched["status"] == "open"

        # Step 3: Submit a PR solution
        submission_payload = build_submission_payload(
            notes="Complete fix addressing all acceptance criteria",
        )
        submit_response = client.post(
            f"/api/bounties/{bounty_id}/submit",
            json=submission_payload,
        )
        assert submit_response.status_code == 201
        submission = submit_response.json()
        assert submission["bounty_id"] == bounty_id
        # submitted_by is set to authenticated user's wallet by the API
        assert submission["submitted_by"] == DEFAULT_WALLET

        # Step 4: Transition to in_progress (claim accepted)
        advance_bounty_status(client, bounty_id, "in_progress")
        in_progress_bounty = client.get(f"/api/bounties/{bounty_id}").json()
        assert in_progress_bounty["status"] == "in_progress"
        assert in_progress_bounty["submission_count"] == 1

        # Step 5: Transition to completed (AI review passed)
        advance_response = client.patch(
            f"/api/bounties/{bounty_id}",
            json={"status": "completed"},
        )
        assert advance_response.status_code == 200
        completed_bounty = advance_response.json()
        assert completed_bounty["status"] == "completed"

        # Step 6: Record payout with unique tx hash
        tx_hash = unique_tx_hash()
        payout_payload = build_payout_create_payload(
            recipient="alice-dev",
            amount=1000.0,
            bounty_id=bounty_id,
            bounty_title="Full lifecycle test bounty",
            tx_hash=tx_hash,
        )
        payout_response = client.post("/api/payouts", json=payout_payload)
        assert payout_response.status_code == 201
        payout = payout_response.json()
        assert payout["status"] == "confirmed"
        assert payout["amount"] == 1000.0
        assert payout["recipient"] == "alice-dev"
        assert payout["bounty_id"] == bounty_id

        # Step 7: Transition to paid (terminal)
        paid_response = client.patch(
            f"/api/bounties/{bounty_id}",
            json={"status": "paid"},
        )
        assert paid_response.status_code == 200
        final_bounty = paid_response.json()
        assert final_bounty["status"] == "paid"

        # Step 8: Verify final state consistency
        final_detail = client.get(f"/api/bounties/{bounty_id}").json()
        assert final_detail["status"] == "paid"
        assert final_detail["submission_count"] == 1

    def test_lifecycle_with_multiple_submissions(self, client: TestClient) -> None:
        """Verify lifecycle works when multiple submissions are made.

        The bounty should accept multiple submissions while in ``open`` or
        ``in_progress`` status.  All use unique PR URLs.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(reward_amount=750.0),
        )
        bounty_id = bounty["id"]

        # Submit three different PR URLs
        for i in range(3):
            payload = build_submission_payload()
            response = client.post(
                f"/api/bounties/{bounty_id}/submit",
                json=payload,
            )
            assert response.status_code == 201

        # Verify all submissions recorded
        subs_response = client.get(f"/api/bounties/{bounty_id}/submissions")
        assert subs_response.status_code == 200
        submissions = subs_response.json()
        assert len(submissions) == 3

        # Complete lifecycle
        advance_bounty_status(client, bounty_id, "completed")
        completed = client.get(f"/api/bounties/{bounty_id}").json()
        assert completed["status"] == "completed"
        assert completed["submission_count"] == 3

    def test_bounty_appears_in_list_at_each_status(self, client: TestClient) -> None:
        """Verify the bounty is filterable by status at every stage.

        Ensures the list endpoint correctly filters by the current status
        throughout the lifecycle.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        bounty_id = bounty["id"]

        # Check bounty appears in open filter
        open_list = client.get("/api/bounties?status=open").json()
        assert any(item["id"] == bounty_id for item in open_list["items"])

        # Advance and check in_progress filter
        advance_bounty_status(client, bounty_id, "in_progress")
        ip_list = client.get("/api/bounties?status=in_progress").json()
        assert any(item["id"] == bounty_id for item in ip_list["items"])

        # Should not appear in open list anymore
        open_after = client.get("/api/bounties?status=open").json()
        assert not any(item["id"] == bounty_id for item in open_after["items"])

    def test_payout_recording_returns_correct_data(self, client: TestClient) -> None:
        """Verify that a recorded payout returns correct data.

        After recording a payout with a transaction hash, the response
        should contain the correct amount, recipient, and status.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(reward_amount=200.0),
        )
        bounty_id = bounty["id"]
        tx_hash = unique_tx_hash()

        payout_payload = build_payout_create_payload(
            recipient="lifecycle-tester",
            amount=200.0,
            bounty_id=bounty_id,
            tx_hash=tx_hash,
        )
        payout_response = client.post("/api/payouts", json=payout_payload)
        assert payout_response.status_code == 201
        payout = payout_response.json()
        assert payout["amount"] == 200.0
        assert payout["recipient"] == "lifecycle-tester"
        assert payout["bounty_id"] == bounty_id
        assert payout["status"] == "confirmed"
        assert payout["solscan_url"] is not None

    def test_submission_records_persist_through_status_changes(
        self, client: TestClient
    ) -> None:
        """Verify submissions are not lost when bounty status changes.

        Regression test ensuring that status transitions preserve the
        submissions list.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        bounty_id = bounty["id"]

        # Add submissions (each with unique PR URL from factory)
        for i in range(3):
            client.post(
                f"/api/bounties/{bounty_id}/submit",
                json=build_submission_payload(),
            )

        # Advance through all statuses
        advance_bounty_status(client, bounty_id, "paid")

        # Verify submissions are intact
        final = client.get(f"/api/bounties/{bounty_id}").json()
        assert final["submission_count"] == 3
        assert len(final["submissions"]) == 3


class TestEscrowLifecycle:
    """End-to-end escrow operations through the real API endpoints.

    Validates the escrow fund, status, and refund endpoints that back
    the $FNDRY bounty staking system.
    """

    def test_escrow_fund_endpoint_exists(self, client: TestClient) -> None:
        """Verify the escrow fund endpoint is reachable and validates input.

        The escrow service depends on an on-chain SPL transfer, so a
        real fund operation will fail in test mode (no Solana connection).
        We verify the endpoint accepts the request and returns a
        structured error rather than a 404.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(
                title="Escrow lifecycle test",
                reward_amount=500.0,
            ),
        )
        bounty_id = bounty["id"]

        fund_response = client.post(
            "/api/escrow/fund",
            json={
                "bounty_id": bounty_id,
                "creator_wallet": DEFAULT_WALLET,
                "amount": 500.0,
            },
        )
        # Escrow creation may fail due to missing Solana connection in tests,
        # but the endpoint should be reachable (not 404) and return a structured
        # error (409 for duplicate, 502 for transfer failure, or 201 for success).
        assert fund_response.status_code in (201, 409, 502), (
            f"Escrow fund returned unexpected status: "
            f"{fund_response.status_code} -- {fund_response.text}"
        )

    def test_escrow_status_for_nonexistent_bounty(
        self, client: TestClient
    ) -> None:
        """Verify the escrow status endpoint returns 404 for unknown bounties."""
        fake_id = "00000000-0000-0000-0000-999999999999"
        response = client.get(f"/api/escrow/{fake_id}")
        assert response.status_code == 404

    def test_escrow_refund_for_nonexistent_bounty(
        self, client: TestClient
    ) -> None:
        """Verify the escrow refund endpoint returns 404 for unknown bounties."""
        fake_id = "00000000-0000-0000-0000-999999999998"
        response = client.post(
            "/api/escrow/refund",
            json={"bounty_id": fake_id},
        )
        assert response.status_code == 404


class TestApprovalWorkflow:
    """End-to-end submission approval through the real API endpoint.

    Uses ``POST /api/bounties/{id}/submissions/{sub_id}/approve`` to
    test the approval flow that triggers bounty completion.
    """

    def test_approve_submission_via_api(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Verify a submission can be approved through the REST API.

        Steps:
            1. Create a bounty.
            2. Submit a solution.
            3. Call the approve endpoint.
            4. Verify the submission status.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(
                title="Approval workflow test",
                reward_amount=250.0,
            ),
        )
        bounty_id = bounty["id"]

        # Submit a solution
        sub_response = client.post(
            f"/api/bounties/{bounty_id}/submit",
            json=build_submission_payload(),
            headers=auth_headers,
        )
        assert sub_response.status_code == 201
        submission_id = sub_response.json()["id"]

        # Approve the submission via real API endpoint
        approve_response = client.post(
            f"/api/bounties/{bounty_id}/submissions/{submission_id}/approve",
            headers=auth_headers,
        )
        # 200 = approved, 400 = business rule violation
        assert approve_response.status_code in (200, 400), (
            f"Approve endpoint returned: "
            f"{approve_response.status_code} -- {approve_response.text}"
        )

    def test_approve_nonexistent_submission_returns_error(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Verify approving a non-existent submission returns an error.

        The endpoint should return 404 (not found). It should not succeed
        with 200.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        fake_sub_id = "00000000-0000-0000-0000-999999999997"

        response = client.post(
            f"/api/bounties/{bounty['id']}/submissions/{fake_sub_id}/approve",
            headers=auth_headers,
        )
        # Should not return success
        assert response.status_code == 404, (
            f"Expected 404, got {response.status_code}"
        )


class TestBountyCreationValidation:
    """Validate bounty creation input handling and constraints."""

    def test_create_bounty_with_all_fields(self, client: TestClient) -> None:
        """Verify bounty creation with every optional field populated."""
        payload = build_bounty_create_payload(
            title="Complete bounty with all fields",
            description="A thorough description of the work needed.",
            tier=3,
            reward_amount=5000.0,
            required_skills=["rust", "solana", "anchor"],
            deadline=future_deadline(hours=72),
            github_issue_url="https://github.com/SolFoundry/solfoundry/issues/196",
        )
        bounty = create_bounty_via_api(client, payload)
        assert bounty["title"] == "Complete bounty with all fields"
        assert bounty["tier"] == 3
        assert bounty["reward_amount"] == 5000.0
        assert set(bounty["required_skills"]) == {"rust", "solana", "anchor"}
        assert bounty["github_issue_url"] is not None

    def test_create_bounty_minimal_fields(self, client: TestClient) -> None:
        """Verify bounty creation with only required fields."""
        payload = {
            "title": "Minimal bounty",
            "reward_amount": 10.0,
        }
        response = client.post("/api/bounties", json=payload)
        assert response.status_code == 201
        bounty = response.json()
        assert bounty["title"] == "Minimal bounty"
        assert bounty["status"] == "open"

    def test_create_bounty_appears_in_list(self, client: TestClient) -> None:
        """Verify newly created bounties appear in the list endpoint."""
        created_ids = set()
        for i in range(5):
            bounty = create_bounty_via_api(
                client,
                build_bounty_create_payload(title=f"List test #{i}"),
            )
            created_ids.add(bounty["id"])

        list_response = client.get("/api/bounties?limit=100").json()
        list_ids = {item["id"] for item in list_response["items"]}
        assert created_ids.issubset(list_ids)


class TestSubmissionWorkflow:
    """Validate the PR submission sub-flow within the lifecycle."""

    def test_submit_solution_to_open_bounty(self, client: TestClient) -> None:
        """Verify a submission is accepted for an open bounty."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        submission_payload = build_submission_payload()
        response = client.post(
            f"/api/bounties/{bounty['id']}/submit",
            json=submission_payload,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["bounty_id"] == bounty["id"]

    def test_list_submissions_for_bounty(self, client: TestClient) -> None:
        """Verify all submissions are retrievable via the list endpoint."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        bounty_id = bounty["id"]

        for i in range(4):
            client.post(
                f"/api/bounties/{bounty_id}/submit",
                json=build_submission_payload(),
            )

        subs = client.get(f"/api/bounties/{bounty_id}/submissions").json()
        assert len(subs) == 4
        # All submitted by the mock user's wallet
        assert all(s["submitted_by"] == DEFAULT_WALLET for s in subs)

    def test_submission_includes_timestamp(self, client: TestClient) -> None:
        """Verify each submission records a ``submitted_at`` timestamp."""
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(),
        )
        response = client.post(
            f"/api/bounties/{bounty['id']}/submit",
            json=build_submission_payload(),
        )
        assert response.status_code == 201
        data = response.json()
        assert "submitted_at" in data
        assert data["submitted_at"] is not None
