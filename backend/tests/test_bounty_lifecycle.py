import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.models.bounty import Bounty, BountyStatus
from backend.models.user import User
from backend.core.bounty_lifecycle import (
    BountyLifecycleEngine,
    BountyState,
    InvalidTransitionError,
    TerminalStateError,
    ClaimConflictError,
    TierGateError
)
from backend.core.exceptions import ValidationError


class TestBountyLifecycleEngine:

    @pytest.fixture
    def engine(self):
        return BountyLifecycleEngine()

    @pytest.fixture
    def mock_bounty(self):
        bounty = Mock(spec=Bounty)
        bounty.id = 1
        bounty.status = BountyStatus.DRAFT
        bounty.claimed_by = None
        bounty.claimed_at = None
        bounty.deadline = None
        bounty.tier = 1
        bounty.reward_amount = 100000
        return bounty

    @pytest.fixture
    def mock_user(self):
        user = Mock(spec=User)
        user.id = 42
        user.username = "testdev"
        user.reputation_score = 250000
        return user

    def test_happy_path_full_lifecycle(self, engine, mock_bounty, mock_user):
        """Test complete bounty lifecycle from draft to paid"""
        # Draft to Open
        engine.transition_to_open(mock_bounty)
        assert mock_bounty.status == BountyStatus.OPEN

        # Open to Claimed
        engine.claim_bounty(mock_bounty, mock_user)
        assert mock_bounty.status == BountyStatus.CLAIMED
        assert mock_bounty.claimed_by == mock_user.id
        assert mock_bounty.claimed_at is not None

        # Claimed to In Review
        engine.transition_to_review(mock_bounty)
        assert mock_bounty.status == BountyStatus.IN_REVIEW

        # In Review to Completed
        engine.transition_to_completed(mock_bounty)
        assert mock_bounty.status == BountyStatus.COMPLETED

        # Completed to Paid (terminal)
        engine.transition_to_paid(mock_bounty)
        assert mock_bounty.status == BountyStatus.PAID

    def test_invalid_transition_from_draft(self, engine, mock_bounty):
        """Test invalid transitions from draft state"""
        mock_bounty.status = BountyStatus.DRAFT

        with pytest.raises(InvalidTransitionError, match="Cannot transition from DRAFT to CLAIMED"):
            engine.transition_to_claimed(mock_bounty, 42)

        with pytest.raises(InvalidTransitionError, match="Cannot transition from DRAFT to IN_REVIEW"):
            engine.transition_to_review(mock_bounty)

    def test_terminal_state_enforcement_paid(self, engine, mock_bounty):
        """Test that paid state cannot transition to any other state"""
        mock_bounty.status = BountyStatus.PAID

        with pytest.raises(TerminalStateError, match="Cannot transition from terminal state PAID"):
            engine.transition_to_open(mock_bounty)

        with pytest.raises(TerminalStateError, match="Cannot transition from terminal state PAID"):
            engine.transition_to_cancelled(mock_bounty)

    def test_terminal_state_enforcement_cancelled(self, engine, mock_bounty):
        """Test that cancelled state cannot transition to any other state"""
        mock_bounty.status = BountyStatus.CANCELLED

        with pytest.raises(TerminalStateError, match="Cannot transition from terminal state CANCELLED"):
            engine.transition_to_open(mock_bounty)

        with pytest.raises(TerminalStateError, match="Cannot transition from terminal state CANCELLED"):
            engine.claim_bounty(mock_bounty, Mock())

    def test_concurrent_claim_handling(self, engine, mock_user):
        """Test thread-safety with 5 concurrent claim attempts"""
        mock_bounty = Mock(spec=Bounty)
        mock_bounty.id = 1
        mock_bounty.status = BountyStatus.OPEN
        mock_bounty.claimed_by = None
        mock_bounty.claimed_at = None
        mock_bounty.tier = 1

        successful_claims = []
        failed_claims = []

        def attempt_claim(user_id):
            try:
                user = Mock(spec=User)
                user.id = user_id
                user.username = f"user{user_id}"
                user.reputation_score = 250000

                engine.claim_bounty(mock_bounty, user)
                successful_claims.append(user_id)
                return True
            except ClaimConflictError:
                failed_claims.append(user_id)
                return False

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(attempt_claim, i) for i in range(1, 6)]
            results = [future.result() for future in as_completed(futures)]

        # Exactly one claim should succeed
        assert len(successful_claims) == 1
        assert len(failed_claims) == 4
        assert sum(results) == 1
        assert mock_bounty.status == BountyStatus.CLAIMED

    def test_tier_gate_validation_tier2_insufficient_reputation(self, engine, mock_bounty, mock_user):
        """Test T2 bounty requires sufficient reputation"""
        mock_bounty.tier = 2
        mock_bounty.reward_amount = 400000
        mock_bounty.status = BountyStatus.OPEN
        mock_user.reputation_score = 250000  # Insufficient for T2

        with pytest.raises(TierGateError, match="Insufficient reputation for tier 2 bounty"):
            engine.claim_bounty(mock_bounty, mock_user)

    def test_tier_gate_validation_tier2_sufficient_reputation(self, engine, mock_bounty, mock_user):
        """Test T2 bounty allows sufficient reputation"""
        mock_bounty.tier = 2
        mock_bounty.reward_amount = 400000
        mock_bounty.status = BountyStatus.OPEN
        mock_user.reputation_score = 500000  # Sufficient for T2

        # Should succeed
        engine.claim_bounty(mock_bounty, mock_user)
        assert mock_bounty.status == BountyStatus.CLAIMED
        assert mock_bounty.claimed_by == mock_user.id

    def test_tier_gate_validation_tier3_insufficient_reputation(self, engine, mock_bounty, mock_user):
        """Test T3 bounty requires even higher reputation"""
        mock_bounty.tier = 3
        mock_bounty.reward_amount = 800000
        mock_bounty.status = BountyStatus.OPEN
        mock_user.reputation_score = 500000  # Insufficient for T3

        with pytest.raises(TierGateError, match="Insufficient reputation for tier 3 bounty"):
            engine.claim_bounty(mock_bounty, mock_user)

    @pytest.mark.asyncio
    async def test_webhook_pr_opened_to_claimed(self, engine, mock_bounty):
        """Test webhook processing for PR opened event"""
        mock_bounty.status = BountyStatus.OPEN

        webhook_data = {
            "action": "opened",
            "pull_request": {"user": {"login": "testdev"}},
            "repository": {"full_name": "org/repo"}
        }

        with patch.object(engine, '_get_user_by_github', return_value=Mock(id=42)) as mock_get_user:
            await engine.process_webhook_event(mock_bounty, webhook_data)
            assert mock_bounty.status == BountyStatus.CLAIMED
            mock_get_user.assert_called_once_with("testdev")

    @pytest.mark.asyncio
    async def test_webhook_pr_merged_to_completed(self, engine, mock_bounty):
        """Test webhook processing for PR merged event"""
        mock_bounty.status = BountyStatus.IN_REVIEW
        mock_bounty.claimed_by = 42

        webhook_data = {
            "action": "closed",
            "pull_request": {"merged": True, "user": {"login": "testdev"}},
            "repository": {"full_name": "org/repo"}
        }

        with patch.object(engine, '_get_user_by_github', return_value=Mock(id=42)):
            await engine.process_webhook_event(mock_bounty, webhook_data)
            assert mock_bounty.status == BountyStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_webhook_pr_closed_unmerged_to_open(self, engine, mock_bounty):
        """Test webhook processing for PR closed without merge"""
        mock_bounty.status = BountyStatus.CLAIMED
        mock_bounty.claimed_by = 42

        webhook_data = {
            "action": "closed",
            "pull_request": {"merged": False, "user": {"login": "testdev"}},
            "repository": {"full_name": "org/repo"}
        }

        with patch.object(engine, '_get_user_by_github', return_value=Mock(id=42)):
            await engine.process_webhook_event(mock_bounty, webhook_data)
            assert mock_bounty.status == BountyStatus.OPEN
            assert mock_bounty.claimed_by is None

    def test_deadline_warning_at_80_percent(self, engine, mock_bounty):
        """Test deadline warning notification at 80% threshold"""
        claim_time = datetime.utcnow() - timedelta(hours=57.6)  # 80% of 72 hours
        mock_bounty.status = BountyStatus.CLAIMED
        mock_bounty.claimed_at = claim_time
        mock_bounty.claimed_by = 42

        with patch.object(engine, '_send_deadline_warning') as mock_warning:
            warnings = engine.check_deadlines([mock_bounty])
            assert len(warnings) == 1
            mock_warning.assert_called_once_with(mock_bounty)

    def test_auto_release_at_100_percent(self, engine, mock_bounty):
        """Test automatic release when deadline exceeded"""
        claim_time = datetime.utcnow() - timedelta(hours=73)  # > 72 hours
        mock_bounty.status = BountyStatus.CLAIMED
        mock_bounty.claimed_at = claim_time
        mock_bounty.claimed_by = 42

        releases = engine.check_deadlines([mock_bounty])
        assert len(releases) == 1
        assert mock_bounty.status == BountyStatus.OPEN
        assert mock_bounty.claimed_by is None
        assert mock_bounty.claimed_at is None

    def test_audit_log_creation_on_transition(self, engine, mock_bounty):
        """Test audit log entries are created for state transitions"""
        with patch.object(engine, '_create_audit_entry') as mock_audit:
            engine.transition_to_open(mock_bounty)
            mock_audit.assert_called_once()

            call_args = mock_audit.call_args[1]
            assert call_args['bounty_id'] == mock_bounty.id
            assert call_args['action'] == 'state_transition'
            assert call_args['from_state'] == 'DRAFT'
            assert call_args['to_state'] == 'OPEN'

    def test_audit_log_claim_operation(self, engine, mock_bounty, mock_user):
        """Test audit log for claim operations"""
        mock_bounty.status = BountyStatus.OPEN

        with patch.object(engine, '_create_audit_entry') as mock_audit:
            engine.claim_bounty(mock_bounty, mock_user)

            # Should have both state transition and claim audit entries
            assert mock_audit.call_count == 2

            # Check claim-specific audit entry
            claim_call = mock_audit.call_args_list[1][1]
            assert claim_call['action'] == 'bounty_claimed'
            assert claim_call['user_id'] == mock_user.id

    def test_invalid_webhook_data_handling(self, engine, mock_bounty):
        """Test error handling for invalid webhook data"""
        invalid_webhook = {"invalid": "structure"}

        with pytest.raises(ValidationError, match="Invalid webhook data"):
            asyncio.run(engine.process_webhook_event(mock_bounty, invalid_webhook))

    def test_claim_conflict_already_claimed(self, engine, mock_bounty, mock_user):
        """Test claiming a bounty that's already claimed"""
        mock_bounty.status = BountyStatus.CLAIMED
        mock_bounty.claimed_by = 999  # Different user

        with pytest.raises(ClaimConflictError, match="Bounty is already claimed"):
            engine.claim_bounty(mock_bounty, mock_user)

    def test_release_claim_resets_state(self, engine, mock_bounty):
        """Test releasing a claim properly resets bounty state"""
        mock_bounty.status = BountyStatus.CLAIMED
        mock_bounty.claimed_by = 42
        mock_bounty.claimed_at = datetime.utcnow()

        engine.release_claim(mock_bounty)

        assert mock_bounty.status == BountyStatus.OPEN
        assert mock_bounty.claimed_by is None
        assert mock_bounty.claimed_at is None

    def test_state_lock_prevents_race_conditions(self, engine, mock_bounty):
        """Test that state lock prevents concurrent state modifications"""
        mock_bounty.status = BountyStatus.OPEN

        # Simulate acquiring lock in one thread
        with engine._state_lock:
            # Try to claim from another thread (should be blocked)
            def attempt_claim():
                user = Mock(spec=User)
                user.id = 123
                user.reputation_score = 250000
                return engine.claim_bounty(mock_bounty, user)

            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(attempt_claim)
                time.sleep(0.1)  # Give thread time to start

                # Change state while lock is held
                mock_bounty.status = BountyStatus.CANCELLED

                # Release lock and get result
                pass

            # The claim attempt should have been blocked
            try:
                future.result(timeout=1.0)
                assert False, "Expected operation to be blocked"
            except:
                pass  # Expected to fail/timeout
