"""Comprehensive tests for anti-gaming / sybil protection (Issue #504).

Covers every detection heuristic, the aggregate evaluation engine,
audit log persistence, admin alert management, user appeals,
configuration endpoint, and API integration via TestClient.

All tests use an in-memory SQLite database for isolation and run
the async sybil service functions through the synchronous TestClient
or the shared test event loop.
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db, init_db, async_session_factory
from app.models.sybil import (
    AlertSeverity,
    AlertStatus,
    AppealStatus,
    SybilAlertDB,
    SybilAppealDB,
    SybilAuditLogDB,
    SybilCheckType,
    SybilDecision,
)
from app.services import sybil_service
from app.api.sybil import router as sybil_router


# ---------------------------------------------------------------------------
# Auth mock
# ---------------------------------------------------------------------------

MOCK_USER_ID = "test-user-sybil-001"
MOCK_ADMIN_ID = "test-admin-sybil-001"


async def override_get_current_user_id():
    """Return a mock user ID for test authentication."""
    return MOCK_USER_ID


async def override_get_admin_user_id():
    """Return a mock admin user ID for test authentication."""
    return MOCK_ADMIN_ID


# ---------------------------------------------------------------------------
# Test app & client setup
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(sybil_router, prefix="/api")
_test_app.dependency_overrides[get_current_user_id] = override_get_current_user_id


@_test_app.get("/health")
async def health_check():
    """Simple health check for test sanity."""
    return {"status": "ok"}


client = TestClient(_test_app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def event_loop():
    """Create a dedicated event loop for module-scoped async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def _init_db(event_loop):
    """Initialize the database schema once per module."""
    event_loop.run_until_complete(init_db())


@pytest.fixture()
def run_async(event_loop):
    """Provide a helper to run async coroutines synchronously in tests."""
    def _run(coro):
        return event_loop.run_until_complete(coro)
    return _run


@pytest.fixture()
def db_session(run_async):
    """Provide a database session for direct service-layer tests."""
    session = run_async(async_session_factory().__aenter__())
    yield session, run_async
    run_async(session.rollback())
    run_async(session.__aexit__(None, None, None))


# ---------------------------------------------------------------------------
# 1. GitHub account age check tests
# ---------------------------------------------------------------------------


class TestGitHubAccountAge:
    """Tests for the GitHub account age detection heuristic."""

    def test_old_account_passes(self, db_session):
        """Accounts older than threshold should be allowed."""
        session, run = db_session
        created_at = datetime.now(timezone.utc) - timedelta(days=60)
        result = run(sybil_service.check_github_account_age(
            session, "user-age-old", created_at, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW
        assert result.check_type == SybilCheckType.GITHUB_ACCOUNT_AGE

    def test_new_account_blocked(self, db_session):
        """Accounts younger than threshold should be blocked."""
        session, run = db_session
        created_at = datetime.now(timezone.utc) - timedelta(days=10)
        result = run(sybil_service.check_github_account_age(
            session, "user-age-new", created_at, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.BLOCK
        assert "10 days old" in result.reason

    def test_missing_creation_date_blocked(self, db_session):
        """Missing creation date should default to block."""
        session, run = db_session
        result = run(sybil_service.check_github_account_age(
            session, "user-age-none", None, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.BLOCK
        assert "unavailable" in result.reason

    def test_exact_threshold_passes(self, db_session):
        """Account exactly at the threshold age should pass."""
        session, run = db_session
        created_at = datetime.now(timezone.utc) - timedelta(days=30)
        result = run(sybil_service.check_github_account_age(
            session, "user-age-exact", created_at, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW


# ---------------------------------------------------------------------------
# 2. GitHub activity check tests
# ---------------------------------------------------------------------------


class TestGitHubActivity:
    """Tests for the GitHub activity detection heuristic."""

    def test_active_account_passes(self, db_session):
        """Accounts with sufficient repos and commits should pass."""
        session, run = db_session
        result = run(sybil_service.check_github_activity(
            session, "user-active", 10, 50, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_low_repos_flagged(self, db_session):
        """Accounts with too few repos should be flagged."""
        session, run = db_session
        result = run(sybil_service.check_github_activity(
            session, "user-low-repos", 1, 50, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.FLAG
        assert "repos=1" in result.reason

    def test_low_commits_flagged(self, db_session):
        """Accounts with too few commits should be flagged."""
        session, run = db_session
        result = run(sybil_service.check_github_activity(
            session, "user-low-commits", 5, 2, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.FLAG
        assert "commits=2" in result.reason

    def test_both_low_flagged(self, db_session):
        """Accounts failing both repos and commits should be flagged."""
        session, run = db_session
        result = run(sybil_service.check_github_activity(
            session, "user-both-low", 0, 0, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.FLAG
        assert "repos=0" in result.reason
        assert "commits=0" in result.reason

    def test_exact_threshold_passes(self, db_session):
        """Accounts exactly at the minimum should pass."""
        session, run = db_session
        min_repos = sybil_service.GITHUB_MIN_PUBLIC_REPOS
        min_commits = sybil_service.GITHUB_MIN_TOTAL_COMMITS
        result = run(sybil_service.check_github_activity(
            session, "user-exact-activity", min_repos, min_commits, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW


# ---------------------------------------------------------------------------
# 3. Wallet clustering tests
# ---------------------------------------------------------------------------


class TestWalletClustering:
    """Tests for the wallet clustering detection heuristic."""

    def test_unique_funding_source_passes(self, db_session):
        """Wallet with unique funding source should pass."""
        session, run = db_session
        result = run(sybil_service.check_wallet_clustering(
            session, "user-wallet-ok", "wallet-A",
            funding_source="source-unique",
            known_funding_sources={"source-unique": ["wallet-A"]},
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_clustered_wallets_flagged(self, db_session):
        """Wallets sharing a funding source above threshold should be flagged."""
        session, run = db_session
        threshold = sybil_service.WALLET_CLUSTER_THRESHOLD
        wallets = [f"wallet-{i}" for i in range(threshold)]
        result = run(sybil_service.check_wallet_clustering(
            session, "user-wallet-cluster", f"wallet-{threshold}",
            funding_source="source-shared",
            known_funding_sources={"source-shared": wallets},
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.FLAG
        assert "clustering detected" in result.reason

    def test_no_funding_source_skipped(self, db_session):
        """Missing funding source data should skip the check (allow)."""
        session, run = db_session
        result = run(sybil_service.check_wallet_clustering(
            session, "user-wallet-none", "wallet-B",
            funding_source=None,
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW
        assert "skipping" in result.reason.lower()

    def test_below_threshold_passes(self, db_session):
        """Cluster size below threshold should pass."""
        session, run = db_session
        result = run(sybil_service.check_wallet_clustering(
            session, "user-wallet-small", "wallet-C",
            funding_source="source-small",
            known_funding_sources={"source-small": ["wallet-C"]},
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW


# ---------------------------------------------------------------------------
# 4. Claim rate limit tests
# ---------------------------------------------------------------------------


class TestClaimRateLimit:
    """Tests for the bounty claim rate limiting heuristic."""

    def test_below_limit_passes(self, db_session):
        """Users with fewer active claims than the limit should pass."""
        session, run = db_session
        result = run(sybil_service.check_claim_rate_limit(
            session, "user-claim-ok", 1, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_at_limit_blocked(self, db_session):
        """Users at the claim limit should be blocked from claiming more."""
        session, run = db_session
        max_claims = sybil_service.MAX_ACTIVE_CLAIMS_PER_USER
        result = run(sybil_service.check_claim_rate_limit(
            session, "user-claim-max", max_claims, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.BLOCK
        assert "exceeded" in result.reason.lower()

    def test_above_limit_blocked(self, db_session):
        """Users above the claim limit should definitely be blocked."""
        session, run = db_session
        result = run(sybil_service.check_claim_rate_limit(
            session, "user-claim-over", 10, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.BLOCK

    def test_zero_claims_passes(self, db_session):
        """Users with zero active claims should always pass."""
        session, run = db_session
        result = run(sybil_service.check_claim_rate_limit(
            session, "user-claim-zero", 0, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW


# ---------------------------------------------------------------------------
# 5. T1 cooldown tests
# ---------------------------------------------------------------------------


class TestT1Cooldown:
    """Tests for the T1 bounty completion cooldown heuristic."""

    def test_no_previous_completion_passes(self, db_session):
        """Users with no T1 history should pass the cooldown check."""
        session, run = db_session
        result = run(sybil_service.check_t1_cooldown(
            session, "user-t1-none", None, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_cooldown_elapsed_passes(self, db_session):
        """Users whose cooldown has expired should pass."""
        session, run = db_session
        old_completion = datetime.now(timezone.utc) - timedelta(hours=48)
        result = run(sybil_service.check_t1_cooldown(
            session, "user-t1-old", old_completion, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_cooldown_active_blocked(self, db_session):
        """Users within the cooldown window should be blocked."""
        session, run = db_session
        recent_completion = datetime.now(timezone.utc) - timedelta(hours=2)
        result = run(sybil_service.check_t1_cooldown(
            session, "user-t1-recent", recent_completion, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.BLOCK
        assert "remaining" in result.reason.lower()

    def test_cooldown_exactly_at_boundary(self, db_session):
        """Users exactly at the cooldown boundary should pass."""
        session, run = db_session
        cooldown_hours = sybil_service.T1_COOLDOWN_HOURS
        boundary_completion = datetime.now(timezone.utc) - timedelta(
            hours=cooldown_hours
        )
        result = run(sybil_service.check_t1_cooldown(
            session, "user-t1-boundary", boundary_completion, "127.0.0.1",
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW


# ---------------------------------------------------------------------------
# 6. IP heuristic tests
# ---------------------------------------------------------------------------


class TestIPHeuristic:
    """Tests for the IP-based multi-account detection heuristic."""

    def test_single_account_passes(self, db_session):
        """A single account from an IP should pass."""
        session, run = db_session
        result = run(sybil_service.check_ip_heuristic(
            session, "user-ip-single", "10.0.0.1", 1,
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_multiple_accounts_flagged(self, db_session):
        """Exceeding the IP account threshold should flag (not block)."""
        session, run = db_session
        threshold = sybil_service.IP_MAX_ACCOUNTS
        result = run(sybil_service.check_ip_heuristic(
            session, "user-ip-multi", "10.0.0.2", threshold + 1,
        ))
        run(session.commit())

        assert result.passed is False
        assert result.decision == SybilDecision.FLAG
        assert "multiple accounts" in result.reason.lower()

    def test_at_threshold_passes(self, db_session):
        """Accounts exactly at the threshold should pass."""
        session, run = db_session
        threshold = sybil_service.IP_MAX_ACCOUNTS
        result = run(sybil_service.check_ip_heuristic(
            session, "user-ip-threshold", "10.0.0.3", threshold,
        ))
        run(session.commit())

        assert result.passed is True
        assert result.decision == SybilDecision.ALLOW

    def test_ip_heuristic_never_blocks(self, db_session):
        """IP checks should only flag, never block, even with many accounts."""
        session, run = db_session
        result = run(sybil_service.check_ip_heuristic(
            session, "user-ip-many", "10.0.0.4", 100,
        ))
        run(session.commit())

        assert result.decision == SybilDecision.FLAG
        assert result.decision != SybilDecision.BLOCK


# ---------------------------------------------------------------------------
# 7. Aggregate evaluation tests
# ---------------------------------------------------------------------------


class TestAggregateEvaluation:
    """Tests for the full user evaluation engine."""

    def test_clean_user_allowed(self, db_session):
        """A user passing all checks should get an ALLOW decision."""
        session, run = db_session
        result = run(sybil_service.evaluate_user(
            session,
            user_id="user-eval-clean",
            github_created_at=datetime.now(timezone.utc) - timedelta(days=365),
            public_repos=20,
            total_commits=500,
            wallet_address="clean-wallet-addr",
            funding_source=None,
            active_claims_count=0,
            last_t1_completion=None,
            ip_address="192.168.1.1",
            accounts_from_ip=1,
        ))
        run(session.commit())

        assert result.overall_decision == SybilDecision.ALLOW
        assert result.flagged_checks == 0
        assert len(result.checks) >= 5

    def test_blocked_user_gets_block(self, db_session):
        """A user failing a hard check should get a BLOCK decision."""
        session, run = db_session
        result = run(sybil_service.evaluate_user(
            session,
            user_id="user-eval-blocked",
            github_created_at=datetime.now(timezone.utc) - timedelta(days=5),
            public_repos=0,
            total_commits=0,
            active_claims_count=10,
            ip_address="192.168.1.2",
            accounts_from_ip=1,
        ))
        run(session.commit())

        assert result.overall_decision == SybilDecision.BLOCK
        assert result.flagged_checks > 0

    def test_flagged_user_gets_flag(self, db_session):
        """A user failing only soft checks should get a FLAG decision."""
        session, run = db_session
        result = run(sybil_service.evaluate_user(
            session,
            user_id="user-eval-flagged",
            github_created_at=datetime.now(timezone.utc) - timedelta(days=365),
            public_repos=1,
            total_commits=1,
            active_claims_count=0,
            ip_address="192.168.1.3",
            accounts_from_ip=10,
        ))
        run(session.commit())

        assert result.overall_decision == SybilDecision.FLAG
        assert result.flagged_checks > 0

    def test_evaluation_returns_all_check_types(self, db_session):
        """Evaluation should include results from all configured checks."""
        session, run = db_session
        result = run(sybil_service.evaluate_user(
            session,
            user_id="user-eval-all-checks",
            github_created_at=datetime.now(timezone.utc) - timedelta(days=60),
            public_repos=10,
            total_commits=50,
            wallet_address="test-wallet-all",
            funding_source="test-source-all",
            known_funding_sources={"test-source-all": ["test-wallet-all"]},
            active_claims_count=0,
            last_t1_completion=None,
            ip_address="192.168.1.4",
            accounts_from_ip=1,
        ))
        run(session.commit())

        check_types = {check.check_type for check in result.checks}
        assert SybilCheckType.GITHUB_ACCOUNT_AGE in check_types
        assert SybilCheckType.GITHUB_ACTIVITY in check_types
        assert SybilCheckType.WALLET_CLUSTERING in check_types
        assert SybilCheckType.CLAIM_RATE_LIMIT in check_types
        assert SybilCheckType.T1_COOLDOWN in check_types
        assert SybilCheckType.IP_HEURISTIC in check_types


# ---------------------------------------------------------------------------
# 8. Audit log persistence tests
# ---------------------------------------------------------------------------


class TestAuditLogPersistence:
    """Tests for sybil audit log database operations."""

    def test_check_creates_audit_record(self, db_session):
        """Every check should persist an audit log entry."""
        session, run = db_session
        user_id = f"audit-test-{uuid.uuid4().hex[:8]}"
        run(sybil_service.check_github_account_age(
            session, user_id,
            datetime.now(timezone.utc) - timedelta(days=60),
            "127.0.0.1",
        ))
        run(session.commit())

        logs = run(sybil_service.get_audit_logs(session, user_id=user_id))
        assert logs["total"] >= 1
        assert logs["items"][0].user_id == user_id
        assert logs["items"][0].check_type == SybilCheckType.GITHUB_ACCOUNT_AGE.value

    def test_audit_log_pagination(self, db_session):
        """Audit log queries should support pagination correctly."""
        session, run = db_session
        user_id = f"audit-page-{uuid.uuid4().hex[:8]}"

        # Create multiple audit entries
        for i in range(5):
            run(sybil_service.check_claim_rate_limit(
                session, user_id, i, "127.0.0.1",
            ))
        run(session.commit())

        # Page 1
        page1 = run(sybil_service.get_audit_logs(
            session, user_id=user_id, page=1, per_page=2,
        ))
        assert len(page1["items"]) == 2
        assert page1["total"] >= 5

        # Page 2
        page2 = run(sybil_service.get_audit_logs(
            session, user_id=user_id, page=2, per_page=2,
        ))
        assert len(page2["items"]) == 2

    def test_audit_log_filter_by_decision(self, db_session):
        """Audit logs should be filterable by decision outcome."""
        session, run = db_session
        user_id = f"audit-filter-{uuid.uuid4().hex[:8]}"

        # Create ALLOW and BLOCK entries
        run(sybil_service.check_claim_rate_limit(
            session, user_id, 0, "127.0.0.1",
        ))  # ALLOW
        run(sybil_service.check_claim_rate_limit(
            session, user_id, 10, "127.0.0.1",
        ))  # BLOCK
        run(session.commit())

        blocks = run(sybil_service.get_audit_logs(
            session, user_id=user_id, decision="block",
        ))
        assert blocks["total"] >= 1
        for item in blocks["items"]:
            assert item.decision == "block"


# ---------------------------------------------------------------------------
# 9. Alert management tests
# ---------------------------------------------------------------------------


class TestAlertManagement:
    """Tests for sybil admin alert creation and resolution."""

    def test_flag_creates_alert(self, db_session):
        """Flagged checks should create admin alerts."""
        session, run = db_session
        user_id = f"alert-test-{uuid.uuid4().hex[:8]}"

        # Trigger a flag (low activity)
        run(sybil_service.check_github_activity(
            session, user_id, 0, 0, "127.0.0.1",
        ))
        run(session.commit())

        alerts = run(sybil_service.get_alerts(session, user_id=user_id))
        assert alerts["total"] >= 1
        assert alerts["items"][0].severity == "low"

    def test_resolve_alert(self, db_session):
        """Admins should be able to resolve open alerts."""
        session, run = db_session
        user_id = f"alert-resolve-{uuid.uuid4().hex[:8]}"

        # Create an alert via a flagged check
        run(sybil_service.check_ip_heuristic(
            session, user_id, "10.10.10.1", 10,
        ))
        run(session.commit())

        alerts = run(sybil_service.get_alerts(session, user_id=user_id))
        alert_id = alerts["items"][0].id

        resolved = run(sybil_service.resolve_alert(
            session, alert_id, MOCK_ADMIN_ID,
            AlertStatus.RESOLVED, "Verified legitimate office IP",
        ))
        run(session.commit())

        assert resolved.status == "resolved"
        assert resolved.resolved_by == MOCK_ADMIN_ID
        assert resolved.resolution_notes == "Verified legitimate office IP"

    def test_cannot_re_resolve_alert(self, db_session):
        """Already resolved alerts should not be modifiable."""
        session, run = db_session
        user_id = f"alert-re-resolve-{uuid.uuid4().hex[:8]}"

        run(sybil_service.check_ip_heuristic(
            session, user_id, "10.10.10.2", 10,
        ))
        run(session.commit())

        alerts = run(sybil_service.get_alerts(session, user_id=user_id))
        alert_id = alerts["items"][0].id

        run(sybil_service.resolve_alert(
            session, alert_id, MOCK_ADMIN_ID, AlertStatus.RESOLVED,
        ))
        run(session.commit())

        with pytest.raises(ValueError, match="already resolved"):
            run(sybil_service.resolve_alert(
                session, alert_id, MOCK_ADMIN_ID, AlertStatus.DISMISSED,
            ))

    def test_alert_filter_by_severity(self, db_session):
        """Alerts should be filterable by severity level."""
        session, run = db_session
        user_id = f"alert-severity-{uuid.uuid4().hex[:8]}"

        # Create a high-severity alert via wallet clustering
        threshold = sybil_service.WALLET_CLUSTER_THRESHOLD
        wallets = [f"w-{i}" for i in range(threshold)]
        run(sybil_service.check_wallet_clustering(
            session, user_id, f"w-{threshold}",
            funding_source="source-cluster",
            known_funding_sources={"source-cluster": wallets},
        ))
        run(session.commit())

        high_alerts = run(sybil_service.get_alerts(
            session, severity="high", user_id=user_id,
        ))
        assert high_alerts["total"] >= 1


# ---------------------------------------------------------------------------
# 10. Appeal management tests
# ---------------------------------------------------------------------------


class TestAppealManagement:
    """Tests for the false-positive appeal system."""

    def test_create_appeal(self, db_session):
        """Users should be able to submit appeals."""
        session, run = db_session
        user_id = f"appeal-create-{uuid.uuid4().hex[:8]}"

        appeal = run(sybil_service.create_appeal(
            session, user_id,
            reason="My GitHub account is new but I am a professional developer",
            evidence="https://linkedin.com/in/myprofile",
        ))
        run(session.commit())

        assert appeal.user_id == user_id
        assert appeal.status == "pending"
        assert "professional developer" in appeal.reason

    def test_duplicate_pending_appeal_rejected(self, db_session):
        """Users should not be able to submit multiple pending appeals."""
        session, run = db_session
        user_id = f"appeal-dupe-{uuid.uuid4().hex[:8]}"

        run(sybil_service.create_appeal(
            session, user_id, reason="First appeal attempt",
        ))
        run(session.commit())

        with pytest.raises(ValueError, match="already have a pending appeal"):
            run(sybil_service.create_appeal(
                session, user_id, reason="Second appeal attempt",
            ))

    def test_approve_appeal(self, db_session):
        """Admins should be able to approve appeals."""
        session, run = db_session
        user_id = f"appeal-approve-{uuid.uuid4().hex[:8]}"

        appeal = run(sybil_service.create_appeal(
            session, user_id, reason="I am a real developer",
        ))
        run(session.commit())

        reviewed = run(sybil_service.review_appeal(
            session, appeal.id, MOCK_ADMIN_ID,
            AppealStatus.APPROVED, "Verified via GitHub activity",
        ))
        run(session.commit())

        assert reviewed.status == "approved"
        assert reviewed.reviewed_by == MOCK_ADMIN_ID

    def test_reject_appeal(self, db_session):
        """Admins should be able to reject appeals."""
        session, run = db_session
        user_id = f"appeal-reject-{uuid.uuid4().hex[:8]}"

        appeal = run(sybil_service.create_appeal(
            session, user_id, reason="Please reconsider",
        ))
        run(session.commit())

        reviewed = run(sybil_service.review_appeal(
            session, appeal.id, MOCK_ADMIN_ID,
            AppealStatus.REJECTED, "Account shows sybil indicators",
        ))
        run(session.commit())

        assert reviewed.status == "rejected"

    def test_cannot_review_non_pending_appeal(self, db_session):
        """Already-reviewed appeals should not be reviewable again."""
        session, run = db_session
        user_id = f"appeal-re-review-{uuid.uuid4().hex[:8]}"

        appeal = run(sybil_service.create_appeal(
            session, user_id, reason="Testing re-review",
        ))
        run(session.commit())

        run(sybil_service.review_appeal(
            session, appeal.id, MOCK_ADMIN_ID, AppealStatus.APPROVED,
        ))
        run(session.commit())

        with pytest.raises(ValueError, match="already approved"):
            run(sybil_service.review_appeal(
                session, appeal.id, MOCK_ADMIN_ID, AppealStatus.REJECTED,
            ))

    def test_appeal_pagination(self, db_session):
        """Appeal queries should support pagination."""
        session, run = db_session

        for i in range(4):
            uid = f"appeal-page-{uuid.uuid4().hex[:8]}"
            run(sybil_service.create_appeal(
                session, uid, reason=f"Appeal #{i}",
            ))
        run(session.commit())

        page1 = run(sybil_service.get_appeals(session, page=1, per_page=2))
        assert len(page1["items"]) == 2


# ---------------------------------------------------------------------------
# 11. Configuration endpoint tests
# ---------------------------------------------------------------------------


class TestSybilConfig:
    """Tests for the configuration endpoint."""

    def test_get_config_returns_all_thresholds(self):
        """Configuration should include all threshold values."""
        config = sybil_service.get_sybil_config()

        assert config.github_min_account_age_days == sybil_service.GITHUB_MIN_ACCOUNT_AGE_DAYS
        assert config.github_min_public_repos == sybil_service.GITHUB_MIN_PUBLIC_REPOS
        assert config.github_min_total_commits == sybil_service.GITHUB_MIN_TOTAL_COMMITS
        assert config.max_active_claims_per_user == sybil_service.MAX_ACTIVE_CLAIMS_PER_USER
        assert config.t1_cooldown_hours == sybil_service.T1_COOLDOWN_HOURS
        assert config.ip_max_accounts == sybil_service.IP_MAX_ACCOUNTS
        assert config.wallet_cluster_threshold == sybil_service.WALLET_CLUSTER_THRESHOLD


# ---------------------------------------------------------------------------
# 12. API integration tests (TestClient)
# ---------------------------------------------------------------------------


class TestSybilAPI:
    """Integration tests for the sybil protection REST API."""

    def test_evaluate_user_endpoint(self):
        """GET /api/sybil/evaluate/{user_id} should return evaluation results."""
        old_date = (
            datetime.now(timezone.utc) - timedelta(days=365)
        ).isoformat()
        response = client.get(
            "/api/sybil/evaluate/test-api-user",
            params={
                "github_created_at": old_date,
                "public_repos": 20,
                "total_commits": 100,
                "active_claims_count": 0,
                "accounts_from_ip": 1,
                "ip_address": "192.168.1.100",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["overall_decision"] == "allow"
        assert data["user_id"] == "test-api-user"
        assert len(data["checks"]) >= 5

    def test_evaluate_blocked_user_endpoint(self):
        """Evaluation of a suspicious user should return BLOCK."""
        new_date = (
            datetime.now(timezone.utc) - timedelta(days=5)
        ).isoformat()
        response = client.get(
            "/api/sybil/evaluate/test-blocked-user",
            params={
                "github_created_at": new_date,
                "public_repos": 0,
                "total_commits": 0,
                "active_claims_count": 10,
                "accounts_from_ip": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["overall_decision"] == "block"

    def test_evaluate_invalid_date_returns_400(self):
        """Invalid datetime format should return a 400 error."""
        response = client.get(
            "/api/sybil/evaluate/test-bad-date",
            params={"github_created_at": "not-a-date"},
        )
        assert response.status_code == 400

    def test_audit_logs_endpoint(self):
        """GET /api/sybil/audit-logs should return paginated audit entries."""
        response = client.get("/api/sybil/audit-logs", params={"per_page": 5})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data

    def test_alerts_endpoint(self):
        """GET /api/sybil/alerts should return paginated alerts."""
        response = client.get("/api/sybil/alerts", params={"per_page": 5})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_config_endpoint(self):
        """GET /api/sybil/config should return current thresholds."""
        response = client.get("/api/sybil/config")
        assert response.status_code == 200
        data = response.json()
        assert "github_min_account_age_days" in data
        assert "max_active_claims_per_user" in data
        assert "t1_cooldown_hours" in data
        assert "ip_max_accounts" in data
        assert "wallet_cluster_threshold" in data

    def test_submit_appeal_endpoint(self):
        """POST /api/sybil/appeals should create an appeal."""
        response = client.post(
            "/api/sybil/appeals",
            json={
                "reason": "I am a legitimate developer with a new GitHub account",
                "evidence": "https://linkedin.com/in/myprofile",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["user_id"] == MOCK_USER_ID

    def test_submit_duplicate_appeal_returns_400(self):
        """Submitting a second pending appeal should return 400."""
        # The first appeal was created in the test above; this is a duplicate
        response = client.post(
            "/api/sybil/appeals",
            json={
                "reason": "Another appeal attempt that should fail with 400 error",
            },
        )
        assert response.status_code == 400

    def test_list_appeals_endpoint(self):
        """GET /api/sybil/appeals should return paginated appeals."""
        response = client.get("/api/sybil/appeals", params={"per_page": 5})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_appeal_too_short_reason_returns_422(self):
        """Appeal with reason shorter than 10 chars should return 422."""
        response = client.post(
            "/api/sybil/appeals",
            json={"reason": "short"},
        )
        assert response.status_code == 422

    def test_health_endpoint_unaffected(self):
        """Adding sybil routes should not break existing health check."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
