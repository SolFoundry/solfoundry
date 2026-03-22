"""Comprehensive tests for the Bounty Boost Mechanism (Issue #510).

Tests are named after acceptance criteria from the spec:
1. Boost endpoint: POST /api/bounty/{id}/boost
2. On-chain: escrow PDA transfer
3. Bounty display: original + boosted separately
4. Boost leaderboard: top boosters per bounty
5. Boost history on bounty detail page
6. Minimum boost: 1,000 $FNDRY
7. Refund if bounty expires without completion
8. Telegram notification to owner on boost
9. Frontend: boost button + amount input (covered by frontend tests)
10. Tests for boost lifecycle including refund

All tests use SQLite in-memory database for isolation and speed.
Auth is enabled to verify authorization checks.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database import Base
from app.models.boost import (
    MINIMUM_BOOST_AMOUNT,
    BoostCreate,
    BoostStatus,
    BoostTable,
)
from app.models.notification import NotificationDB
from app.services.boost_service import (
    BoostNotFoundError,
    BoostService,
    BountyNotBoostableError,
    DuplicateTransactionError,
    InsufficientBoostAmountError,
    WalletVerificationError,
    verify_wallet_signature,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_ENGINE = create_async_engine("sqlite+aiosqlite:///:memory:")
TEST_SESSION_FACTORY = async_sessionmaker(
    TEST_ENGINE,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop after."""
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """Provide a clean database session for each test."""
    async with TEST_SESSION_FACTORY() as session:
        yield session
        await session.rollback()


@pytest.fixture
def bounty_id() -> str:
    """Generate a test bounty ID."""
    return str(uuid.uuid4())


@pytest.fixture
def user_id() -> str:
    """Generate a test user ID."""
    return str(uuid.uuid4())


@pytest.fixture
def creator_id() -> str:
    """Generate a test bounty creator ID."""
    return str(uuid.uuid4())


@pytest.fixture
def valid_boost_data() -> BoostCreate:
    """Create a valid boost request payload."""
    return BoostCreate(
        amount=Decimal("5000"),
        wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
        wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
        message="Let's go!",
    )


@pytest.fixture
def service(db_session: AsyncSession) -> BoostService:
    """Create a BoostService instance."""
    return BoostService(db_session)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _insert_boost(
    session: AsyncSession,
    bounty_id: str,
    user_id: str,
    amount: Decimal = Decimal("5000"),
    wallet: str = "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
    status: str = BoostStatus.CONFIRMED.value,
) -> BoostTable:
    """Insert a boost record directly into the database for testing."""
    boost = BoostTable(
        id=str(uuid.uuid4()),
        bounty_id=bounty_id,
        booster_user_id=user_id,
        booster_wallet=wallet,
        amount=amount,
        status=status,
        escrow_tx_hash=str(uuid.uuid4()),
        message="Test boost",
    )
    session.add(boost)
    await session.flush()
    return boost


# ===========================================================================
# SPEC: Boost endpoint POST /api/bounty/{id}/boost with amount and wallet
# ===========================================================================


class TestSpecBoostEndpointCreate:
    """Tests for the boost creation endpoint (acceptance criterion #1)."""

    @pytest.mark.asyncio
    async def test_spec_create_boost_success(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """Creating a boost with valid data should succeed and return a confirmed boost."""
        result = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )

        assert result.bounty_id == bounty_id
        assert result.booster_user_id == user_id
        assert result.amount == Decimal("5000")
        assert result.status == BoostStatus.CONFIRMED.value
        assert result.escrow_tx_hash is not None
        assert result.message == "Let's go!"

    @pytest.mark.asyncio
    async def test_spec_create_boost_in_progress_bounty(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """Boosts should be allowed on in_progress bounties too."""
        result = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="in_progress",
            bounty_creator_id=creator_id,
        )

        assert result.status == BoostStatus.CONFIRMED.value

    @pytest.mark.asyncio
    async def test_spec_create_boost_records_wallet_address(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """The boost should record the booster's wallet address."""
        result = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )

        assert result.booster_wallet == "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"


# ===========================================================================
# SPEC: On-chain escrow PDA transfer
# ===========================================================================


class TestSpecOnChainEscrowTransfer:
    """Tests for on-chain escrow transfer (acceptance criterion #2)."""

    @pytest.mark.asyncio
    async def test_spec_escrow_tx_hash_recorded(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """Each boost should have an escrow transaction hash recorded."""
        result = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )

        assert result.escrow_tx_hash is not None
        assert len(result.escrow_tx_hash) > 0

    @pytest.mark.asyncio
    async def test_spec_escrow_tx_hash_unique(
        self, service, db_session, bounty_id, user_id, creator_id
    ):
        """Each boost should have a unique escrow transaction hash."""
        data1 = BoostCreate(
            amount=Decimal("5000"),
            wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
            wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
        )
        data2 = BoostCreate(
            amount=Decimal("10000"),
            wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
            wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
        )

        result1 = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=data1,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )
        result2 = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=data2,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )

        assert result1.escrow_tx_hash != result2.escrow_tx_hash


# ===========================================================================
# SPEC: Bounty display shows original + boosted amount separately
# ===========================================================================


class TestSpecBountyDisplayRewardBreakdown:
    """Tests for reward breakdown display (acceptance criterion #3)."""

    @pytest.mark.asyncio
    async def test_spec_summary_shows_original_and_boosted_separately(
        self, service, db_session, bounty_id, user_id
    ):
        """Summary should show original and boosted amounts as separate fields."""
        await _insert_boost(db_session, bounty_id, user_id, Decimal("5000"))
        await _insert_boost(db_session, bounty_id, user_id, Decimal("3000"))

        summary = await service.get_boost_summary(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )

        assert summary.original_reward == Decimal("100000")
        assert summary.total_boosted == Decimal("8000")
        assert summary.effective_reward == Decimal("108000")

    @pytest.mark.asyncio
    async def test_spec_summary_zero_boosts(self, service, db_session, bounty_id):
        """Summary with no boosts should show zero boosted amount."""
        summary = await service.get_boost_summary(
            bounty_id=bounty_id,
            original_reward=Decimal("50000"),
        )

        assert summary.original_reward == Decimal("50000")
        assert summary.total_boosted == Decimal("0")
        assert summary.effective_reward == Decimal("50000")
        assert summary.boost_count == 0
        assert summary.top_booster_wallet is None

    @pytest.mark.asyncio
    async def test_spec_summary_excludes_refunded_boosts(
        self, service, db_session, bounty_id, user_id
    ):
        """Refunded boosts should not count toward the total boosted amount."""
        await _insert_boost(
            db_session, bounty_id, user_id, Decimal("5000"),
            status=BoostStatus.CONFIRMED.value,
        )
        await _insert_boost(
            db_session, bounty_id, user_id, Decimal("3000"),
            status=BoostStatus.REFUNDED.value,
        )

        summary = await service.get_boost_summary(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )

        # Only confirmed boost counts
        assert summary.total_boosted == Decimal("5000")
        assert summary.effective_reward == Decimal("105000")
        assert summary.boost_count == 1


# ===========================================================================
# SPEC: Boost leaderboard — top boosters per bounty
# ===========================================================================


class TestSpecBoostLeaderboard:
    """Tests for boost leaderboard (acceptance criterion #4)."""

    @pytest.mark.asyncio
    async def test_spec_leaderboard_ranked_by_total_amount(
        self, service, db_session, bounty_id
    ):
        """Leaderboard should rank boosters by total contribution descending."""
        user1 = str(uuid.uuid4())
        user2 = str(uuid.uuid4())
        wallet1 = "11111111111111111111111111111111"
        wallet2 = "22222222222222222222222222222222"

        # User1: two boosts = 8000 total
        await _insert_boost(
            db_session, bounty_id, user1, Decimal("5000"), wallet=wallet1
        )
        await _insert_boost(
            db_session, bounty_id, user1, Decimal("3000"), wallet=wallet1
        )
        # User2: one boost = 10000
        await _insert_boost(
            db_session, bounty_id, user2, Decimal("10000"), wallet=wallet2
        )

        leaderboard = await service.get_boost_leaderboard(bounty_id)

        assert len(leaderboard.entries) == 2
        assert leaderboard.entries[0].booster_wallet == wallet2
        assert leaderboard.entries[0].total_amount == Decimal("10000")
        assert leaderboard.entries[1].booster_wallet == wallet1
        assert leaderboard.entries[1].total_amount == Decimal("8000")

    @pytest.mark.asyncio
    async def test_spec_leaderboard_boost_count_per_wallet(
        self, service, db_session, bounty_id
    ):
        """Leaderboard should show the number of individual boosts per wallet."""
        user1 = str(uuid.uuid4())
        wallet1 = "11111111111111111111111111111111"

        await _insert_boost(
            db_session, bounty_id, user1, Decimal("5000"), wallet=wallet1
        )
        await _insert_boost(
            db_session, bounty_id, user1, Decimal("3000"), wallet=wallet1
        )

        leaderboard = await service.get_boost_leaderboard(bounty_id)

        assert leaderboard.entries[0].boost_count == 2

    @pytest.mark.asyncio
    async def test_spec_leaderboard_total_boosted_and_boosters(
        self, service, db_session, bounty_id
    ):
        """Leaderboard response should include total boosted and booster count."""
        user1 = str(uuid.uuid4())
        user2 = str(uuid.uuid4())

        await _insert_boost(
            db_session, bounty_id, user1, Decimal("5000"),
            wallet="11111111111111111111111111111111",
        )
        await _insert_boost(
            db_session, bounty_id, user2, Decimal("10000"),
            wallet="22222222222222222222222222222222",
        )

        leaderboard = await service.get_boost_leaderboard(bounty_id)

        assert leaderboard.total_boosted == Decimal("15000")
        assert leaderboard.total_boosters == 2

    @pytest.mark.asyncio
    async def test_spec_leaderboard_empty_bounty(
        self, service, db_session, bounty_id
    ):
        """Leaderboard for a bounty with no boosts should be empty."""
        leaderboard = await service.get_boost_leaderboard(bounty_id)

        assert len(leaderboard.entries) == 0
        assert leaderboard.total_boosted == Decimal("0")
        assert leaderboard.total_boosters == 0

    @pytest.mark.asyncio
    async def test_spec_leaderboard_respects_limit(
        self, service, db_session, bounty_id
    ):
        """Leaderboard should respect the limit parameter."""
        for i in range(5):
            user = str(uuid.uuid4())
            wallet = f"{i + 1}" * 32
            await _insert_boost(
                db_session, bounty_id, user, Decimal(str((i + 1) * 1000)),
                wallet=wallet[:44],
            )

        leaderboard = await service.get_boost_leaderboard(bounty_id, limit=3)
        assert len(leaderboard.entries) == 3


# ===========================================================================
# SPEC: Boost history on bounty detail page
# ===========================================================================


class TestSpecBoostHistory:
    """Tests for boost history (acceptance criterion #5)."""

    @pytest.mark.asyncio
    async def test_spec_history_returns_all_boosts(
        self, service, db_session, bounty_id, user_id
    ):
        """History should return all boosts for a bounty, newest first."""
        await _insert_boost(db_session, bounty_id, user_id, Decimal("1000"))
        await _insert_boost(db_session, bounty_id, user_id, Decimal("2000"))
        await _insert_boost(db_session, bounty_id, user_id, Decimal("3000"))

        history = await service.get_boost_history(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )

        assert history.total == 3
        assert len(history.items) == 3
        assert history.bounty_id == bounty_id

    @pytest.mark.asyncio
    async def test_spec_history_includes_reward_breakdown(
        self, service, db_session, bounty_id, user_id
    ):
        """History should include original, boosted, and effective reward amounts."""
        await _insert_boost(db_session, bounty_id, user_id, Decimal("5000"))

        history = await service.get_boost_history(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )

        assert history.original_reward == Decimal("100000")
        assert history.total_boosted == Decimal("5000")
        assert history.effective_reward == Decimal("105000")

    @pytest.mark.asyncio
    async def test_spec_history_pagination(
        self, service, db_session, bounty_id, user_id
    ):
        """History should support pagination with skip and limit."""
        for _ in range(5):
            await _insert_boost(db_session, bounty_id, user_id, Decimal("1000"))

        history = await service.get_boost_history(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
            skip=2,
            limit=2,
        )

        assert history.total == 5
        assert len(history.items) == 2

    @pytest.mark.asyncio
    async def test_spec_history_includes_refunded_boosts(
        self, service, db_session, bounty_id, user_id
    ):
        """History should include both confirmed and refunded boosts."""
        await _insert_boost(
            db_session, bounty_id, user_id, Decimal("5000"),
            status=BoostStatus.CONFIRMED.value,
        )
        await _insert_boost(
            db_session, bounty_id, user_id, Decimal("3000"),
            status=BoostStatus.REFUNDED.value,
        )

        history = await service.get_boost_history(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )

        assert history.total == 2
        statuses = {item.status for item in history.items}
        assert BoostStatus.CONFIRMED.value in statuses
        assert BoostStatus.REFUNDED.value in statuses


# ===========================================================================
# SPEC: Minimum boost 1,000 $FNDRY
# ===========================================================================


class TestSpecMinimumBoostAmount:
    """Tests for minimum boost enforcement (acceptance criterion #6)."""

    @pytest.mark.asyncio
    async def test_spec_minimum_boost_exactly_1000_accepted(
        self, service, db_session, bounty_id, user_id, creator_id
    ):
        """A boost of exactly 1,000 $FNDRY should be accepted."""
        data = BoostCreate(
            amount=Decimal("1000"),
            wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
            wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
        )
        result = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )
        assert result.amount == Decimal("1000")

    def test_spec_minimum_boost_below_1000_rejected_by_pydantic(self):
        """A boost below 1,000 $FNDRY should be rejected at the schema level."""
        with pytest.raises(Exception):
            BoostCreate(
                amount=Decimal("999"),
                wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
                wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
            )

    @pytest.mark.asyncio
    async def test_spec_minimum_boost_service_level_check(
        self, service, db_session, bounty_id, user_id, creator_id
    ):
        """The service layer should also reject boosts below the minimum."""
        # Bypass Pydantic by creating with valid amount then patching
        data = BoostCreate(
            amount=Decimal("1000"),
            wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
            wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
        )
        # Monkey-patch to test service-level validation
        data_dict = data.model_dump()
        data_dict["amount"] = Decimal("500")

        with pytest.raises(InsufficientBoostAmountError):
            # Create a patched BoostCreate to bypass Pydantic
            patched_data = BoostCreate.model_construct(**data_dict)
            await service.create_boost(
                bounty_id=bounty_id,
                user_id=user_id,
                data=patched_data,
                bounty_status="open",
                bounty_creator_id=creator_id,
            )


# ===========================================================================
# SPEC: Refund if bounty expires without completion
# ===========================================================================


class TestSpecRefundOnExpiry:
    """Tests for refund on bounty expiry (acceptance criterion #7)."""

    @pytest.mark.asyncio
    async def test_spec_refund_all_confirmed_boosts(
        self, service, db_session, bounty_id, user_id
    ):
        """All confirmed boosts should be refunded when a bounty expires."""
        await _insert_boost(db_session, bounty_id, user_id, Decimal("5000"))
        await _insert_boost(db_session, bounty_id, user_id, Decimal("3000"))

        refunded = await service.process_expired_bounty_refunds(bounty_id)

        assert len(refunded) == 2
        for boost in refunded:
            assert boost.status == BoostStatus.REFUNDED.value
            assert boost.refund_tx_hash is not None
            assert boost.refunded_at is not None

    @pytest.mark.asyncio
    async def test_spec_refund_skips_already_refunded(
        self, service, db_session, bounty_id, user_id
    ):
        """Already-refunded boosts should not be refunded again."""
        await _insert_boost(
            db_session, bounty_id, user_id, Decimal("5000"),
            status=BoostStatus.CONFIRMED.value,
        )
        await _insert_boost(
            db_session, bounty_id, user_id, Decimal("3000"),
            status=BoostStatus.REFUNDED.value,
        )

        refunded = await service.process_expired_bounty_refunds(bounty_id)

        # Only the confirmed one should be refunded
        assert len(refunded) == 1
        assert refunded[0].amount == Decimal("5000")

    @pytest.mark.asyncio
    async def test_spec_refund_records_tx_hash(
        self, service, db_session, bounty_id, user_id
    ):
        """Each refunded boost should have a unique refund transaction hash."""
        await _insert_boost(db_session, bounty_id, user_id, Decimal("5000"))
        await _insert_boost(db_session, bounty_id, user_id, Decimal("3000"))

        refunded = await service.process_expired_bounty_refunds(bounty_id)

        tx_hashes = {b.refund_tx_hash for b in refunded}
        assert len(tx_hashes) == 2  # All unique
        assert None not in tx_hashes

    @pytest.mark.asyncio
    async def test_spec_refund_updates_status_in_database(
        self, service, db_session, bounty_id, user_id
    ):
        """Refunded boosts should have REFUNDED status persisted in the DB."""
        boost = await _insert_boost(db_session, bounty_id, user_id, Decimal("5000"))

        await service.process_expired_bounty_refunds(bounty_id)
        await db_session.flush()

        # Re-query from DB
        result = await db_session.execute(
            select(BoostTable).where(BoostTable.id == boost.id)
        )
        db_boost = result.scalar_one()
        assert db_boost.status == BoostStatus.REFUNDED.value

    @pytest.mark.asyncio
    async def test_spec_refund_no_boosts_returns_empty(
        self, service, db_session, bounty_id
    ):
        """Refunding a bounty with no boosts should return an empty list."""
        refunded = await service.process_expired_bounty_refunds(bounty_id)
        assert refunded == []


# ===========================================================================
# SPEC: Telegram notification to owner on boost
# ===========================================================================


class TestSpecTelegramNotificationOnBoost:
    """Tests for Telegram notification (acceptance criterion #8)."""

    @pytest.mark.asyncio
    async def test_spec_notification_created_on_boost(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """A notification should be created for the bounty owner when boosted."""
        await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )
        await db_session.flush()

        # Query for the notification using uuid.UUID for SQLite compat
        creator_uuid = uuid.UUID(creator_id)
        result = await db_session.execute(
            select(NotificationDB).where(
                NotificationDB.user_id == creator_uuid
            )
        )
        notification = result.scalar_one_or_none()

        assert notification is not None
        assert notification.notification_type == "bounty_boosted"
        assert "boost" in notification.title.lower()
        assert "5,000" in notification.message
        # Compare as strings to handle UUID vs str differences
        assert str(notification.bounty_id) == bounty_id

    @pytest.mark.asyncio
    async def test_spec_notification_includes_telegram_channel(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """The notification metadata should indicate Telegram as the channel."""
        await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )
        await db_session.flush()

        creator_uuid = uuid.UUID(creator_id)
        result = await db_session.execute(
            select(NotificationDB).where(
                NotificationDB.user_id == creator_uuid
            )
        )
        notification = result.scalar_one()

        assert notification.extra_data is not None
        assert notification.extra_data.get("channel") == "telegram"

    @pytest.mark.asyncio
    async def test_spec_notification_includes_boost_amount(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """The notification should include the boost amount."""
        await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )
        await db_session.flush()

        creator_uuid = uuid.UUID(creator_id)
        result = await db_session.execute(
            select(NotificationDB).where(
                NotificationDB.user_id == creator_uuid
            )
        )
        notification = result.scalar_one()

        assert notification.extra_data["amount"] == "5000"


# ===========================================================================
# SPEC: Tests for boost lifecycle including refund
# ===========================================================================


class TestSpecBoostLifecycle:
    """Full lifecycle tests (acceptance criterion #10)."""

    @pytest.mark.asyncio
    async def test_spec_full_lifecycle_create_then_refund(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """A boost should go through: create (confirmed) -> refund (refunded)."""
        # Step 1: Create boost
        created = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=valid_boost_data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )
        assert created.status == BoostStatus.CONFIRMED.value

        # Step 2: Verify in summary
        summary = await service.get_boost_summary(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )
        assert summary.total_boosted == Decimal("5000")
        assert summary.boost_count == 1

        # Step 3: Process refund (bounty expired)
        refunded = await service.process_expired_bounty_refunds(bounty_id)
        assert len(refunded) == 1
        assert refunded[0].status == BoostStatus.REFUNDED.value

        # Step 4: Summary should now show zero
        summary_after = await service.get_boost_summary(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )
        assert summary_after.total_boosted == Decimal("0")
        assert summary_after.boost_count == 0

    @pytest.mark.asyncio
    async def test_spec_multiple_boosts_same_bounty(
        self, service, db_session, bounty_id, creator_id
    ):
        """Multiple users should be able to boost the same bounty."""
        for i in range(3):
            user = str(uuid.uuid4())
            data = BoostCreate(
                amount=Decimal(str((i + 1) * 1000)),
                wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
                wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
            )
            await service.create_boost(
                bounty_id=bounty_id,
                user_id=user,
                data=data,
                bounty_status="open",
                bounty_creator_id=creator_id,
            )

        summary = await service.get_boost_summary(
            bounty_id=bounty_id,
            original_reward=Decimal("100000"),
        )
        # 1000 + 2000 + 3000 = 6000
        assert summary.total_boosted == Decimal("6000")
        assert summary.boost_count == 3

    @pytest.mark.asyncio
    async def test_spec_boost_isolated_between_bounties(
        self, service, db_session, user_id, creator_id
    ):
        """Boosts on one bounty should not affect another bounty's totals."""
        bounty_a = str(uuid.uuid4())
        bounty_b = str(uuid.uuid4())

        data = BoostCreate(
            amount=Decimal("5000"),
            wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
            wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
        )

        await service.create_boost(
            bounty_id=bounty_a,
            user_id=user_id,
            data=data,
            bounty_status="open",
            bounty_creator_id=creator_id,
        )

        summary_b = await service.get_boost_summary(
            bounty_id=bounty_b,
            original_reward=Decimal("100000"),
        )
        assert summary_b.total_boosted == Decimal("0")


# ===========================================================================
# AUTHORIZATION: Not-boostable states
# ===========================================================================


class TestBoostAuthorizationAndValidation:
    """Tests for authorization and validation beyond the spec basics."""

    @pytest.mark.asyncio
    async def test_boost_completed_bounty_rejected(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """Boosting a completed bounty should be rejected."""
        with pytest.raises(BountyNotBoostableError):
            await service.create_boost(
                bounty_id=bounty_id,
                user_id=user_id,
                data=valid_boost_data,
                bounty_status="completed",
                bounty_creator_id=creator_id,
            )

    @pytest.mark.asyncio
    async def test_boost_paid_bounty_rejected(
        self, service, db_session, bounty_id, user_id, creator_id, valid_boost_data
    ):
        """Boosting a paid bounty should be rejected."""
        with pytest.raises(BountyNotBoostableError):
            await service.create_boost(
                bounty_id=bounty_id,
                user_id=user_id,
                data=valid_boost_data,
                bounty_status="paid",
                bounty_creator_id=creator_id,
            )

    def test_invalid_wallet_address_rejected(self):
        """An invalid wallet address should be rejected at schema level."""
        with pytest.raises(Exception):
            BoostCreate(
                amount=Decimal("5000"),
                wallet_address="not-a-valid-address!",
                wallet_signature="SKIP_VERIFICATION_DEV_ONLY",
            )

    def test_empty_wallet_signature_rejected(self):
        """An empty wallet signature should be rejected at schema level."""
        with pytest.raises(Exception):
            BoostCreate(
                amount=Decimal("5000"),
                wallet_address="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
                wallet_signature="",
            )


# ===========================================================================
# WALLET SIGNATURE VERIFICATION
# ===========================================================================


class TestWalletSignatureVerification:
    """Tests for wallet signature verification."""

    def test_dev_mode_skip_verification(self):
        """Dev-mode skip token should be accepted when solders is not available."""
        result = verify_wallet_signature(
            "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF",
            "SKIP_VERIFICATION_DEV_ONLY",
            "test message",
        )
        # In dev mode without solders, the skip token should work
        assert result is True


# ===========================================================================
# EXCEPTION TYPES
# ===========================================================================


class TestBoostExceptions:
    """Tests for typed exception classes with HTTP status mapping."""

    def test_boost_not_found_error_status(self):
        """BoostNotFoundError should have status 404."""
        error = BoostNotFoundError()
        assert error.status_code == 404

    def test_bounty_not_boostable_error_status(self):
        """BountyNotBoostableError should have status 400."""
        error = BountyNotBoostableError("completed")
        assert error.status_code == 400
        assert "completed" in error.message

    def test_insufficient_boost_amount_error_status(self):
        """InsufficientBoostAmountError should have status 400."""
        error = InsufficientBoostAmountError(Decimal("500"))
        assert error.status_code == 400
        assert "500" in error.message

    def test_duplicate_transaction_error_status(self):
        """DuplicateTransactionError should have status 409."""
        error = DuplicateTransactionError("abc123")
        assert error.status_code == 409
        assert "abc123" in error.message

    def test_wallet_verification_error_status(self):
        """WalletVerificationError should have status 403."""
        error = WalletVerificationError("bad sig")
        assert error.status_code == 403
        assert "bad sig" in error.message
