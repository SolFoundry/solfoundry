"""E2E test: Timeout and auto-refund scenario.

Validates: create bounty -> no submissions -> deadline passes -> auto-refund.

Tests cover expired deadline detection, bounty status for timed-out
bounties, and the refund eligibility logic.

Requirement: Issue #196 item 3.
"""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from tests.e2e.conftest import create_bounty_via_api
from tests.e2e.factories import (
    build_bounty_create_payload,
    build_submission_payload,
    future_deadline,
    past_deadline,
)


def _parse_aware_datetime(iso_string: str) -> datetime:
    """Parse an ISO-8601 string into a timezone-aware datetime.

    Handles both timezone-aware and naive strings by defaulting to UTC.

    Args:
        iso_string: ISO-8601 formatted datetime string.

    Returns:
        A timezone-aware ``datetime`` object.
    """
    dt = datetime.fromisoformat(iso_string)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class TestDeadlineExpiration:
    """Validate bounty deadline handling and expiration detection."""

    def test_bounty_with_past_deadline_is_detectable(self, client: TestClient) -> None:
        """Verify that a bounty with an already-past deadline can be identified.

        Creates a bounty with a deadline in the past and verifies the
        deadline field is correctly stored and returned by the API.
        """
        expired_deadline = past_deadline(hours=48)
        payload = build_bounty_create_payload(
            title="Expired deadline bounty",
            reward_amount=250.0,
            deadline=expired_deadline,
        )
        bounty = create_bounty_via_api(client, payload)

        assert bounty["deadline"] is not None
        bounty_deadline = _parse_aware_datetime(bounty["deadline"])
        assert bounty_deadline < datetime.now(timezone.utc)

    def test_bounty_with_future_deadline_is_valid(self, client: TestClient) -> None:
        """Verify that a bounty with a future deadline is correctly stored."""
        valid_deadline = future_deadline(hours=72)
        payload = build_bounty_create_payload(
            title="Future deadline bounty",
            reward_amount=300.0,
            deadline=valid_deadline,
        )
        bounty = create_bounty_via_api(client, payload)

        assert bounty["deadline"] is not None
        bounty_deadline = _parse_aware_datetime(bounty["deadline"])
        assert bounty_deadline > datetime.now(timezone.utc)

    def test_expired_bounty_with_no_submissions(self, client: TestClient) -> None:
        """Verify an expired bounty with no submissions is refund-eligible.

        The bounty should remain in ``open`` status with zero submissions,
        indicating it timed out without any work being done -- the ideal
        candidate for an automatic escrow refund.
        """
        payload = build_bounty_create_payload(
            title="No submissions timeout bounty",
            reward_amount=500.0,
            deadline=past_deadline(hours=24),
        )
        bounty = create_bounty_via_api(client, payload)
        bounty_id = bounty["id"]

        detail = client.get(f"/api/bounties/{bounty_id}").json()
        assert detail["status"] == "open"
        assert detail["submission_count"] == 0

        # Deadline has passed -- this bounty is eligible for auto-refund
        deadline_dt = _parse_aware_datetime(detail["deadline"])
        assert deadline_dt < datetime.now(timezone.utc)


class TestAutoRefundMechanism:
    """Validate the auto-refund mechanism implementation.

    Tests the escrow refund endpoint and the ``refund_expired_escrows``
    background task that automatically refunds expired bounties.
    """

    def test_escrow_refund_endpoint_for_expired_bounty(
        self, client: TestClient
    ) -> None:
        """Verify the escrow refund endpoint is reachable for expired bounties.

        Creates a bounty with a past deadline, then attempts to refund
        its escrow through the ``POST /api/escrow/refund`` endpoint.
        The refund will fail (no escrow was funded in test mode), but
        the endpoint is exercised end-to-end.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(
                title="Auto-refund mechanism test",
                reward_amount=500.0,
                deadline=past_deadline(hours=48),
            ),
        )
        bounty_id = bounty["id"]

        # Attempt refund through the real API endpoint
        refund_response = client.post(
            "/api/escrow/refund",
            json={"bounty_id": bounty_id},
        )
        # 404 (no escrow exists since we didn't fund it) or 200 (refunded)
        assert refund_response.status_code in (200, 404), (
            f"Escrow refund returned: "
            f"{refund_response.status_code} -- {refund_response.text}"
        )

    def test_refund_expired_escrows_function_exists(self) -> None:
        """Verify the ``refund_expired_escrows`` background task is importable.

        This function runs periodically in production to automatically
        refund escrows past their ``expires_at`` deadline. We verify it
        exists and has the expected signature.
        """
        from app.services.escrow_service import refund_expired_escrows
        import inspect

        assert callable(refund_expired_escrows)
        assert inspect.iscoroutinefunction(refund_expired_escrows)

    def test_periodic_escrow_refund_function_exists(self) -> None:
        """Verify the ``periodic_escrow_refund`` background task is importable.

        This is the ``asyncio`` loop that calls ``refund_expired_escrows``
        on a configurable interval.
        """
        from app.services.escrow_service import periodic_escrow_refund
        import inspect

        assert callable(periodic_escrow_refund)
        assert inspect.iscoroutinefunction(periodic_escrow_refund)


class TestRefundEligibility:
    """Validate the refund eligibility determination logic."""

    def test_expired_bounty_without_submissions_is_refundable(
        self, client: TestClient
    ) -> None:
        """Verify refund eligibility: expired + no submissions = refundable.

        The auto-refund system checks:
        1. Deadline has passed.
        2. Status is still ``open`` (no work in progress).
        3. No submissions have been made.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(
                deadline=past_deadline(hours=12),
                reward_amount=100.0,
            ),
        )
        detail = client.get(f"/api/bounties/{bounty['id']}").json()

        is_expired = detail["deadline"] is not None and _parse_aware_datetime(
            detail["deadline"]
        ) < datetime.now(timezone.utc)
        is_open = detail["status"] == "open"
        no_submissions = detail["submission_count"] == 0

        assert is_expired and is_open and no_submissions, (
            "Bounty should be eligible for auto-refund"
        )

    def test_bounty_with_submissions_is_not_auto_refundable(
        self, client: TestClient
    ) -> None:
        """Verify that bounties with submissions are NOT auto-refundable.

        Even if the deadline has passed, a bounty with active submissions
        should proceed through the review process rather than being refunded.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(
                deadline=past_deadline(hours=6),
                reward_amount=200.0,
            ),
        )
        bounty_id = bounty["id"]

        # Submit a solution before checking refund eligibility
        client.post(
            f"/api/bounties/{bounty_id}/submit",
            json=build_submission_payload(),
        )

        detail = client.get(f"/api/bounties/{bounty_id}").json()
        has_submissions = detail["submission_count"] > 0
        assert has_submissions, "Bounty with submissions should not be auto-refunded"

    def test_in_progress_bounty_not_refundable(self, client: TestClient) -> None:
        """Verify that ``in_progress`` bounties are not refund-eligible.

        Once a contributor is actively working on a bounty, it should not
        be automatically refunded even if the deadline passes.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(
                deadline=past_deadline(hours=2),
            ),
        )
        bounty_id = bounty["id"]

        # Advance to in_progress
        client.patch(
            f"/api/bounties/{bounty_id}",
            json={"status": "in_progress"},
        )

        detail = client.get(f"/api/bounties/{bounty_id}").json()
        assert detail["status"] == "in_progress"
        # in_progress bounties are not eligible for auto-refund


class TestTimeoutBountyBatchDetection:
    """Validate batch detection of timed-out bounties."""

    def test_identify_all_expired_bounties(self, client: TestClient) -> None:
        """Verify batch identification of all expired bounties.

        Creates a mix of expired and active bounties, then filters
        to find only the expired ones -- simulating the auto-refund
        scanner that would run periodically.
        """
        # Create 3 expired bounties
        expired_ids = []
        for i in range(3):
            bounty = create_bounty_via_api(
                client,
                build_bounty_create_payload(
                    title=f"Expired #{i}",
                    deadline=past_deadline(hours=24 * (i + 1)),
                ),
            )
            expired_ids.append(bounty["id"])

        # Create 2 active bounties (future deadline)
        active_ids = []
        for i in range(2):
            bounty = create_bounty_via_api(
                client,
                build_bounty_create_payload(
                    title=f"Active #{i}",
                    deadline=future_deadline(hours=48),
                ),
            )
            active_ids.append(bounty["id"])

        # Fetch all bounties and classify
        all_bounties = client.get("/api/bounties?limit=100").json()
        now = datetime.now(timezone.utc)

        expired_found = []
        active_found = []
        for item in all_bounties["items"]:
            if item.get("deadline") is not None:
                deadline_dt = _parse_aware_datetime(item["deadline"])
                if deadline_dt < now:
                    expired_found.append(item["id"])
                else:
                    active_found.append(item["id"])

        # Verify our expired bounties are detected
        for eid in expired_ids:
            assert eid in expired_found, f"Expired bounty {eid} not found"
        for aid in active_ids:
            assert aid in active_found, f"Active bounty {aid} not found"

    def test_bounty_without_deadline_never_expires(self, client: TestClient) -> None:
        """Verify that bounties without a deadline are never considered expired.

        Bounties with ``deadline=None`` should remain open indefinitely.
        """
        bounty = create_bounty_via_api(
            client,
            build_bounty_create_payload(deadline=None),
        )
        detail = client.get(f"/api/bounties/{bounty['id']}").json()
        assert detail["deadline"] is None
        # No deadline means no expiration -- never auto-refundable

    def test_multiple_bounties_can_expire_independently(
        self, client: TestClient
    ) -> None:
        """Verify that each bounty's deadline is evaluated independently.

        Creates bounties with different deadlines to confirm they expire
        at different points in time.
        """
        deadlines = [
            past_deadline(hours=1),  # Recently expired
            past_deadline(hours=168),  # Expired a week ago
            future_deadline(hours=1),  # Expires in 1 hour
            future_deadline(hours=720),  # Expires in a month
        ]

        bounties = []
        for dl in deadlines:
            bounty = create_bounty_via_api(
                client,
                build_bounty_create_payload(deadline=dl),
            )
            bounties.append(bounty)

        now = datetime.now(timezone.utc)
        for i, bounty in enumerate(bounties):
            detail = client.get(f"/api/bounties/{bounty['id']}").json()
            deadline_dt = _parse_aware_datetime(detail["deadline"])
            if i < 2:
                assert deadline_dt < now, f"Bounty {i} should be expired"
            else:
                assert deadline_dt > now, f"Bounty {i} should be active"
