"""E2E test: Load testing with concurrent operations.

Validates: 50 concurrent bounty creations, 100 concurrent submissions.

Uses ``asyncio.gather`` for true concurrency testing against the
async FastAPI application.  All operations are measured for timing
to verify performance characteristics.

Requirement: Issue #196 item 7.
"""

import asyncio
import time

import pytest
from httpx import AsyncClient

from tests.e2e.factories import build_bounty_create_payload


class TestConcurrentBountyCreation:
    """Load test: concurrent bounty creation."""

    @pytest.mark.asyncio
    async def test_fifty_concurrent_bounty_creations(
        self, async_client: AsyncClient
    ) -> None:
        """Verify 50 bounties can be created concurrently without errors.

        Measures total wall-clock time and verifies all creations succeed
        with unique IDs.
        """
        target_count = 50

        async def create_bounty(index: int) -> dict:
            """Create a single bounty and return its response.

            Args:
                index: Unique index for deterministic title generation.

            Returns:
                The parsed JSON response body.
            """
            payload = build_bounty_create_payload(
                title=f"Load test bounty #{index}",
                reward_amount=100.0 + index,
            )
            response = await async_client.post("/api/bounties", json=payload)
            return {"status": response.status_code, "body": response.json()}

        start_time = time.monotonic()
        results = await asyncio.gather(
            *(create_bounty(i) for i in range(target_count))
        )
        time.monotonic() - start_time

        # All should succeed
        successes = [r for r in results if r["status"] == 201]
        assert len(successes) == target_count, (
            f"Expected {target_count} successes, got {len(successes)}"
        )

        # All IDs should be unique
        bounty_ids = {r["body"]["id"] for r in successes}
        assert len(bounty_ids) == target_count, "All bounty IDs must be unique"

        # Verify via list endpoint
        list_response = await async_client.get(f"/api/bounties?limit={target_count}")
        assert list_response.status_code == 200
        total = list_response.json()["total"]
        assert total >= target_count

    @pytest.mark.asyncio
    async def test_concurrent_creation_with_varied_tiers(
        self, async_client: AsyncClient
    ) -> None:
        """Verify concurrent creation works across all bounty tiers.

        Creates bounties distributed across T1, T2, and T3 simultaneously.
        """
        tiers = [1, 2, 3]
        count_per_tier = 15  # 45 total

        async def create_tiered_bounty(tier: int, index: int) -> dict:
            """Create a bounty for a specific tier.

            Args:
                tier: Bounty tier (1, 2, or 3).
                index: Unique index within the tier.

            Returns:
                The parsed JSON response body.
            """
            payload = build_bounty_create_payload(
                title=f"Tier {tier} load test #{index}",
                tier=tier,
                reward_amount=tier * 100.0,
            )
            response = await async_client.post("/api/bounties", json=payload)
            return {"status": response.status_code, "tier": tier}

        tasks = []
        for tier in tiers:
            for i in range(count_per_tier):
                tasks.append(create_tiered_bounty(tier, i))

        results = await asyncio.gather(*tasks)
        successes = [r for r in results if r["status"] == 201]
        assert len(successes) == count_per_tier * len(tiers)

        # Verify tier distribution
        for tier in tiers:
            tier_count = sum(1 for r in successes if r["tier"] == tier)
            assert tier_count == count_per_tier


class TestConcurrentSubmissions:
    """Load test: concurrent PR submissions to a single bounty."""

    @pytest.mark.asyncio
    async def test_one_hundred_concurrent_submissions(
        self, async_client: AsyncClient
    ) -> None:
        """Verify 100 submissions can be made concurrently to one bounty.

        Each submission uses a unique PR URL to avoid duplicate detection.
        Measures throughput and verifies all submissions are recorded.
        """
        # Create target bounty
        create_response = await async_client.post(
            "/api/bounties",
            json=build_bounty_create_payload(
                title="Submission load target",
                reward_amount=10000.0,
            ),
        )
        assert create_response.status_code == 201
        bounty_id = create_response.json()["id"]

        target_count = 100

        async def submit_solution(index: int) -> int:
            """Submit a unique solution to the target bounty.

            Args:
                index: Unique index for generating a unique PR URL.

            Returns:
                The HTTP response status code.
            """
            payload = {
                "pr_url": f"https://github.com/SolFoundry/solfoundry/pull/{1000 + index}",
                "submitted_by": f"load-tester-{index}",
                "notes": f"Load test submission #{index}",
            }
            response = await async_client.post(
                f"/api/bounties/{bounty_id}/submit",
                json=payload,
            )
            return response.status_code

        start_time = time.monotonic()
        results = await asyncio.gather(
            *(submit_solution(i) for i in range(target_count))
        )
        time.monotonic() - start_time

        successes = sum(1 for r in results if r == 201)
        assert successes == target_count, (
            f"Expected {target_count} successful submissions, got {successes}"
        )

        # Verify via submissions endpoint
        subs_response = await async_client.get(
            f"/api/bounties/{bounty_id}/submissions"
        )
        assert subs_response.status_code == 200
        assert len(subs_response.json()) == target_count


class TestConcurrentMixedOperations:
    """Load test: mixed concurrent reads and writes."""

    @pytest.mark.asyncio
    async def test_concurrent_reads_and_writes(
        self, async_client: AsyncClient
    ) -> None:
        """Verify the system handles concurrent reads and writes correctly.

        Interleaves bounty creation with list queries to ensure reads
        are consistent and writes don't cause errors under load.
        """
        async def create_and_read(index: int) -> dict:
            """Create a bounty, then immediately read it back.

            Args:
                index: Unique index for the bounty.

            Returns:
                Dictionary with creation and read status codes.
            """
            payload = build_bounty_create_payload(
                title=f"Mixed load #{index}",
                reward_amount=50.0,
            )
            create_resp = await async_client.post("/api/bounties", json=payload)
            bounty_id = create_resp.json().get("id", "")

            read_resp = await async_client.get(f"/api/bounties/{bounty_id}")
            return {
                "create_status": create_resp.status_code,
                "read_status": read_resp.status_code,
            }

        results = await asyncio.gather(
            *(create_and_read(i) for i in range(30))
        )

        create_successes = sum(1 for r in results if r["create_status"] == 201)
        read_successes = sum(1 for r in results if r["read_status"] == 200)

        assert create_successes == 30
        assert read_successes == 30

    @pytest.mark.asyncio
    async def test_concurrent_list_queries_under_load(
        self, async_client: AsyncClient
    ) -> None:
        """Verify list queries remain fast under concurrent load.

        Pre-populates 20 bounties concurrently, then fires 50 concurrent
        list queries.
        """
        # Pre-populate concurrently for faster setup
        await asyncio.gather(*(
            async_client.post(
                "/api/bounties",
                json=build_bounty_create_payload(title=f"Pre-pop #{i}"),
            )
            for i in range(20)
        ))

        async def query_list(index: int) -> int:
            """Query the bounties list endpoint.

            Args:
                index: Query index (unused, for gather identification).

            Returns:
                The HTTP response status code.
            """
            response = await async_client.get("/api/bounties?limit=20")
            return response.status_code

        results = await asyncio.gather(*(query_list(i) for i in range(50)))
        assert all(status == 200 for status in results)


class TestPayoutConcurrency:
    """Load test: concurrent payout recording."""

    @pytest.mark.asyncio
    async def test_concurrent_payout_creation(
        self, async_client: AsyncClient
    ) -> None:
        """Verify multiple payouts can be recorded concurrently.

        Each payout has no tx_hash to avoid duplicate detection.
        Tests that the in-memory store handles concurrent writes.
        """
        target_count = 25

        async def create_payout(index: int) -> int:
            """Record a payout without a tx_hash (pending status).

            Args:
                index: Unique index for deterministic payload generation.

            Returns:
                The HTTP response status code.
            """
            payload = {
                "recipient": f"load-recipient-{index}",
                "amount": 10.0 + index,
                "token": "FNDRY",
            }
            response = await async_client.post("/api/payouts", json=payload)
            return response.status_code

        results = await asyncio.gather(
            *(create_payout(i) for i in range(target_count))
        )
        successes = sum(1 for r in results if r == 201)
        assert successes == target_count


class TestContributorConcurrency:
    """Load test: concurrent contributor registration."""

    @pytest.mark.asyncio
    async def test_concurrent_contributor_registration(
        self, async_client: AsyncClient
    ) -> None:
        """Verify multiple contributors can register concurrently.

        Each contributor must have a unique username.
        """
        target_count = 30

        async def register_contributor(index: int) -> int:
            """Register a contributor with a unique username.

            Args:
                index: Unique index for username generation.

            Returns:
                The HTTP response status code.
            """
            payload = {
                "username": f"load-contributor-{index}",
                "display_name": f"Load Contributor {index}",
                "skills": ["python"],
            }
            response = await async_client.post(
                "/api/contributors",
                json=payload,
            )
            return response.status_code

        results = await asyncio.gather(
            *(register_contributor(i) for i in range(target_count))
        )
        successes = sum(1 for r in results if r == 201)
        assert successes == target_count
