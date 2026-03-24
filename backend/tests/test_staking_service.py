"""Service-level integration tests for staking_service.py.

Runs every public service function against an in-memory SQLite database
so we test real SQL queries, constraint behaviour, and reward maths —
none of this is mocked.
"""

from __future__ import annotations

import asyncio
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.database import init_db, get_db_session
from app.models.staking import (
    UNSTAKE_COOLDOWN_DAYS,
    StakingPositionTable,
    calculate_rewards,
    get_tier,
)
from app.services import staking_service

WALLET_A = "WalletAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
WALLET_B = "WalletBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SIG = "testsig_0000000000000000000000000000000000000000000000"


# ---------------------------------------------------------------------------
# Session-scoped setup
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def setup_db(event_loop):
    event_loop.run_until_complete(init_db())


# ---------------------------------------------------------------------------
# Per-test DB cleanup
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clean_db(event_loop):
    """Wipe staking tables before each test so tests are fully isolated."""

    async def _wipe():
        from sqlalchemy import text

        async with get_db_session() as session:
            await session.execute(text("DELETE FROM staking_events"))
            await session.execute(text("DELETE FROM staking_positions"))
            await session.commit()

    event_loop.run_until_complete(_wipe())
    yield
    event_loop.run_until_complete(_wipe())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _backdate_position(wallet: str, days_ago: int):
    """Backdate staked_at and last_reward_claim so rewards accrue."""

    async def _do():
        then = datetime.now(timezone.utc) - timedelta(days=days_ago)
        async with get_db_session() as session:
            pos = await session.get(StakingPositionTable, wallet)
            pos.staked_at = then
            pos.last_reward_claim = then
            await session.commit()

    run(_do())


def _set_cooldown_to_expired(wallet: str):
    """Set cooldown_started_at to 8 days ago so it can be completed."""

    async def _do():
        expired = datetime.now(timezone.utc) - timedelta(days=UNSTAKE_COOLDOWN_DAYS + 1)
        async with get_db_session() as session:
            pos = await session.get(StakingPositionTable, wallet)
            pos.cooldown_started_at = expired
            await session.commit()

    run(_do())


# ---------------------------------------------------------------------------
# get_position
# ---------------------------------------------------------------------------


class TestGetPosition:
    def test_unknown_wallet_returns_zero_state(self):
        pos = run(staking_service.get_position(WALLET_A))
        assert pos.staked_amount == 0.0
        assert pos.tier == "none"
        assert pos.cooldown_active is False
        assert pos.rewards_available == 0.0

    def test_returns_position_after_stake(self):
        run(staking_service.record_stake(WALLET_A, 1000.0, SIG))
        pos = run(staking_service.get_position(WALLET_A))
        assert pos.staked_amount == 1000.0
        assert pos.tier == "bronze"

    def test_tier_upgrades_with_more_stake(self):
        run(staking_service.record_stake(WALLET_A, 50_000.0, SIG))
        pos = run(staking_service.get_position(WALLET_A))
        assert pos.tier == "gold"
        assert pos.apy == pytest.approx(0.12)

    def test_rewards_accrue_over_time(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=30)
        pos = run(staking_service.get_position(WALLET_A))
        # 10k at 8% for 30 days ≈ 65.75 FNDRY
        assert pos.rewards_available > 60.0
        assert pos.rewards_available < 70.0


# ---------------------------------------------------------------------------
# record_stake
# ---------------------------------------------------------------------------


class TestRecordStake:
    def test_creates_new_position_on_first_stake(self):
        pos = run(staking_service.record_stake(WALLET_A, 5_000.0, SIG))
        assert pos.staked_amount == 5_000.0
        assert pos.tier == "silver"
        assert pos.staked_at is not None

    def test_adds_to_existing_stake(self):
        run(staking_service.record_stake(WALLET_A, 5_000.0, SIG))
        pos = run(staking_service.record_stake(WALLET_A, 5_000.0, SIG + "2"))
        assert pos.staked_amount == 10_000.0

    def test_staking_logs_event(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        history = run(staking_service.get_history(WALLET_A))
        assert history.total == 1
        assert history.items[0].event_type == "stake"
        assert history.items[0].amount == pytest.approx(1_000.0)
        assert history.items[0].signature == SIG

    def test_second_stake_accrues_pending_rewards(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=365)
        # Second stake should checkpoint accrued rewards before adding
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG + "2"))

        async def _get_accrued():
            async with get_db_session() as session:
                pos = await session.get(StakingPositionTable, WALLET_A)
                return float(pos.rewards_accrued or 0)

        accrued = run(_get_accrued())
        # ~800 FNDRY after 1 year at 8% on 10k
        assert accrued > 700.0

    def test_negative_amount_raises(self):
        with pytest.raises(ValueError, match="positive"):
            run(staking_service.record_stake(WALLET_A, -100.0, SIG))

    def test_zero_amount_raises(self):
        with pytest.raises(ValueError, match="positive"):
            run(staking_service.record_stake(WALLET_A, 0.0, SIG))


# ---------------------------------------------------------------------------
# initiate_unstake
# ---------------------------------------------------------------------------


class TestInitiateUnstake:
    def test_sets_cooldown(self):
        run(staking_service.record_stake(WALLET_A, 2_000.0, SIG))
        pos = run(staking_service.initiate_unstake(WALLET_A, 1_000.0))
        assert pos.cooldown_active is True
        assert pos.unstake_amount == pytest.approx(1_000.0)
        assert pos.cooldown_ends_at is not None
        assert pos.unstake_ready is False

    def test_logs_unstake_initiated_event(self):
        run(staking_service.record_stake(WALLET_A, 2_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 500.0))
        history = run(staking_service.get_history(WALLET_A))
        events = [e.event_type for e in history.items]
        assert "unstake_initiated" in events

    def test_no_position_raises(self):
        with pytest.raises(ValueError, match="No staked position"):
            run(staking_service.initiate_unstake(WALLET_A, 100.0))

    def test_amount_exceeds_staked_raises(self):
        run(staking_service.record_stake(WALLET_A, 500.0, SIG))
        with pytest.raises(ValueError, match="Cannot unstake"):
            run(staking_service.initiate_unstake(WALLET_A, 9_999.0))

    def test_duplicate_cooldown_raises(self):
        run(staking_service.record_stake(WALLET_A, 2_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 500.0))
        with pytest.raises(ValueError, match="already in progress"):
            run(staking_service.initiate_unstake(WALLET_A, 500.0))

    def test_accrues_rewards_at_initiation(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=30)
        run(staking_service.initiate_unstake(WALLET_A, 1_000.0))

        async def _get_accrued():
            async with get_db_session() as session:
                pos = await session.get(StakingPositionTable, WALLET_A)
                return float(pos.rewards_accrued or 0)

        accrued = run(_get_accrued())
        assert accrued > 60.0


# ---------------------------------------------------------------------------
# complete_unstake
# ---------------------------------------------------------------------------


class TestCompleteUnstake:
    def test_reduces_staked_amount(self):
        run(staking_service.record_stake(WALLET_A, 2_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 500.0))
        _set_cooldown_to_expired(WALLET_A)
        pos = run(staking_service.complete_unstake(WALLET_A, SIG + "_complete"))
        assert pos.staked_amount == pytest.approx(1_500.0)
        assert pos.cooldown_active is False
        assert pos.unstake_amount == 0.0

    def test_full_unstake_clears_staked_at(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 1_000.0))
        _set_cooldown_to_expired(WALLET_A)
        pos = run(staking_service.complete_unstake(WALLET_A, SIG + "_complete"))
        assert pos.staked_amount == 0.0
        assert pos.staked_at is None

    def test_logs_unstake_completed_event(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 1_000.0))
        _set_cooldown_to_expired(WALLET_A)
        run(staking_service.complete_unstake(WALLET_A, SIG + "_complete"))
        history = run(staking_service.get_history(WALLET_A))
        assert any(e.event_type == "unstake_completed" for e in history.items)

    def test_cooldown_not_elapsed_raises(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 500.0))
        # Do NOT expire the cooldown — should raise
        with pytest.raises(ValueError, match="Cooldown not complete"):
            run(staking_service.complete_unstake(WALLET_A, SIG + "_complete"))

    def test_no_cooldown_in_progress_raises(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        with pytest.raises(ValueError, match="No unstake in progress"):
            run(staking_service.complete_unstake(WALLET_A, SIG + "_complete"))

    def test_no_position_raises(self):
        with pytest.raises(ValueError, match="No unstake in progress"):
            run(staking_service.complete_unstake(WALLET_A, SIG))


# ---------------------------------------------------------------------------
# claim_rewards
# ---------------------------------------------------------------------------


class TestClaimRewards:
    def test_claim_returns_positive_amount(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=30)
        pos, claimed = run(staking_service.claim_rewards(WALLET_A))
        assert claimed > 0.0
        # Rewards available should now be ~0 (just claimed)
        assert pos.rewards_available < 1.0

    def test_claim_resets_accrued_rewards(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=180)
        run(staking_service.claim_rewards(WALLET_A))

        async def _get_accrued():
            async with get_db_session() as session:
                pos = await session.get(StakingPositionTable, WALLET_A)
                return float(pos.rewards_accrued or 0)

        assert run(_get_accrued()) == pytest.approx(0.0)

    def test_claim_logs_reward_claimed_event(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=30)
        run(staking_service.claim_rewards(WALLET_A))
        history = run(staking_service.get_history(WALLET_A))
        assert any(e.event_type == "reward_claimed" for e in history.items)

    def test_claim_reward_event_has_correct_amount(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=365)
        _, claimed = run(staking_service.claim_rewards(WALLET_A))
        history = run(staking_service.get_history(WALLET_A))
        reward_event = next(
            e for e in history.items if e.event_type == "reward_claimed"
        )
        assert reward_event.rewards_amount == pytest.approx(claimed, rel=1e-4)

    def test_no_position_raises(self):
        with pytest.raises(ValueError, match="No active staking position"):
            run(staking_service.claim_rewards(WALLET_A))

    def test_no_rewards_immediately_after_claim_raises(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=30)
        run(staking_service.claim_rewards(WALLET_A))
        # Immediately re-claim — negligible time has passed, no rewards yet
        with pytest.raises(ValueError, match="No rewards available"):
            run(staking_service.claim_rewards(WALLET_A))

    def test_unstaked_wallet_raises(self):
        """Wallet with zero stake cannot claim."""
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 1_000.0))
        _set_cooldown_to_expired(WALLET_A)
        run(staking_service.complete_unstake(WALLET_A, SIG + "_c"))
        with pytest.raises(ValueError, match="No active staking position"):
            run(staking_service.claim_rewards(WALLET_A))


# ---------------------------------------------------------------------------
# get_history
# ---------------------------------------------------------------------------


class TestGetHistory:
    def test_empty_for_unknown_wallet(self):
        history = run(staking_service.get_history(WALLET_A))
        assert history.total == 0
        assert history.items == []

    def test_records_appear_in_reverse_chronological_order(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.record_stake(WALLET_A, 500.0, SIG + "2"))
        history = run(staking_service.get_history(WALLET_A))
        assert history.total == 2
        # Most recent event first
        assert history.items[0].amount == pytest.approx(500.0)

    def test_limit_respected(self):
        for i in range(10):
            run(staking_service.record_stake(WALLET_A, 100.0, f"{SIG}{i}"))
        history = run(staking_service.get_history(WALLET_A, limit=3))
        assert len(history.items) == 3
        assert history.total == 10

    def test_offset_applied(self):
        for i in range(5):
            run(staking_service.record_stake(WALLET_A, float(100 + i), f"{SIG}{i}"))
        page1 = run(staking_service.get_history(WALLET_A, limit=3, offset=0))
        page2 = run(staking_service.get_history(WALLET_A, limit=3, offset=3))
        ids1 = {e.id for e in page1.items}
        ids2 = {e.id for e in page2.items}
        assert ids1.isdisjoint(ids2)

    def test_isolation_between_wallets(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.record_stake(WALLET_B, 2_000.0, SIG + "b"))
        history_a = run(staking_service.get_history(WALLET_A))
        assert all(e.wallet_address == WALLET_A for e in history_a.items)
        assert history_a.total == 1


# ---------------------------------------------------------------------------
# get_platform_stats
# ---------------------------------------------------------------------------


class TestGetPlatformStats:
    def test_empty_db_returns_zeros(self):
        stats = run(staking_service.get_platform_stats())
        assert stats.total_staked == 0.0
        assert stats.total_stakers == 0
        assert stats.total_rewards_paid == 0.0

    def test_counts_stakers_correctly(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.record_stake(WALLET_B, 5_000.0, SIG + "b"))
        stats = run(staking_service.get_platform_stats())
        assert stats.total_stakers == 2
        assert stats.total_staked == pytest.approx(6_000.0)

    def test_tier_distribution_bucketed_correctly(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))  # bronze
        run(staking_service.record_stake(WALLET_B, 50_000.0, SIG + "b"))  # gold
        stats = run(staking_service.get_platform_stats())
        assert stats.tier_distribution["bronze"] == 1
        assert stats.tier_distribution["gold"] == 1
        assert stats.tier_distribution["diamond"] == 0

    def test_rewards_paid_includes_claimed_rewards(self):
        run(staking_service.record_stake(WALLET_A, 10_000.0, SIG))
        _backdate_position(WALLET_A, days_ago=30)
        _, claimed = run(staking_service.claim_rewards(WALLET_A))
        stats = run(staking_service.get_platform_stats())
        assert stats.total_rewards_paid == pytest.approx(claimed, rel=1e-4)

    def test_fully_unstaked_wallets_excluded_from_count(self):
        run(staking_service.record_stake(WALLET_A, 1_000.0, SIG))
        run(staking_service.initiate_unstake(WALLET_A, 1_000.0))
        _set_cooldown_to_expired(WALLET_A)
        run(staking_service.complete_unstake(WALLET_A, SIG + "_c"))
        stats = run(staking_service.get_platform_stats())
        assert stats.total_stakers == 0
        assert stats.total_staked == 0.0


# ---------------------------------------------------------------------------
# Unit: get_tier boundary conditions
# ---------------------------------------------------------------------------


class TestGetTierBoundaries:
    @pytest.mark.parametrize(
        "amount, expected_tier",
        [
            (Decimal("0"), "none"),
            (Decimal("999.99"), "none"),
            (Decimal("1000"), "bronze"),
            (Decimal("9999.99"), "bronze"),
            (Decimal("10000"), "silver"),
            (Decimal("49999.99"), "silver"),
            (Decimal("50000"), "gold"),
            (Decimal("99999.99"), "gold"),
            (Decimal("100000"), "diamond"),
            (Decimal("1000000"), "diamond"),
        ],
    )
    def test_tier_at_boundary(self, amount, expected_tier):
        assert get_tier(amount)["tier"] == expected_tier


# ---------------------------------------------------------------------------
# Unit: calculate_rewards
# ---------------------------------------------------------------------------


class TestCalculateRewards:
    def test_zero_staked_returns_zero(self):
        now = datetime.now(timezone.utc)
        assert calculate_rewards(Decimal("0"), 0.05, now - timedelta(days=30), now) == 0

    def test_same_start_and_end_returns_zero(self):
        now = datetime.now(timezone.utc)
        assert calculate_rewards(Decimal("1000"), 0.05, now, now) == 0

    def test_end_before_start_returns_zero(self):
        now = datetime.now(timezone.utc)
        assert (
            calculate_rewards(Decimal("1000"), 0.05, now, now - timedelta(days=1)) == 0
        )

    def test_one_year_bronze(self):
        now = datetime.now(timezone.utc)
        # 1k at 5% APY for 1 year = 50 FNDRY
        result = calculate_rewards(
            Decimal("1000"), 0.05, now - timedelta(days=365), now
        )
        assert 49.0 < float(result) < 51.0

    def test_one_year_diamond(self):
        now = datetime.now(timezone.utc)
        # 100k at 18% APY for 1 year = 18k FNDRY
        result = calculate_rewards(
            Decimal("100000"), 0.18, now - timedelta(days=365), now
        )
        assert 17_900 < float(result) < 18_100

    def test_partial_year_proportional(self):
        now = datetime.now(timezone.utc)
        half = calculate_rewards(Decimal("10000"), 0.08, now - timedelta(days=182), now)
        full = calculate_rewards(Decimal("10000"), 0.08, now - timedelta(days=365), now)
        # Half year should be roughly half of full year
        assert abs(float(half) - float(full) / 2) < 5.0
