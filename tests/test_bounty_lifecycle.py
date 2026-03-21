import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
from typing import Dict, Any
import asyncio
import json

from backend.bounty_lifecycle import (
    BountyLifecycleEngine,
    LifecycleEvent,
    AuditEntry
)
from backend.models import BountyState, BountyTier
from backend.database import DatabasePool


class TestBountyLifecycleEngine:
    @pytest.fixture
    def mock_db_pool(self):
        """Mock database pool for testing"""
        pool = Mock(spec=DatabasePool)
        conn = AsyncMock()
        pool.acquire.return_value.__aenter__.return_value = conn
        pool.acquire.return_value.__aexit__.return_value = None
        return pool, conn

    @pytest.fixture
    def lifecycle_engine(self, mock_db_pool):
        """Create lifecycle engine with mocked database"""
        pool, _ = mock_db_pool
        return BountyLifecycleEngine(pool)

    @pytest.mark.asyncio
    async def test_get_bounty_state_success(self, lifecycle_engine, mock_db_pool):
        """Test successful retrieval of bounty state"""
        _, conn = mock_db_pool
        conn.fetchrow.return_value = {
            'state': BountyState.OPEN.value,
            'tier': BountyTier.T1.value,
            'claimed_by': None
        }

        state, tier, claimed_by = await lifecycle_engine._get_bounty_state(123)

        assert state == BountyState.OPEN
        assert tier == BountyTier.T1
        assert claimed_by is None
        conn.fetchrow.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_bounty_state_not_found(self, lifecycle_engine, mock_db_pool):
        """Test error when bounty doesn't exist"""
        _, conn = mock_db_pool
        conn.fetchrow.return_value = None

        with pytest.raises(ValueError, match="Bounty 999 not found"):
            await lifecycle_engine._get_bounty_state(999)

    @pytest.mark.asyncio
    async def test_log_audit_entry(self, lifecycle_engine, mock_db_pool):
        """Test audit logging functionality"""
        _, conn = mock_db_pool
        entry = AuditEntry(
            bounty_id=123,
            event=LifecycleEvent.OPEN_TO_CLAIMED,
            from_state=BountyState.OPEN,
            to_state=BountyState.CLAIMED,
            user_id=456,
            metadata={'test': 'data'},
            timestamp=datetime.utcnow()
        )

        await lifecycle_engine._log_audit(entry)

        conn.execute.assert_called_once()
        call_args = conn.execute.call_args
        assert call_args[0][0].startswith("INSERT INTO bounty_audit_log")
        assert call_args[0][1] == 123  # bounty_id
        assert call_args[0][2] == LifecycleEvent.OPEN_TO_CLAIMED.value  # event
        assert call_args[0][3] == BountyState.OPEN.value  # from_state
        assert call_args[0][4] == BountyState.CLAIMED.value  # to_state
        assert call_args[0][5] == 456  # user_id
        assert json.loads(call_args[0][6]) == {'test': 'data'}  # metadata

    @pytest.mark.asyncio
    async def test_claim_lock_mechanism(self, lifecycle_engine):
        """Test claim locking mechanism for thread safety"""
        bounty_id = 123

        # First call should create a new lock
        lock1 = lifecycle_engine._get_claim_lock(bounty_id)
        assert lock1 is not None

        # Second call should return same lock
        lock2 = lifecycle_engine._get_claim_lock(bounty_id)
        assert lock1 is lock2

        # Different bounty ID should create different lock
        lock3 = lifecycle_engine._get_claim_lock(456)
        assert lock3 is not lock1

    @pytest.mark.asyncio
    async def test_audit_entry_serialization(self):
        """Test AuditEntry to_dict method"""
        timestamp = datetime(2024, 1, 15, 10, 30, 0)
        entry = AuditEntry(
            bounty_id=123,
            event=LifecycleEvent.CLAIMED_TO_IN_REVIEW,
            from_state=BountyState.CLAIMED,
            to_state=BountyState.IN_REVIEW,
            user_id=789,
            metadata={'pr_url': 'https://github.com/repo/pull/1'},
            timestamp=timestamp
        )

        result = entry.to_dict()

        expected = {
            'bounty_id': 123,
            'event': 'claimed_to_in_review',
            'from_state': 'claimed',
            'to_state': 'in_review',
            'user_id': 789,
            'metadata': {'pr_url': 'https://github.com/repo/pull/1'},
            'timestamp': '2024-01-15T10:30:00'
        }
        assert result == expected

    @pytest.mark.asyncio
    async def test_concurrent_claim_operations(self, lifecycle_engine, mock_db_pool):
        """Test that multiple claim operations on same bounty use same lock"""
        _, conn = mock_db_pool
        bounty_id = 123

        # Track lock acquisitions
        acquired_locks = []

        async def mock_claim_operation():
            lock = lifecycle_engine._get_claim_lock(bounty_id)
            acquired_locks.append(lock)
            # Simulate some async work
            await asyncio.sleep(0.01)
            return lock

        # Run multiple concurrent operations
        tasks = [mock_claim_operation() for _ in range(5)]
        results = await asyncio.gather(*tasks)

        # All operations should have gotten the same lock instance
        assert len(set(id(lock) for lock in acquired_locks)) == 1
        assert all(lock is acquired_locks[0] for lock in results)

    @pytest.mark.asyncio
    async def test_lifecycle_event_enum_values(self):
        """Test that LifecycleEvent enum has expected string values"""
        assert LifecycleEvent.DRAFT_TO_OPEN == "draft_to_open"
        assert LifecycleEvent.OPEN_TO_CLAIMED == "open_to_claimed"
        assert LifecycleEvent.CLAIMED_TO_IN_REVIEW == "claimed_to_in_review"
        assert LifecycleEvent.IN_REVIEW_TO_COMPLETED == "in_review_to_completed"
        assert LifecycleEvent.IN_REVIEW_TO_CLAIMED == "in_review_to_claimed"
        assert LifecycleEvent.COMPLETED_TO_PAID == "completed_to_paid"
        assert LifecycleEvent.CLAIM_RELEASED == "claim_released"
        assert LifecycleEvent.DEADLINE_WARNING == "deadline_warning"
        assert LifecycleEvent.DEADLINE_EXCEEDED == "deadline_exceeded"
        assert LifecycleEvent.T1_AUTO_WIN == "t1_auto_win"

    @pytest.mark.asyncio
    async def test_database_connection_error_handling(self, lifecycle_engine, mock_db_pool):
        """Test error handling when database operations fail"""
        pool, conn = mock_db_pool
        conn.fetchrow.side_effect = Exception("Database connection failed")

        with pytest.raises(Exception, match="Database connection failed"):
            await lifecycle_engine._get_bounty_state(123)

    @pytest.mark.asyncio
    async def test_audit_entry_with_none_user(self, lifecycle_engine, mock_db_pool):
        """Test audit logging with None user_id (system events)"""
        _, conn = mock_db_pool
        entry = AuditEntry(
            bounty_id=123,
            event=LifecycleEvent.DEADLINE_EXCEEDED,
            from_state=BountyState.CLAIMED,
            to_state=BountyState.OPEN,
            user_id=None,  # System event
            metadata={'reason': 'automatic deadline expiry'},
            timestamp=datetime.utcnow()
        )

        await lifecycle_engine._log_audit(entry)

        conn.execute.assert_called_once()
        call_args = conn.execute.call_args
        assert call_args[0][5] is None  # user_id should be None

    @pytest.mark.asyncio
    async def test_empty_metadata_serialization(self, lifecycle_engine, mock_db_pool):
        """Test audit logging with empty metadata"""
        _, conn = mock_db_pool
        entry = AuditEntry(
            bounty_id=123,
            event=LifecycleEvent.OPEN_TO_CLAIMED,
            from_state=BountyState.OPEN,
            to_state=BountyState.CLAIMED,
            user_id=456,
            metadata={},  # Empty metadata
            timestamp=datetime.utcnow()
        )

        await lifecycle_engine._log_audit(entry)

        conn.execute.assert_called_once()
        call_args = conn.execute.call_args
        assert json.loads(call_args[0][6]) == {}

    @pytest.mark.asyncio
    async def test_locks_cleanup_on_different_bounties(self, lifecycle_engine):
        """Test that locks dictionary doesn't grow indefinitely"""
        # Create locks for multiple bounties
        bounty_ids = [1, 2, 3, 4, 5]
        locks = [lifecycle_engine._get_claim_lock(bid) for bid in bounty_ids]

        # Verify locks are stored
        assert len(lifecycle_engine._claim_locks) == 5

        # Verify each bounty has unique lock
        assert len(set(id(lock) for lock in locks)) == 5

        # Access existing lock again
        same_lock = lifecycle_engine._get_claim_lock(1)
        assert same_lock is locks[0]
        assert len(lifecycle_engine._claim_locks) == 5  # No new locks created
