"""Tests for the bounty lifecycle engine.

Covers: state machine transitions, draft→open publish, T2/T3 claim/unclaim,
T1 open-race auto-win, deadline enforcement (warn + auto-release), and
audit log generation.
"""

import os
import pytest
from datetime import datetime, timedelta, timezone

# Ensure test env vars
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app.models.bounty import (
    BountyCreate,
    BountyStatus,
    BountyTier,
    VALID_STATUS_TRANSITIONS,
)
from app.services import bounty_service, lifecycle_service
from app.services.bounty_lifecycle_service import (
    LifecycleError,
    check_deadlines,
    claim_bounty,
    handle_t1_auto_win,
    publish_bounty,
    transition_status,
    unclaim_bounty,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_bounty(
    tier: BountyTier = BountyTier.T2,
    status: BountyStatus = BountyStatus.OPEN,
    **kwargs,
) -> str:
    """Create a test bounty and return its ID."""
    data = BountyCreate(
        title="Test Bounty",
        description="Test description",
        tier=tier,
        reward_amount=500.0,
        **kwargs,
    )
    resp = bounty_service.create_bounty(data)
    # Override status if needed
    bounty = bounty_service._bounty_store[resp.id]
    bounty.status = status
    return resp.id


def _create_t1_with_submission() -> tuple[str, str]:
    """Create a T1 bounty with one submission, return (bounty_id, submission_id)."""
    bounty_id = _create_bounty(tier=BountyTier.T1)
    bounty = bounty_service._bounty_store[bounty_id]
    from app.models.bounty import SubmissionRecord

    sub = SubmissionRecord(
        bounty_id=bounty_id,
        pr_url="https://github.com/test/repo/pull/1",
        submitted_by="contributor_1",
        contributor_wallet="wallet_abc123_long_enough_for_validation",
    )
    bounty.submissions.append(sub)
    return bounty_id, sub.id


@pytest.fixture(autouse=True)
def _cleanup():
    """Clear stores between tests."""
    bounty_service._bounty_store.clear()
    lifecycle_service.reset_store()
    yield
    bounty_service._bounty_store.clear()
    lifecycle_service.reset_store()


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class TestStateMachine:
    """Test that all valid transitions succeed and invalid ones raise."""

    def test_valid_open_to_in_progress(self):
        bid = _create_bounty(status=BountyStatus.OPEN)
        resp = transition_status(bid, BountyStatus.IN_PROGRESS)
        assert resp.status == BountyStatus.IN_PROGRESS

    def test_valid_in_progress_to_completed(self):
        bid = _create_bounty(status=BountyStatus.IN_PROGRESS)
        resp = transition_status(bid, BountyStatus.COMPLETED)
        assert resp.status == BountyStatus.COMPLETED

    def test_valid_completed_to_paid(self):
        bid = _create_bounty(status=BountyStatus.COMPLETED)
        resp = transition_status(bid, BountyStatus.PAID)
        assert resp.status == BountyStatus.PAID

    def test_valid_draft_to_open(self):
        bid = _create_bounty(status=BountyStatus.DRAFT)
        resp = transition_status(bid, BountyStatus.OPEN)
        assert resp.status == BountyStatus.OPEN

    def test_valid_draft_to_cancelled(self):
        bid = _create_bounty(status=BountyStatus.DRAFT)
        resp = transition_status(bid, BountyStatus.CANCELLED)
        assert resp.status == BountyStatus.CANCELLED

    def test_invalid_open_to_paid(self):
        bid = _create_bounty(status=BountyStatus.OPEN)
        with pytest.raises(LifecycleError, match="Invalid status transition"):
            transition_status(bid, BountyStatus.PAID)

    def test_invalid_paid_to_open(self):
        bid = _create_bounty(status=BountyStatus.PAID)
        with pytest.raises(LifecycleError, match="Invalid status transition"):
            transition_status(bid, BountyStatus.OPEN)

    def test_invalid_cancelled_is_terminal(self):
        bid = _create_bounty(status=BountyStatus.CANCELLED)
        with pytest.raises(LifecycleError):
            transition_status(bid, BountyStatus.OPEN)

    def test_bounty_not_found(self):
        with pytest.raises(LifecycleError, match="not found"):
            transition_status("nonexistent-id", BountyStatus.OPEN)

    def test_transition_logs_audit_event(self):
        bid = _create_bounty(status=BountyStatus.OPEN)
        transition_status(bid, BountyStatus.IN_PROGRESS)
        log = lifecycle_service.get_lifecycle_log(bid)
        assert log.total >= 1
        assert any(e.event_type == "bounty_status_changed" for e in log.items)

    def test_all_valid_transitions_succeed(self):
        """Exhaustively test every valid transition in the state machine."""
        for from_status, allowed in VALID_STATUS_TRANSITIONS.items():
            for to_status in allowed:
                bid = _create_bounty(status=from_status)
                resp = transition_status(bid, to_status)
                assert resp.status == to_status, (
                    f"Failed transition: {from_status.value} → {to_status.value}"
                )


# ---------------------------------------------------------------------------
# Publish (draft → open)
# ---------------------------------------------------------------------------


class TestPublish:
    def test_publish_draft(self):
        bid = _create_bounty(status=BountyStatus.DRAFT)
        resp = publish_bounty(bid, actor_id="creator_1")
        assert resp.status == BountyStatus.OPEN

    def test_publish_non_draft_fails(self):
        bid = _create_bounty(status=BountyStatus.OPEN)
        with pytest.raises(LifecycleError, match="DRAFT"):
            publish_bounty(bid)

    def test_publish_logs_event(self):
        bid = _create_bounty(status=BountyStatus.DRAFT)
        publish_bounty(bid)
        log = lifecycle_service.get_lifecycle_log(bid)
        assert any(e.event_type == "bounty_published" for e in log.items)


# ---------------------------------------------------------------------------
# Claim flow (T2 / T3)
# ---------------------------------------------------------------------------


class TestClaimFlow:
    def test_claim_t2_bounty(self):
        bid = _create_bounty(tier=BountyTier.T2)
        resp = claim_bounty(bid, "claimer_1")
        assert resp.status == BountyStatus.IN_PROGRESS
        assert resp.claimed_by == "claimer_1"
        assert resp.claim_deadline is not None

    def test_claim_t3_bounty(self):
        bid = _create_bounty(tier=BountyTier.T3)
        resp = claim_bounty(bid, "claimer_2")
        assert resp.status == BountyStatus.IN_PROGRESS
        assert resp.claimed_by == "claimer_2"

    def test_claim_t1_fails(self):
        bid = _create_bounty(tier=BountyTier.T1)
        with pytest.raises(LifecycleError, match="T1"):
            claim_bounty(bid, "claimer_1")

    def test_claim_non_open_fails(self):
        bid = _create_bounty(tier=BountyTier.T2, status=BountyStatus.IN_PROGRESS)
        with pytest.raises(LifecycleError, match="OPEN"):
            claim_bounty(bid, "claimer_1")

    def test_double_claim_fails(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1")
        with pytest.raises(LifecycleError, match="OPEN"):
            claim_bounty(bid, "claimer_2")

    def test_claim_custom_duration(self):
        bid = _create_bounty(tier=BountyTier.T2)
        _resp = claim_bounty(bid, "claimer_1", claim_duration_hours=24)
        bounty = bounty_service._bounty_store[bid]
        expected = bounty.claimed_at + timedelta(hours=24)
        assert abs((bounty.claim_deadline - expected).total_seconds()) < 2

    def test_unclaim_bounty(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1")
        resp = unclaim_bounty(bid, actor_id="claimer_1")
        assert resp.status == BountyStatus.OPEN
        assert resp.claimed_by is None
        assert resp.claim_deadline is None

    def test_unclaim_not_claimed_fails(self):
        bid = _create_bounty(tier=BountyTier.T2)
        with pytest.raises(LifecycleError, match="not claimed"):
            unclaim_bounty(bid)

    def test_claim_logs_event(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1")
        log = lifecycle_service.get_lifecycle_log(bid)
        assert any(e.event_type == "bounty_claimed" for e in log.items)


# ---------------------------------------------------------------------------
# T1 open-race auto-win
# ---------------------------------------------------------------------------


class TestT1AutoWin:
    def test_t1_auto_win(self):
        bid, sid = _create_t1_with_submission()
        resp = handle_t1_auto_win(bid, sid)
        assert resp.status == BountyStatus.COMPLETED
        assert resp.winner_submission_id == sid

    def test_t1_auto_win_non_t1_fails(self):
        bid = _create_bounty(tier=BountyTier.T2)
        with pytest.raises(LifecycleError, match="T1"):
            handle_t1_auto_win(bid, "some-sub-id")

    def test_t1_auto_win_already_completed(self):
        bid, sid = _create_t1_with_submission()
        bounty_service._bounty_store[bid].status = BountyStatus.COMPLETED
        with pytest.raises(LifecycleError, match="terminal"):
            handle_t1_auto_win(bid, sid)

    def test_t1_auto_win_bad_submission(self):
        bid, _ = _create_t1_with_submission()
        with pytest.raises(LifecycleError, match="not found"):
            handle_t1_auto_win(bid, "nonexistent")

    def test_t1_auto_win_logs_event(self):
        bid, sid = _create_t1_with_submission()
        handle_t1_auto_win(bid, sid)
        log = lifecycle_service.get_lifecycle_log(bid)
        assert any(e.event_type == "bounty_t1_auto_won" for e in log.items)


# ---------------------------------------------------------------------------
# Deadline enforcement
# ---------------------------------------------------------------------------


class TestDeadlineEnforcement:
    def test_no_action_when_no_claims(self):
        _create_bounty()  # unclaimed
        result = check_deadlines()
        assert result == {"warned": 0, "released": 0}

    def test_auto_release_expired_claim(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1", claim_duration_hours=1)
        # Backdate claim to make it expired
        bounty = bounty_service._bounty_store[bid]
        bounty.claimed_at = datetime.now(timezone.utc) - timedelta(hours=2)
        bounty.claim_deadline = datetime.now(timezone.utc) - timedelta(hours=1)

        result = check_deadlines()
        assert result["released"] == 1

        # Bounty should be open again
        bounty = bounty_service._bounty_store[bid]
        assert bounty.status == BountyStatus.OPEN
        assert bounty.claimed_by is None

    def test_warning_at_80_percent(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1", claim_duration_hours=10)
        # Set elapsed to 85%
        bounty = bounty_service._bounty_store[bid]
        bounty.claimed_at = datetime.now(timezone.utc) - timedelta(hours=8.5)
        bounty.claim_deadline = bounty.claimed_at + timedelta(hours=10)

        result = check_deadlines()
        assert result["warned"] == 1
        assert result["released"] == 0

        # Bounty should still be claimed
        bounty = bounty_service._bounty_store[bid]
        assert bounty.status == BountyStatus.IN_PROGRESS
        assert bounty.claimed_by == "claimer_1"

    def test_no_warning_before_80_percent(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1", claim_duration_hours=10)
        # Set elapsed to 50%
        bounty = bounty_service._bounty_store[bid]
        bounty.claimed_at = datetime.now(timezone.utc) - timedelta(hours=5)
        bounty.claim_deadline = bounty.claimed_at + timedelta(hours=10)

        result = check_deadlines()
        assert result == {"warned": 0, "released": 0}

    def test_auto_release_logs_event(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1", claim_duration_hours=1)
        bounty = bounty_service._bounty_store[bid]
        bounty.claimed_at = datetime.now(timezone.utc) - timedelta(hours=2)
        bounty.claim_deadline = datetime.now(timezone.utc) - timedelta(hours=1)

        check_deadlines()

        log = lifecycle_service.get_lifecycle_log(bid)
        assert any(e.event_type == "bounty_claim_auto_released" for e in log.items)

    def test_warning_logs_event(self):
        bid = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid, "claimer_1", claim_duration_hours=10)
        bounty = bounty_service._bounty_store[bid]
        bounty.claimed_at = datetime.now(timezone.utc) - timedelta(hours=9)
        bounty.claim_deadline = bounty.claimed_at + timedelta(hours=10)

        check_deadlines()

        log = lifecycle_service.get_lifecycle_log(bid)
        assert any(e.event_type == "bounty_claim_deadline_warning" for e in log.items)

    def test_multiple_bounties_mixed(self):
        """One expired, one at 85%, one at 50% — verify counts."""
        # Expired
        bid1 = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid1, "c1", claim_duration_hours=1)
        b1 = bounty_service._bounty_store[bid1]
        b1.claimed_at = datetime.now(timezone.utc) - timedelta(hours=2)
        b1.claim_deadline = datetime.now(timezone.utc) - timedelta(hours=1)

        # 85% elapsed
        bid2 = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid2, "c2", claim_duration_hours=10)
        b2 = bounty_service._bounty_store[bid2]
        b2.claimed_at = datetime.now(timezone.utc) - timedelta(hours=8.5)
        b2.claim_deadline = b2.claimed_at + timedelta(hours=10)

        # 50% elapsed
        bid3 = _create_bounty(tier=BountyTier.T2)
        claim_bounty(bid3, "c3", claim_duration_hours=10)
        b3 = bounty_service._bounty_store[bid3]
        b3.claimed_at = datetime.now(timezone.utc) - timedelta(hours=5)
        b3.claim_deadline = b3.claimed_at + timedelta(hours=10)

        result = check_deadlines()
        assert result["released"] == 1
        assert result["warned"] == 1
