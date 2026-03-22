"""Staking business logic: stake, unstake, reward accrual, and event history.

All state lives in PostgreSQL (staking_positions + staking_events).
No in-memory cache — position is read fresh on every request so
reward calculation is always accurate.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.staking import (
    UNSTAKE_COOLDOWN_DAYS,
    StakingEventTable,
    StakingPositionTable,
    StakingStats,
    StakingPositionResponse,
    StakingEventResponse,
    StakingHistoryResponse,
    get_tier,
    calculate_rewards,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fmt(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _build_position_response(pos: StakingPositionTable) -> StakingPositionResponse:
    """Serialize a DB row → StakingPositionResponse, accruing pending rewards."""
    staked = Decimal(str(pos.staked_amount or 0))
    tier_info = get_tier(staked)

    # Accrue rewards since last claim
    now = _now()
    last_claim = pos.last_reward_claim or pos.staked_at or now
    if last_claim.tzinfo is None:
        last_claim = last_claim.replace(tzinfo=timezone.utc)
    pending = calculate_rewards(staked, tier_info["apy"], last_claim, now)
    rewards_available = float(pending)
    rewards_earned = float(pos.rewards_accrued or 0)

    # Cooldown state
    cooldown_active = False
    cooldown_ends_at = None
    unstake_ready = False

    if pos.cooldown_started_at:
        cd_start = pos.cooldown_started_at
        if cd_start.tzinfo is None:
            cd_start = cd_start.replace(tzinfo=timezone.utc)
        cd_end = cd_start + timedelta(days=UNSTAKE_COOLDOWN_DAYS)
        cooldown_ends_at = cd_end.isoformat()
        cooldown_active = now < cd_end
        unstake_ready = now >= cd_end

    return StakingPositionResponse(
        wallet_address=pos.wallet_address,
        staked_amount=float(staked),
        tier=tier_info["tier"],
        apy=tier_info["apy"],
        rep_boost=tier_info["rep_boost"],
        staked_at=_fmt(pos.staked_at),
        last_reward_claim=_fmt(pos.last_reward_claim),
        rewards_earned=rewards_earned,
        rewards_available=rewards_available,
        cooldown_started_at=_fmt(pos.cooldown_started_at),
        cooldown_ends_at=cooldown_ends_at,
        cooldown_active=cooldown_active,
        unstake_ready=unstake_ready,
        unstake_amount=float(pos.unstake_amount or 0),
    )


def _log_event(
    session: AsyncSession,
    wallet: str,
    event_type: str,
    amount: Decimal,
    signature: Optional[str] = None,
    rewards_amount: Optional[Decimal] = None,
    notes: Optional[str] = None,
) -> StakingEventTable:
    event = StakingEventTable(
        id=uuid4(),
        wallet_address=wallet,
        event_type=event_type,
        amount=amount,
        rewards_amount=rewards_amount,
        signature=signature,
        notes=notes,
        created_at=_now(),
    )
    session.add(event)
    return event


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


async def get_position(wallet: str) -> StakingPositionResponse:
    """Return the current staking position for a wallet (or zero-state)."""
    async with get_db_session() as session:
        pos = await session.get(StakingPositionTable, wallet)
        if pos is None:
            # Return empty position
            return StakingPositionResponse(
                wallet_address=wallet,
                staked_amount=0.0,
                tier="none",
                apy=0.0,
                rep_boost=1.0,
                staked_at=None,
                last_reward_claim=None,
                rewards_earned=0.0,
                rewards_available=0.0,
                cooldown_started_at=None,
                cooldown_ends_at=None,
                cooldown_active=False,
                unstake_ready=False,
                unstake_amount=0.0,
            )
        return _build_position_response(pos)


async def record_stake(
    wallet: str, amount: float, signature: str
) -> StakingPositionResponse:
    """Record a confirmed on-chain stake. Upserts position and logs event."""
    if amount <= 0:
        raise ValueError("amount must be positive")

    add_amount = Decimal(str(amount))
    now = _now()

    async with get_db_session() as session:
        pos = await session.get(StakingPositionTable, wallet)
        if pos is None:
            pos = StakingPositionTable(
                wallet_address=wallet,
                staked_amount=Decimal("0"),
                rewards_accrued=Decimal("0"),
                staked_at=now,
                last_reward_claim=now,
                updated_at=now,
            )
            session.add(pos)
        else:
            # Accrue pending rewards before updating the staked amount
            existing = Decimal(str(pos.staked_amount or 0))
            tier_info = get_tier(existing)
            last_claim = pos.last_reward_claim or pos.staked_at or now
            if last_claim and last_claim.tzinfo is None:
                last_claim = last_claim.replace(tzinfo=timezone.utc)
            if last_claim:
                pending = calculate_rewards(existing, tier_info["apy"], last_claim, now)
                pos.rewards_accrued = Decimal(str(pos.rewards_accrued or 0)) + pending
            pos.last_reward_claim = now

        pos.staked_amount = Decimal(str(pos.staked_amount or 0)) + add_amount
        pos.updated_at = now
        if pos.staked_at is None:
            pos.staked_at = now

        _log_event(session, wallet, "stake", add_amount, signature=signature)
        await session.commit()
        await session.refresh(pos)
        return _build_position_response(pos)


async def initiate_unstake(wallet: str, amount: float) -> StakingPositionResponse:
    """Begin the 7-day cooldown period for unstaking."""
    if amount <= 0:
        raise ValueError("amount must be positive")

    unstake_amount = Decimal(str(amount))
    now = _now()

    async with get_db_session() as session:
        pos = await session.get(StakingPositionTable, wallet)
        if pos is None or Decimal(str(pos.staked_amount or 0)) <= 0:
            raise ValueError("No staked position found")

        staked = Decimal(str(pos.staked_amount))
        if unstake_amount > staked:
            raise ValueError(
                f"Cannot unstake {amount} — only {float(staked):.6f} staked"
            )

        if pos.cooldown_started_at is not None:
            raise ValueError(
                "Unstake already in progress — wait for cooldown to expire"
            )

        # Accrue pending rewards
        tier_info = get_tier(staked)
        last_claim = pos.last_reward_claim or pos.staked_at or now
        if last_claim and last_claim.tzinfo is None:
            last_claim = last_claim.replace(tzinfo=timezone.utc)
        if last_claim:
            pending = calculate_rewards(staked, tier_info["apy"], last_claim, now)
            pos.rewards_accrued = Decimal(str(pos.rewards_accrued or 0)) + pending
        pos.last_reward_claim = now

        pos.cooldown_started_at = now
        pos.unstake_amount = unstake_amount
        pos.updated_at = now

        _log_event(
            session,
            wallet,
            "unstake_initiated",
            unstake_amount,
            notes=f"Cooldown until {(now + timedelta(days=UNSTAKE_COOLDOWN_DAYS)).isoformat()}",
        )
        await session.commit()
        await session.refresh(pos)
        return _build_position_response(pos)


async def complete_unstake(wallet: str, signature: str) -> StakingPositionResponse:
    """Complete the unstake after the cooldown period has elapsed."""
    now = _now()

    async with get_db_session() as session:
        pos = await session.get(StakingPositionTable, wallet)
        if pos is None or pos.cooldown_started_at is None:
            raise ValueError("No unstake in progress")

        cd_start = pos.cooldown_started_at
        if cd_start.tzinfo is None:
            cd_start = cd_start.replace(tzinfo=timezone.utc)
        cd_end = cd_start + timedelta(days=UNSTAKE_COOLDOWN_DAYS)
        if now < cd_end:
            remaining = (cd_end - now).total_seconds()
            raise ValueError(f"Cooldown not complete — {remaining:.0f}s remaining")

        unstake_amt = Decimal(str(pos.unstake_amount or 0))
        pos.staked_amount = max(
            Decimal("0"), Decimal(str(pos.staked_amount or 0)) - unstake_amt
        )
        pos.cooldown_started_at = None
        pos.unstake_amount = Decimal("0")
        pos.updated_at = now
        if pos.staked_amount == Decimal("0"):
            pos.staked_at = None

        _log_event(
            session, wallet, "unstake_completed", unstake_amt, signature=signature
        )
        await session.commit()
        await session.refresh(pos)
        return _build_position_response(pos)


async def claim_rewards(wallet: str) -> tuple[StakingPositionResponse, float]:
    """Claim all accrued rewards. Returns (updated position, amount_claimed)."""
    now = _now()

    async with get_db_session() as session:
        pos = await session.get(StakingPositionTable, wallet)
        if pos is None or Decimal(str(pos.staked_amount or 0)) <= 0:
            raise ValueError("No active staking position")

        staked = Decimal(str(pos.staked_amount))
        tier_info = get_tier(staked)
        last_claim = pos.last_reward_claim or pos.staked_at or now
        if last_claim and last_claim.tzinfo is None:
            last_claim = last_claim.replace(tzinfo=timezone.utc)
        pending = (
            calculate_rewards(staked, tier_info["apy"], last_claim, now)
            if last_claim
            else Decimal("0")
        )
        total_claimable = Decimal(str(pos.rewards_accrued or 0)) + pending

        if total_claimable <= 0:
            raise ValueError("No rewards available to claim")

        _log_event(
            session,
            wallet,
            "reward_claimed",
            total_claimable,
            rewards_amount=total_claimable,
        )

        pos.rewards_accrued = Decimal("0")
        pos.last_reward_claim = now
        pos.updated_at = now

        await session.commit()
        await session.refresh(pos)
        return _build_position_response(pos), float(total_claimable)


async def get_history(
    wallet: str, limit: int = 50, offset: int = 0
) -> StakingHistoryResponse:
    """Return paginated staking event history for a wallet."""
    async with get_db_session() as session:
        count_result = await session.execute(
            select(func.count()).where(StakingEventTable.wallet_address == wallet)
        )
        total = count_result.scalar_one()

        result = await session.execute(
            select(StakingEventTable)
            .where(StakingEventTable.wallet_address == wallet)
            .order_by(StakingEventTable.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = result.scalars().all()

        items = [
            StakingEventResponse(
                id=str(row.id),
                wallet_address=row.wallet_address,
                event_type=row.event_type,
                amount=float(row.amount or 0),
                rewards_amount=float(row.rewards_amount)
                if row.rewards_amount is not None
                else None,
                signature=row.signature,
                created_at=row.created_at.isoformat() if row.created_at else "",
            )
            for row in rows
        ]
        return StakingHistoryResponse(items=items, total=total)


async def get_platform_stats() -> StakingStats:
    """Aggregate global staking statistics."""
    async with get_db_session() as session:
        result = await session.execute(
            select(
                func.sum(StakingPositionTable.staked_amount).label("total_staked"),
                func.count(StakingPositionTable.wallet_address).label("total_stakers"),
            ).where(StakingPositionTable.staked_amount > 0)
        )
        row = result.one()
        total_staked = float(row.total_staked or 0)
        total_stakers = int(row.total_stakers or 0)

        # Rewards paid = sum of all reward_claimed events
        rewards_result = await session.execute(
            select(func.sum(StakingEventTable.rewards_amount)).where(
                StakingEventTable.event_type == "reward_claimed"
            )
        )
        total_rewards = float(rewards_result.scalar_one() or 0)

        # Tier distribution
        positions_result = await session.execute(
            select(StakingPositionTable.staked_amount).where(
                StakingPositionTable.staked_amount > 0
            )
        )
        tier_dist: dict[str, int] = {
            "bronze": 0,
            "silver": 0,
            "gold": 0,
            "diamond": 0,
            "none": 0,
        }
        total_apy = 0.0
        for (amt,) in positions_result.fetchall():
            info = get_tier(Decimal(str(amt)))
            tier_dist[info["tier"]] = tier_dist.get(info["tier"], 0) + 1
            total_apy += info["apy"]

        avg_apy = total_apy / total_stakers if total_stakers > 0 else 0.0

        return StakingStats(
            total_staked=total_staked,
            total_stakers=total_stakers,
            total_rewards_paid=total_rewards,
            avg_apy=avg_apy,
            tier_distribution=tier_dist,
        )
