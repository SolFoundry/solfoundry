import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from decimal import Decimal
from datetime import datetime, timedelta

from backend.services.payout_service import PayoutService
from backend.models.payout import Payout, PayoutStatus
from backend.core.exceptions import PayoutError, ValidationError
from backend.core.database import get_db
from backend.tests.fixtures import sample_bounty, sample_user


class TestPayoutService:
    """Comprehensive test suite for the payout service covering all core functionality."""

    @pytest.fixture
    def payout_service(self, db_session):
        """Create a payout service instance with mocked dependencies."""
        with patch('backend.services.payout_service.SolanaRPC') as mock_rpc:
            service = PayoutService(db_session)
            service.solana_rpc = mock_rpc.return_value
            return service

    @pytest.fixture
    def valid_wallet_address(self):
        return "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

    @pytest.fixture
    def invalid_wallet_address(self):
        return "invalid_wallet_123"

    def test_validate_solana_wallet_valid(self, payout_service, valid_wallet_address):
        """Test wallet validation with valid Solana address."""
        result = payout_service.validate_solana_wallet(valid_wallet_address)
        assert result is True

    def test_validate_solana_wallet_invalid(self, payout_service, invalid_wallet_address):
        """Test wallet validation with invalid address format."""
        with pytest.raises(ValidationError) as exc_info:
            payout_service.validate_solana_wallet(invalid_wallet_address)
        assert "Invalid Solana wallet address" in str(exc_info.value)

    def test_validate_solana_wallet_empty(self, payout_service):
        """Test wallet validation with empty address."""
        with pytest.raises(ValidationError):
            payout_service.validate_solana_wallet("")

        with pytest.raises(ValidationError):
            payout_service.validate_solana_wallet(None)

    @pytest.mark.asyncio
    async def test_create_payout_success(self, payout_service, sample_bounty, sample_user, valid_wallet_address):
        """Test successful payout creation with valid parameters."""
        amount = Decimal('800000.0')

        payout = await payout_service.create_payout(
            bounty_id=sample_bounty.id,
            recipient_wallet=valid_wallet_address,
            amount=amount,
            recipient_user_id=sample_user.id
        )

        assert payout.bounty_id == sample_bounty.id
        assert payout.recipient_wallet == valid_wallet_address
        assert payout.amount == amount
        assert payout.status == PayoutStatus.PENDING
        assert payout.created_at is not None

    @pytest.mark.asyncio
    async def test_create_payout_duplicate_prevention(self, payout_service, sample_bounty, sample_user, valid_wallet_address):
        """Test prevention of duplicate payouts for same bounty."""
        amount = Decimal('800000.0')

        # Create first payout
        await payout_service.create_payout(
            bounty_id=sample_bounty.id,
            recipient_wallet=valid_wallet_address,
            amount=amount,
            recipient_user_id=sample_user.id
        )

        # Attempt duplicate payout
        with pytest.raises(PayoutError) as exc_info:
            await payout_service.create_payout(
                bounty_id=sample_bounty.id,
                recipient_wallet=valid_wallet_address,
                amount=amount,
                recipient_user_id=sample_user.id
            )

        assert "Payout already exists" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_process_payout_success(self, payout_service, db_session, valid_wallet_address):
        """Test successful payout processing with transaction confirmation."""
        # Create a pending payout
        payout = Payout(
            bounty_id=1,
            recipient_wallet=valid_wallet_address,
            amount=Decimal('800000.0'),
            status=PayoutStatus.PENDING
        )
        db_session.add(payout)
        db_session.commit()

        # Mock successful transaction
        mock_tx_hash = "5VqydpS8CzkqN5AExzBRzeMxZZnD8uVHJTX8JK8JKrYxUgNwpqJ1zGqc5N5N5N5N"
        payout_service.solana_rpc.send_spl_token.return_value = mock_tx_hash
        payout_service.solana_rpc.confirm_transaction.return_value = True

        result = await payout_service.process_payout(payout.id)

        assert result.status == PayoutStatus.CONFIRMED
        assert result.transaction_hash == mock_tx_hash
        assert result.processed_at is not None

    @pytest.mark.asyncio
    async def test_process_payout_retry_logic(self, payout_service, db_session, valid_wallet_address):
        """Test retry logic with exponential backoff on failed transactions."""
        payout = Payout(
            bounty_id=1,
            recipient_wallet=valid_wallet_address,
            amount=Decimal('800000.0'),
            status=PayoutStatus.PENDING
        )
        db_session.add(payout)
        db_session.commit()

        # Mock failed transactions on first 2 attempts, success on 3rd
        call_count = 0
        def mock_send_token(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise Exception("Network timeout")
            return "success_tx_hash"

        payout_service.solana_rpc.send_spl_token.side_effect = mock_send_token
        payout_service.solana_rpc.confirm_transaction.return_value = True

        with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
            result = await payout_service.process_payout(payout.id)

            # Verify exponential backoff delays
            expected_delays = [1, 2]  # 2^0, 2^1 seconds
            actual_delays = [call.args[0] for call in mock_sleep.call_args_list]
            assert actual_delays == expected_delays

        assert result.status == PayoutStatus.CONFIRMED
        assert result.retry_count == 2

    @pytest.mark.asyncio
    async def test_process_payout_max_retries_exceeded(self, payout_service, db_session, valid_wallet_address):
        """Test payout failure after maximum retry attempts."""
        payout = Payout(
            bounty_id=1,
            recipient_wallet=valid_wallet_address,
            amount=Decimal('800000.0'),
            status=PayoutStatus.PENDING
        )
        db_session.add(payout)
        db_session.commit()

        # Mock all attempts failing
        payout_service.solana_rpc.send_spl_token.side_effect = Exception("Persistent network error")

        with patch('asyncio.sleep', new_callable=AsyncMock):
            result = await payout_service.process_payout(payout.id)

        assert result.status == PayoutStatus.FAILED
        assert result.retry_count == 3
        assert "Persistent network error" in result.failure_reason

    @pytest.mark.asyncio
    async def test_transaction_confirmation_timeout(self, payout_service, db_session, valid_wallet_address):
        """Test handling of transaction confirmation timeouts."""
        payout = Payout(
            bounty_id=1,
            recipient_wallet=valid_wallet_address,
            amount=Decimal('800000.0'),
            status=PayoutStatus.PENDING
        )
        db_session.add(payout)
        db_session.commit()

        mock_tx_hash = "test_tx_hash"
        payout_service.solana_rpc.send_spl_token.return_value = mock_tx_hash
        payout_service.solana_rpc.confirm_transaction.return_value = False

        result = await payout_service.process_payout(payout.id)

        assert result.status == PayoutStatus.FAILED
        assert "Transaction confirmation timeout" in result.failure_reason
        assert result.transaction_hash == mock_tx_hash

    def test_generate_solscan_link(self, payout_service):
        """Test Solscan transaction link generation."""
        tx_hash = "5VqydpS8CzkqN5AExzBRzeMxZZnD8uVHJTX8JK8JKrYx"
        expected_link = f"https://solscan.io/tx/{tx_hash}"

        link = payout_service.generate_solscan_link(tx_hash)
        assert link == expected_link

    def test_generate_solscan_link_mainnet(self, payout_service):
        """Test Solscan link generation for mainnet transactions."""
        with patch.object(payout_service, 'network', 'mainnet-beta'):
            tx_hash = "test_hash"
            link = payout_service.generate_solscan_link(tx_hash)
            assert "?cluster=" not in link

    def test_generate_solscan_link_devnet(self, payout_service):
        """Test Solscan link generation for devnet transactions."""
        with patch.object(payout_service, 'network', 'devnet'):
            tx_hash = "test_hash"
            link = payout_service.generate_solscan_link(tx_hash)
            assert "?cluster=devnet" in link

    @pytest.mark.asyncio
    async def test_get_payout_queue(self, payout_service, db_session):
        """Test retrieval of payout queue with status filtering."""
        # Create test payouts with different statuses
        payouts = [
            Payout(bounty_id=1, recipient_wallet="wallet1", amount=Decimal('100'), status=PayoutStatus.PENDING),
            Payout(bounty_id=2, recipient_wallet="wallet2", amount=Decimal('200'), status=PayoutStatus.PROCESSING),
            Payout(bounty_id=3, recipient_wallet="wallet3", amount=Decimal('300'), status=PayoutStatus.CONFIRMED),
        ]
        for payout in payouts:
            db_session.add(payout)
        db_session.commit()

        # Test filtering by status
        pending_payouts = await payout_service.get_payout_queue(status=PayoutStatus.PENDING)
        assert len(pending_payouts) == 1
        assert pending_payouts[0].status == PayoutStatus.PENDING

        # Test getting all payouts
        all_payouts = await payout_service.get_payout_queue()
        assert len(all_payouts) == 3

    @pytest.mark.asyncio
    async def test_get_transaction_history(self, payout_service, db_session, valid_wallet_address):
        """Test transaction history retrieval with date filtering."""
        # Create historical payouts
        old_date = datetime.utcnow() - timedelta(days=10)
        recent_date = datetime.utcnow() - timedelta(hours=1)

        old_payout = Payout(
            bounty_id=1,
            recipient_wallet=valid_wallet_address,
            amount=Decimal('100'),
            status=PayoutStatus.CONFIRMED,
            created_at=old_date,
            processed_at=old_date
        )
        recent_payout = Payout(
            bounty_id=2,
            recipient_wallet=valid_wallet_address,
            amount=Decimal('200'),
            status=PayoutStatus.CONFIRMED,
            created_at=recent_date,
            processed_at=recent_date
        )

        db_session.add_all([old_payout, recent_payout])
        db_session.commit()

        # Test date filtering
        since_date = datetime.utcnow() - timedelta(days=2)
        recent_history = await payout_service.get_transaction_history(since_date=since_date)

        assert len(recent_history) == 1
        assert recent_history[0].bounty_id == 2

    def test_payout_lock_mechanism(self, payout_service, db_session):
        """Test payout locking mechanism to prevent concurrent processing."""
        payout = Payout(
            bounty_id=1,
            recipient_wallet="test_wallet",
            amount=Decimal('100'),
            status=PayoutStatus.PENDING
        )
        db_session.add(payout)
        db_session.commit()

        # Acquire lock
        success = payout_service.acquire_payout_lock(payout.id)
        assert success is True

        # Try to acquire same lock again
        duplicate_lock = payout_service.acquire_payout_lock(payout.id)
        assert duplicate_lock is False

        # Release lock
        payout_service.release_payout_lock(payout.id)

        # Should be able to acquire again
        reacquire = payout_service.acquire_payout_lock(payout.id)
        assert reacquire is True
