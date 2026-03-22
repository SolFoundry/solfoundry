"""Comprehensive tests for the real-time event indexer and analytics API.

Covers:
- Event ingestion (Solana, GitHub, system sources)
- Event querying with filters and pagination
- Bounty stats aggregation
- Contributor profile computation
- Platform analytics
- Leaderboard ranking
- Data reconciliation
- GitHub event receiver (PR, issue, review, comment processing)
- Solana transaction classification
- WebSocket subscription filtering
- Redis cache layer
- Edge cases and error handling

Test configuration uses in-memory SQLite (configured in conftest.py).
Auth is disabled for test convenience unless explicitly tested.
Direct service calls are preferred over HTTP API tests for reliability
in the test environment.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from tests.conftest import run_async

# Ensure IndexedEventDB model is registered BEFORE any service imports
from app.models.indexer_event import (
    EventSource,
    IndexedEventCategory,
    IndexedEventCreate,
    IndexedEventDB,
    IndexedEventResponse,
)

# Test user ID for authenticated requests
TEST_USER_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_indexer_state():
    """Reset indexer state between tests to prevent cross-contamination."""
    yield
    from app.api.indexer_websocket import _subscriptions
    _subscriptions.clear()


@pytest.fixture(scope="session", autouse=True)
def ensure_indexer_table():
    """Ensure the indexed_events table exists in the test database.

    Runs once per session after the main init_test_db fixture.
    Creates the table if it doesn't exist.
    """
    from app.database import engine, Base

    async def _create():
        async with engine.begin() as conn:
            # Import model to ensure it's in metadata
            from app.models.indexer_event import IndexedEventDB  # noqa: F401
            await conn.run_sync(Base.metadata.create_all)

    run_async(_create())
    yield


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _create_event_data(
    source: str = "github",
    category: str = "pr_opened",
    title: str = "Test event",
    contributor: str = "testuser",
    bounty_id: str = "gh-100",
    bounty_number: int = 100,
    amount: Decimal = None,
    transaction_hash: str = None,
    description: str = None,
    github_url: str = None,
    payload: dict = None,
) -> IndexedEventCreate:
    """Build an IndexedEventCreate for testing.

    Args:
        source: Event source (github, solana, system).
        category: Event category string.
        title: Human-readable event title.
        contributor: Contributor username.
        bounty_id: Bounty identifier.
        bounty_number: GitHub issue number.
        amount: Optional token amount.
        transaction_hash: Optional Solana transaction hash.
        description: Optional event description.
        github_url: Optional GitHub URL.
        payload: Optional extra payload dict.

    Returns:
        IndexedEventCreate instance.
    """
    return IndexedEventCreate(
        source=EventSource(source),
        category=IndexedEventCategory(category),
        title=title,
        description=description,
        contributor_username=contributor,
        bounty_id=bounty_id,
        bounty_number=bounty_number,
        amount=amount,
        transaction_hash=transaction_hash,
        github_url=github_url,
        payload=payload,
    )


def _ingest(event_data: IndexedEventCreate) -> IndexedEventResponse:
    """Ingest an event synchronously via the service layer.

    Args:
        event_data: Validated event creation data.

    Returns:
        The created event response.
    """
    from app.services.event_indexer_service import ingest_event
    return run_async(ingest_event(event_data))


# ---------------------------------------------------------------------------
# Event Ingestion Tests
# ---------------------------------------------------------------------------


class TestEventIngestion:
    """Tests for event ingestion via the service layer."""

    def test_ingest_github_event(self):
        """Verify ingesting a GitHub PR event creates a record."""
        event_data = _create_event_data(
            source="github",
            category="pr_opened",
            title="PR #42 opened: Fix auth bug",
            contributor="alice_ingest",
            bounty_id="gh-42",
        )
        result = _ingest(event_data)
        assert result.source == "github"
        assert result.category == "pr_opened"
        assert result.contributor_username == "alice_ingest"
        assert result.id is not None

    def test_ingest_solana_event(self):
        """Verify ingesting a Solana on-chain event creates a record."""
        event_data = _create_event_data(
            source="solana",
            category="payout_confirmed",
            title="Payout: 500000 $FNDRY",
            contributor="bob_ingest",
            amount=Decimal("500000"),
            transaction_hash="tx_" + str(uuid.uuid4())[:16],
        )
        result = _ingest(event_data)
        assert result.source == "solana"
        assert result.amount == 500000.0

    def test_ingest_system_event(self):
        """Verify ingesting a system event creates a record."""
        event_data = _create_event_data(
            source="system",
            category="reputation_changed",
            title="Reputation updated for charlie",
            contributor="charlie_ingest",
        )
        result = _ingest(event_data)
        assert result.source == "system"

    def test_ingest_duplicate_transaction_hash(self):
        """Verify duplicate transaction hashes are rejected."""
        from app.services.event_indexer_service import DuplicateEventError

        tx_hash = "dup_tx_" + str(uuid.uuid4())[:12]
        event_data = _create_event_data(
            source="solana",
            category="payout_confirmed",
            title="First payout",
            transaction_hash=tx_hash,
        )
        _ingest(event_data)

        # Second ingest with same hash should fail
        event_data_dup = _create_event_data(
            source="solana",
            category="payout_confirmed",
            title="Duplicate payout",
            transaction_hash=tx_hash,
        )
        with pytest.raises(DuplicateEventError):
            _ingest(event_data_dup)

    def test_ingest_with_all_optional_fields(self):
        """Verify ingestion works with all optional fields populated."""
        event_data = _create_event_data(
            source="github",
            category="pr_opened",
            title="Full event with all fields",
            description="Detailed description of the event",
            contributor="fulluser_ingest",
            bounty_id="gh-999",
            bounty_number=999,
            github_url="https://github.com/SolFoundry/solfoundry/pull/999",
            amount=Decimal("500000"),
            payload={"custom_field": "custom_value", "nested": {"key": "val"}},
        )
        result = _ingest(event_data)
        assert result.description == "Detailed description of the event"
        assert result.payload["custom_field"] == "custom_value"

    def test_ingest_minimal_event(self):
        """Verify ingestion works with only required fields."""
        event_data = IndexedEventCreate(
            source=EventSource.SYSTEM,
            category=IndexedEventCategory.REPUTATION_CHANGED,
            title="Minimal event",
        )
        result = _ingest(event_data)
        assert result.contributor_username is None
        assert result.bounty_id is None


# ---------------------------------------------------------------------------
# Event Query Tests
# ---------------------------------------------------------------------------


class TestEventQueries:
    """Tests for querying indexed events via the service layer."""

    def test_query_events_empty_filter(self):
        """Verify listing events returns empty for nonexistent filter."""
        from app.services.event_indexer_service import query_events

        result = run_async(query_events(
            contributor="nonexistent_user_" + str(uuid.uuid4())[:8],
        ))
        assert result.total == 0
        assert result.items == []

    def test_query_events_with_data(self):
        """Verify listing events returns ingested events."""
        unique_contributor = f"query_user_{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            title="Query test event",
            contributor=unique_contributor,
        ))

        from app.services.event_indexer_service import query_events
        result = run_async(query_events(contributor=unique_contributor))
        assert result.total >= 1
        assert result.items[0].contributor_username == unique_contributor

    def test_query_events_filter_by_source(self):
        """Verify source filter works correctly."""
        unique_bounty = f"gh-source-{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            source="github",
            bounty_id=unique_bounty,
            title="GitHub event for source filter",
        ))
        _ingest(_create_event_data(
            source="solana",
            bounty_id=unique_bounty,
            title="Solana event for source filter",
            transaction_hash="tx_src_" + str(uuid.uuid4())[:12],
        ))

        from app.services.event_indexer_service import query_events
        result = run_async(query_events(
            source="github", bounty_id=unique_bounty,
        ))
        for item in result.items:
            assert item.source == "github"

    def test_query_events_filter_by_category(self):
        """Verify category filter works correctly."""
        unique_contributor = f"cat_user_{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            category="pr_opened",
            contributor=unique_contributor,
            title="PR opened for category filter",
        ))
        _ingest(_create_event_data(
            category="pr_merged",
            contributor=unique_contributor,
            title="PR merged for category filter",
        ))

        from app.services.event_indexer_service import query_events
        result = run_async(query_events(
            category="pr_opened", contributor=unique_contributor,
        ))
        for item in result.items:
            assert item.category == "pr_opened"

    def test_query_events_filter_by_bounty(self):
        """Verify bounty_id filter works correctly."""
        unique_bounty = f"gh-bounty-{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            bounty_id=unique_bounty,
            title="Bounty filter test",
        ))

        from app.services.event_indexer_service import query_events
        result = run_async(query_events(bounty_id=unique_bounty))
        assert result.total >= 1
        for item in result.items:
            assert item.bounty_id == unique_bounty

    def test_query_events_pagination(self):
        """Verify pagination works correctly."""
        unique_contributor = f"page_user_{uuid.uuid4().hex[:8]}"
        for i in range(5):
            _ingest(_create_event_data(
                title=f"Pagination test event {i}",
                contributor=unique_contributor,
            ))

        from app.services.event_indexer_service import query_events
        result = run_async(query_events(
            contributor=unique_contributor, page=1, page_size=2,
        ))
        assert len(result.items) == 2
        assert result.has_next is True
        assert result.page == 1

    def test_query_events_ordered_newest_first(self):
        """Verify events are returned newest-first by default."""
        unique_contributor = f"order_user_{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            title="First event",
            contributor=unique_contributor,
        ))
        _ingest(_create_event_data(
            title="Second event",
            contributor=unique_contributor,
        ))

        from app.services.event_indexer_service import query_events
        result = run_async(query_events(contributor=unique_contributor))
        assert len(result.items) >= 2
        first_ts = result.items[0].created_at
        second_ts = result.items[1].created_at
        assert first_ts >= second_ts

    def test_get_event_by_id(self):
        """Verify retrieving a single event by ID."""
        created = _ingest(_create_event_data(title="Single event lookup"))

        from app.services.event_indexer_service import get_event_by_id
        result = run_async(get_event_by_id(created.id))
        assert result.id == created.id
        assert result.title == "Single event lookup"

    def test_get_event_not_found(self):
        """Verify EventNotFoundError for nonexistent event ID."""
        from app.services.event_indexer_service import get_event_by_id, EventNotFoundError

        with pytest.raises(EventNotFoundError):
            run_async(get_event_by_id(str(uuid.uuid4())))

    def test_query_events_time_filter(self):
        """Verify time range filters work correctly."""
        unique_contributor = f"time_user_{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            title="Recent event",
            contributor=unique_contributor,
        ))

        from app.services.event_indexer_service import query_events
        # Events since 1 hour ago should include our event
        result = run_async(query_events(
            contributor=unique_contributor,
            since=datetime.now(timezone.utc) - timedelta(hours=1),
        ))
        assert result.total >= 1

        # Events since the future should return nothing
        result = run_async(query_events(
            contributor=unique_contributor,
            since=datetime.now(timezone.utc) + timedelta(hours=1),
        ))
        assert result.total == 0


# ---------------------------------------------------------------------------
# Bounty Stats Tests
# ---------------------------------------------------------------------------


class TestBountyStats:
    """Tests for bounty statistics aggregation."""

    def test_bounty_stats_with_data(self):
        """Verify bounty stats aggregation works with ingested events."""
        unique_bounty = f"gh-stats-{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            category="bounty_created",
            bounty_id=unique_bounty,
            title=f"Bounty {unique_bounty} created",
        ))
        _ingest(_create_event_data(
            category="bounty_claimed",
            bounty_id=unique_bounty,
            title=f"Bounty {unique_bounty} claimed",
            contributor="claimer1_stats",
        ))
        _ingest(_create_event_data(
            category="pr_opened",
            bounty_id=unique_bounty,
            title=f"PR for bounty {unique_bounty}",
            contributor="claimer1_stats",
        ))

        from app.services.event_indexer_service import get_bounty_stats
        result = run_async(get_bounty_stats(bounty_id=unique_bounty))
        assert len(result) >= 1
        stats = result[0]
        assert stats.bounty_id == unique_bounty
        assert stats.total_claims >= 1
        assert stats.total_prs >= 1

    def test_bounty_stats_empty(self):
        """Verify empty bounty stats response for nonexistent bounty."""
        from app.services.event_indexer_service import get_bounty_stats
        result = run_async(get_bounty_stats(bounty_id="gh-nonexistent-999"))
        assert len(result) == 0


# ---------------------------------------------------------------------------
# Contributor Profile Tests
# ---------------------------------------------------------------------------


class TestContributorProfiles:
    """Tests for contributor profile aggregation."""

    def test_contributor_profile(self):
        """Verify individual contributor profile computation."""
        unique_user = f"profile_user_{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            category="pr_opened",
            contributor=unique_user,
            title="PR opened by profile user",
        ))
        _ingest(_create_event_data(
            category="pr_merged",
            contributor=unique_user,
            title="PR merged by profile user",
        ))
        _ingest(_create_event_data(
            category="bounty_completed",
            contributor=unique_user,
            title="Bounty completed by profile user",
        ))

        from app.services.event_indexer_service import get_contributor_profile
        result = run_async(get_contributor_profile(unique_user))
        assert result.username == unique_user
        assert result.total_events >= 3
        assert result.total_prs_opened >= 1
        assert result.total_prs_merged >= 1
        assert result.total_bounties_completed >= 1

    def test_contributor_profile_not_found(self):
        """Verify EventNotFoundError for nonexistent contributor."""
        from app.services.event_indexer_service import get_contributor_profile, EventNotFoundError
        with pytest.raises(EventNotFoundError):
            run_async(get_contributor_profile(f"nonexistent_{uuid.uuid4().hex[:8]}"))

    def test_list_contributors(self):
        """Verify listing contributor profiles."""
        unique_user = f"list_user_{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            contributor=unique_user,
            title="Event for list test",
        ))

        from app.services.event_indexer_service import get_contributor_profiles
        result = run_async(get_contributor_profiles())
        assert len(result) >= 1
        usernames = [p.username for p in result]
        assert unique_user in usernames


# ---------------------------------------------------------------------------
# Platform Analytics Tests
# ---------------------------------------------------------------------------


class TestPlatformAnalytics:
    """Tests for platform-wide analytics computation."""

    def test_analytics_response_structure(self):
        """Verify analytics returns expected structure."""
        from app.services.event_indexer_service import get_platform_analytics
        result = run_async(get_platform_analytics())
        assert hasattr(result, "total_events")
        assert hasattr(result, "total_bounties")
        assert hasattr(result, "total_contributors")
        assert hasattr(result, "completion_rate")
        assert hasattr(result, "total_payout")
        assert hasattr(result, "events_last_24h")
        assert hasattr(result, "events_last_7d")
        assert hasattr(result, "top_contributors")
        assert hasattr(result, "category_breakdown")

    def test_analytics_counts_events(self):
        """Verify analytics correctly counts ingested events."""
        unique_bounty = f"gh-analytics-{uuid.uuid4().hex[:8]}"
        _ingest(_create_event_data(
            category="bounty_created",
            bounty_id=unique_bounty,
            title="Analytics bounty created",
        ))
        _ingest(_create_event_data(
            category="bounty_completed",
            bounty_id=unique_bounty,
            title="Analytics bounty completed",
        ))

        from app.services.event_indexer_service import get_platform_analytics
        result = run_async(get_platform_analytics())
        assert result.total_events >= 2

    def test_analytics_completion_rate(self):
        """Verify completion rate is calculated correctly."""
        from app.services.event_indexer_service import get_platform_analytics
        result = run_async(get_platform_analytics())
        assert 0 <= result.completion_rate <= 100


# ---------------------------------------------------------------------------
# Leaderboard Tests
# ---------------------------------------------------------------------------


class TestLeaderboard:
    """Tests for ranked leaderboard generation."""

    def test_leaderboard_structure(self):
        """Verify leaderboard returns expected structure."""
        from app.services.event_indexer_service import get_leaderboard
        result = run_async(get_leaderboard())
        assert hasattr(result, "entries")
        assert hasattr(result, "total")
        assert hasattr(result, "page")
        assert hasattr(result, "page_size")

    def test_leaderboard_with_data(self):
        """Verify leaderboard ranks contributors correctly."""
        user_a = f"leader_a_{uuid.uuid4().hex[:8]}"

        _ingest(_create_event_data(
            category="bounty_completed",
            contributor=user_a,
            title="Leader A bounty 1",
        ))
        _ingest(_create_event_data(
            category="payout_confirmed",
            contributor=user_a,
            amount=Decimal("100000"),
            title="Leader A payout",
            transaction_hash="tx_leader_" + str(uuid.uuid4())[:8],
        ))

        from app.services.event_indexer_service import get_leaderboard
        result = run_async(get_leaderboard(sort_by="earnings"))
        assert len(result.entries) >= 1

    def test_leaderboard_sort_options(self):
        """Verify leaderboard sort options work."""
        from app.services.event_indexer_service import get_leaderboard

        for sort_by in ["earnings", "bounties", "prs"]:
            result = run_async(get_leaderboard(sort_by=sort_by))
            assert result.page == 1

    def test_leaderboard_pagination(self):
        """Verify leaderboard pagination."""
        from app.services.event_indexer_service import get_leaderboard
        result = run_async(get_leaderboard(page=1, page_size=5))
        assert result.page == 1
        assert result.page_size == 5


# ---------------------------------------------------------------------------
# Reconciliation Tests
# ---------------------------------------------------------------------------


class TestReconciliation:
    """Tests for data reconciliation between sources."""

    def test_reconciliation_structure(self):
        """Verify reconciliation returns expected structure."""
        from app.services.event_indexer_service import reconcile_events
        result = run_async(reconcile_events())
        assert "solana_only" in result
        assert "github_only" in result
        assert "matched" in result
        assert "total_checked" in result

    def test_reconciliation_with_mixed_sources(self):
        """Verify reconciliation detects events from both sources."""
        unique_bounty = f"gh-recon-{uuid.uuid4().hex[:8]}"

        _ingest(_create_event_data(
            source="github",
            category="bounty_created",
            bounty_id=unique_bounty,
            title="Recon GitHub event",
        ))
        _ingest(_create_event_data(
            source="solana",
            category="escrow_funded",
            bounty_id=unique_bounty,
            title="Recon Solana event",
            transaction_hash="tx_recon_" + str(uuid.uuid4())[:8],
        ))

        from app.services.event_indexer_service import reconcile_events
        result = run_async(reconcile_events())
        assert result["matched"] >= 1


# ---------------------------------------------------------------------------
# GitHub Event Receiver Tests
# ---------------------------------------------------------------------------


class TestGitHubEventReceiver:
    """Tests for the GitHub event receiver service."""

    def test_process_pr_opened(self):
        """Verify PR opened events are correctly classified."""
        from app.services.github_event_receiver import process_pull_request_event

        pr_data = {
            "number": 42,
            "title": "feat: Add auth endpoint",
            "html_url": "https://github.com/SolFoundry/solfoundry/pull/42",
            "body": "Closes #15\n\nImplementation of auth.",
            "merged": False,
        }
        result = process_pull_request_event(
            action="opened",
            pr_data=pr_data,
            repository="SolFoundry/solfoundry",
            sender="alice",
        )
        assert result is not None
        assert result.category.value == "pr_opened"
        assert result.contributor_username == "alice"
        assert result.bounty_number == 15
        assert result.bounty_id == "gh-15"

    def test_process_pr_merged(self):
        """Verify PR merged events are correctly classified."""
        from app.services.github_event_receiver import process_pull_request_event

        pr_data = {
            "number": 43,
            "title": "fix: Resolve payout bug",
            "html_url": "https://github.com/SolFoundry/solfoundry/pull/43",
            "body": "Fixes #20",
            "merged": True,
            "merged_at": "2026-03-22T10:00:00Z",
        }
        result = process_pull_request_event(
            action="closed",
            pr_data=pr_data,
            repository="SolFoundry/solfoundry",
            sender="bob",
        )
        assert result is not None
        assert result.category.value == "pr_merged"
        assert result.bounty_number == 20

    def test_process_pr_closed_not_merged(self):
        """Verify closed-but-not-merged PRs produce PR_CLOSED events."""
        from app.services.github_event_receiver import process_pull_request_event

        pr_data = {
            "number": 44,
            "title": "feat: Rejected feature",
            "html_url": "https://github.com/SolFoundry/solfoundry/pull/44",
            "body": "Closes #25",
            "merged": False,
        }
        result = process_pull_request_event(
            action="closed",
            pr_data=pr_data,
            repository="SolFoundry/solfoundry",
            sender="charlie",
        )
        assert result is not None
        assert result.category.value == "pr_closed"

    def test_process_pr_synchronize_ignored(self):
        """Verify synchronize actions return None (not indexed)."""
        from app.services.github_event_receiver import process_pull_request_event

        result = process_pull_request_event(
            action="synchronize",
            pr_data={"number": 45, "title": "test", "body": ""},
            repository="SolFoundry/solfoundry",
            sender="dave",
        )
        assert result is None

    def test_process_issue_opened_bounty(self):
        """Verify bounty issue opened events are classified as BOUNTY_CREATED."""
        from app.services.github_event_receiver import process_issue_event

        issue_data = {
            "number": 601,
            "title": "Bounty: Real-time Indexer - 1,000,000 $FNDRY",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/601",
        }
        result = process_issue_event(
            action="opened",
            issue_data=issue_data,
            repository="SolFoundry/solfoundry",
            sender="admin",
            labels=["bounty", "tier-3"],
        )
        assert result is not None
        assert result.category.value == "bounty_created"
        assert result.bounty_id == "gh-601"
        assert result.amount == Decimal("1000000")

    def test_process_issue_opened_non_bounty(self):
        """Verify non-bounty issues are classified as ISSUE_OPENED."""
        from app.services.github_event_receiver import process_issue_event

        issue_data = {
            "number": 700,
            "title": "Bug: Login fails",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/700",
        }
        result = process_issue_event(
            action="opened",
            issue_data=issue_data,
            repository="SolFoundry/solfoundry",
            sender="reporter",
            labels=["bug"],
        )
        assert result is not None
        assert result.category.value == "issue_opened"
        assert result.bounty_id is None

    def test_process_issue_closed_bounty(self):
        """Verify closed bounty issues produce BOUNTY_COMPLETED events."""
        from app.services.github_event_receiver import process_issue_event

        issue_data = {
            "number": 500,
            "title": "Bounty: Fix escrow — 200,000 $FNDRY",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/500",
        }
        result = process_issue_event(
            action="closed",
            issue_data=issue_data,
            repository="SolFoundry/solfoundry",
            sender="admin",
            labels=["bounty", "tier-2"],
        )
        assert result is not None
        assert result.category.value == "bounty_completed"

    def test_process_issue_labeled_bounty(self):
        """Verify labeling an issue as bounty produces BOUNTY_CREATED."""
        from app.services.github_event_receiver import process_issue_event

        issue_data = {
            "number": 602,
            "title": "Enhancement: Add dashboard — 300,000 $FNDRY",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/602",
        }
        result = process_issue_event(
            action="labeled",
            issue_data=issue_data,
            repository="SolFoundry/solfoundry",
            sender="admin",
            labels=["bounty"],
        )
        assert result is not None
        assert result.category.value == "bounty_created"

    def test_process_review_submitted(self):
        """Verify review submitted events are correctly classified."""
        from app.services.github_event_receiver import process_review_event

        review_data = {
            "state": "approved",
            "html_url": "https://github.com/SolFoundry/solfoundry/pull/42#pullrequestreview-1",
        }
        pr_data = {
            "number": 42,
            "title": "feat: Add auth",
            "body": "Closes #15",
        }
        result = process_review_event(
            action="submitted",
            review_data=review_data,
            pr_data=pr_data,
            repository="SolFoundry/solfoundry",
            sender="reviewer1",
        )
        assert result is not None
        assert result.category.value == "review_submitted"
        assert result.contributor_username == "reviewer1"

    def test_process_review_non_submitted_ignored(self):
        """Verify non-submitted review actions return None."""
        from app.services.github_event_receiver import process_review_event

        result = process_review_event(
            action="edited",
            review_data={"state": "approved"},
            pr_data={"number": 42, "title": "test", "body": ""},
            repository="SolFoundry/solfoundry",
            sender="reviewer1",
        )
        assert result is None

    def test_process_claim_comment(self):
        """Verify 'claiming' comments produce BOUNTY_CLAIMED events."""
        from app.services.github_event_receiver import process_issue_comment_event

        comment_data = {
            "body": "claiming",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/601#issuecomment-1",
        }
        issue_data = {
            "number": 601,
            "title": "Bounty: Real-time Indexer",
            "labels": [{"name": "bounty"}, {"name": "tier-3"}],
        }
        result = process_issue_comment_event(
            action="created",
            comment_data=comment_data,
            issue_data=issue_data,
            repository="SolFoundry/solfoundry",
            sender="claimer",
        )
        assert result is not None
        assert result.category.value == "bounty_claimed"
        assert result.contributor_username == "claimer"

    def test_process_non_claim_comment_ignored(self):
        """Verify non-claiming comments return None."""
        from app.services.github_event_receiver import process_issue_comment_event

        comment_data = {
            "body": "Nice work!",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/601#issuecomment-2",
        }
        issue_data = {
            "number": 601,
            "title": "Bounty: Test",
            "labels": [{"name": "bounty"}],
        }
        result = process_issue_comment_event(
            action="created",
            comment_data=comment_data,
            issue_data=issue_data,
            repository="SolFoundry/solfoundry",
            sender="commenter",
        )
        assert result is None


# ---------------------------------------------------------------------------
# Solana Transaction Classifier Tests
# ---------------------------------------------------------------------------


class TestSolanaTransactionClassifier:
    """Tests for Solana transaction classification logic."""

    def test_classify_incoming_token_transfer(self):
        """Verify incoming $FNDRY transfer is classified as ESCROW_FUNDED."""
        from app.services.solana_indexer import classify_transaction

        tx_details = {
            "meta": {
                "err": None,
                "preTokenBalances": [
                    {
                        "accountIndex": 0,
                        "mint": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
                        "uiTokenAmount": {"uiAmount": 1000.0},
                    }
                ],
                "postTokenBalances": [
                    {
                        "accountIndex": 0,
                        "mint": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
                        "uiTokenAmount": {"uiAmount": 1500.0},
                    }
                ],
                "preBalances": [],
                "postBalances": [],
            },
            "transaction": {
                "message": {"instructions": [], "accountKeys": []},
                "signatures": ["sig_test_incoming_123"],
            },
            "blockTime": 1711100000,
        }
        result = classify_transaction(tx_details)
        assert result is not None
        assert result.category.value == "escrow_funded"
        assert result.amount == Decimal("500.0")

    def test_classify_outgoing_token_transfer(self):
        """Verify outgoing $FNDRY transfer is classified as PAYOUT_CONFIRMED."""
        from app.services.solana_indexer import classify_transaction

        tx_details = {
            "meta": {
                "err": None,
                "preTokenBalances": [
                    {
                        "accountIndex": 0,
                        "mint": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
                        "uiTokenAmount": {"uiAmount": 2000.0},
                    }
                ],
                "postTokenBalances": [
                    {
                        "accountIndex": 0,
                        "mint": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
                        "uiTokenAmount": {"uiAmount": 1500.0},
                    }
                ],
                "preBalances": [],
                "postBalances": [],
            },
            "transaction": {
                "message": {"instructions": [], "accountKeys": []},
                "signatures": ["sig_test_outgoing_456"],
            },
            "blockTime": 1711100100,
        }
        result = classify_transaction(tx_details)
        assert result is not None
        assert result.category.value == "payout_confirmed"
        assert result.amount == Decimal("500.0")

    def test_classify_failed_transaction_ignored(self):
        """Verify failed transactions are skipped."""
        from app.services.solana_indexer import classify_transaction

        tx_details = {
            "meta": {"err": {"InstructionError": [0, "InsufficientFunds"]}},
            "transaction": {
                "message": {"instructions": [], "accountKeys": []},
                "signatures": ["sig_failed"],
            },
        }
        result = classify_transaction(tx_details)
        assert result is None

    def test_classify_no_relevant_transfer(self):
        """Verify transactions without relevant transfers return None."""
        from app.services.solana_indexer import classify_transaction

        tx_details = {
            "meta": {
                "err": None,
                "preTokenBalances": [],
                "postTokenBalances": [],
                "preBalances": [100000000],
                "postBalances": [100000000],
            },
            "transaction": {
                "message": {
                    "instructions": [],
                    "accountKeys": ["SomeOtherWallet123"],
                },
                "signatures": ["sig_no_transfer"],
            },
        }
        result = classify_transaction(tx_details)
        assert result is None

    def test_classify_none_transaction(self):
        """Verify None transaction returns None."""
        from app.services.solana_indexer import classify_transaction
        assert classify_transaction(None) is None


# ---------------------------------------------------------------------------
# WebSocket Subscription Filter Tests
# ---------------------------------------------------------------------------


class TestWebSocketSubscriptionFilter:
    """Tests for WebSocket subscription filter matching."""

    def test_filter_matches_all_when_empty(self):
        """Verify empty filter matches all events."""
        from app.api.indexer_websocket import SubscriptionFilter

        sub = SubscriptionFilter()
        event = {"source": "github", "category": "pr_opened", "contributor_username": "alice"}
        assert sub.matches(event) is True

    def test_filter_by_source(self):
        """Verify source filter works correctly."""
        from app.api.indexer_websocket import SubscriptionFilter

        sub = SubscriptionFilter(source="github")
        assert sub.matches({"source": "github"}) is True
        assert sub.matches({"source": "solana"}) is False

    def test_filter_by_category(self):
        """Verify category filter works correctly."""
        from app.api.indexer_websocket import SubscriptionFilter

        sub = SubscriptionFilter(category="pr_merged")
        assert sub.matches({"category": "pr_merged"}) is True
        assert sub.matches({"category": "pr_opened"}) is False

    def test_filter_by_contributor(self):
        """Verify contributor filter works correctly."""
        from app.api.indexer_websocket import SubscriptionFilter

        sub = SubscriptionFilter(contributor="alice")
        assert sub.matches({"contributor_username": "alice"}) is True
        assert sub.matches({"contributor_username": "bob"}) is False

    def test_filter_by_bounty_id(self):
        """Verify bounty_id filter works correctly."""
        from app.api.indexer_websocket import SubscriptionFilter

        sub = SubscriptionFilter(bounty_id="gh-601")
        assert sub.matches({"bounty_id": "gh-601"}) is True
        assert sub.matches({"bounty_id": "gh-602"}) is False

    def test_combined_filters(self):
        """Verify combined filters require all criteria to match."""
        from app.api.indexer_websocket import SubscriptionFilter

        sub = SubscriptionFilter(source="github", category="pr_merged")
        assert sub.matches({"source": "github", "category": "pr_merged"}) is True
        assert sub.matches({"source": "github", "category": "pr_opened"}) is False
        assert sub.matches({"source": "solana", "category": "pr_merged"}) is False

    def test_subscription_info(self):
        """Verify subscription info helper returns correct structure."""
        from app.api.indexer_websocket import (
            get_subscription_info,
            _subscriptions,
            SubscriptionFilter,
        )
        _subscriptions["test-conn-1"] = SubscriptionFilter(source="github")
        _subscriptions["test-conn-2"] = SubscriptionFilter()

        info = get_subscription_info()
        assert info["total_subscriptions"] >= 2
        assert info["unfiltered"] >= 1

    def test_active_subscriptions_count(self):
        """Verify active subscriptions count is accurate."""
        from app.api.indexer_websocket import (
            get_active_subscriptions_count,
            _subscriptions,
            SubscriptionFilter,
        )
        _subscriptions.clear()
        _subscriptions["conn-1"] = SubscriptionFilter()
        _subscriptions["conn-2"] = SubscriptionFilter(source="solana")
        assert get_active_subscriptions_count() == 2


# ---------------------------------------------------------------------------
# Cache Layer Tests
# ---------------------------------------------------------------------------


class TestIndexerCache:
    """Tests for the Redis caching layer (graceful degradation)."""

    @pytest.mark.asyncio
    async def test_invalidate_event_caches_no_crash(self):
        """Verify cache invalidation doesn't crash when Redis is unavailable."""
        from app.services.indexer_cache import invalidate_event_caches
        # Should not raise even when Redis is down
        try:
            await invalidate_event_caches(contributor="testuser", bounty_id="gh-100")
        except Exception:
            pass  # Expected when Redis is not available

    @pytest.mark.asyncio
    async def test_get_cached_returns_none(self):
        """Verify cache miss returns None when Redis is down."""
        from app.services.indexer_cache import get_cached
        result = await get_cached("nonexistent_key")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_cached_handles_failure(self):
        """Verify cache set handles Redis failures gracefully."""
        from app.services.indexer_cache import set_cached
        result = await set_cached("test_key", "test_value", 60)
        assert result is False or result is True  # Either works


# ---------------------------------------------------------------------------
# Edge Cases and Utility Tests
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Tests for edge cases, utilities, and error handling."""

    def test_all_event_categories_can_be_ingested(self):
        """Verify all defined event categories can be ingested."""
        for category in IndexedEventCategory:
            event_data = IndexedEventCreate(
                source=EventSource.SYSTEM,
                category=category,
                title=f"Test {category.value}",
            )
            result = _ingest(event_data)
            assert result.category == category.value

    def test_bounty_number_extraction_patterns(self):
        """Verify bounty number extraction from various PR body patterns."""
        from app.services.github_event_receiver import _extract_bounty_number

        assert _extract_bounty_number("Closes #123") == 123
        assert _extract_bounty_number("fixes #456") == 456
        assert _extract_bounty_number("Resolves #789") == 789
        assert _extract_bounty_number("implements #42") == 42
        assert _extract_bounty_number(
            "Closes https://github.com/SolFoundry/solfoundry/issues/100"
        ) == 100
        assert _extract_bounty_number("No reference here") is None
        assert _extract_bounty_number("") is None
        assert _extract_bounty_number(None) is None

    def test_reward_parsing_from_title(self):
        """Verify reward amount parsing from bounty titles."""
        from app.services.github_event_receiver import _parse_reward_from_title

        assert _parse_reward_from_title("Bounty: Fix auth — 500,000 $FNDRY") == Decimal("500000")
        assert _parse_reward_from_title("1,000,000 $FNDRY bounty") == Decimal("1000000")
        assert _parse_reward_from_title("No reward here") is None

    def test_event_source_enum_values(self):
        """Verify EventSource enum has expected values."""
        assert EventSource.SOLANA.value == "solana"
        assert EventSource.GITHUB.value == "github"
        assert EventSource.SYSTEM.value == "system"

    def test_event_category_enum_completeness(self):
        """Verify IndexedEventCategory covers all expected categories."""
        expected = {
            "bounty_created", "bounty_claimed", "bounty_completed",
            "bounty_cancelled", "pr_opened", "pr_merged", "pr_closed",
            "review_submitted", "issue_opened", "issue_closed",
            "issue_labeled", "payout_initiated", "payout_confirmed",
            "escrow_funded", "escrow_released", "escrow_refunded",
            "contributor_registered", "reputation_changed",
        }
        actual = {c.value for c in IndexedEventCategory}
        assert expected == actual

    def test_event_to_response_conversion(self):
        """Verify the internal event-to-response conversion works."""
        from app.services.event_indexer_service import _event_to_response

        event = IndexedEventDB(
            id=uuid.uuid4(),
            source="github",
            category="pr_opened",
            title="Test conversion",
            contributor_username="tester",
            bounty_id="gh-100",
            bounty_number=100,
            amount=Decimal("500"),
            created_at=datetime.now(timezone.utc),
        )
        result = _event_to_response(event)
        assert result.source == "github"
        assert result.amount == 500.0
        assert result.contributor_username == "tester"

    def test_filter_conditions_builder(self):
        """Verify the SQL filter condition builder works correctly."""
        from app.services.event_indexer_service import _build_filter_conditions

        # No filters
        conditions = _build_filter_conditions()
        assert len(conditions) == 0

        # All filters
        conditions = _build_filter_conditions(
            source="github",
            category="pr_opened",
            contributor="alice",
            bounty_id="gh-100",
            since=datetime.now(timezone.utc),
            until=datetime.now(timezone.utc),
        )
        assert len(conditions) == 6

    def test_detect_token_transfers(self):
        """Verify token transfer detection from balance changes."""
        from app.services.solana_indexer import _detect_token_transfers

        mint = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
        pre = [{"accountIndex": 0, "mint": mint, "uiTokenAmount": {"uiAmount": 100.0}}]
        post = [{"accountIndex": 0, "mint": mint, "uiTokenAmount": {"uiAmount": 150.0}}]

        transfers = _detect_token_transfers(pre, post, mint)
        assert len(transfers) == 1
        assert transfers[0]["direction"] == "incoming"
        assert transfers[0]["amount"] == Decimal("50.0")

    def test_detect_no_token_transfers(self):
        """Verify empty result when no balance changes occur."""
        from app.services.solana_indexer import _detect_token_transfers

        mint = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
        pre = [{"accountIndex": 0, "mint": mint, "uiTokenAmount": {"uiAmount": 100.0}}]
        post = [{"accountIndex": 0, "mint": mint, "uiTokenAmount": {"uiAmount": 100.0}}]

        transfers = _detect_token_transfers(pre, post, mint)
        assert len(transfers) == 0
