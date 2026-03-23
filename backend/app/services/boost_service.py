"""Bounty boost service — community reward pool contributions.

Community members can add $FNDRY to any open bounty's prize pool.
Each boost is recorded in ``bounty_boosts`` and accumulated in the
escrow PDA alongside the original reward. Boosts are refunded when
a bounty expires or is cancelled without a winner.

Minimum boost: 1,000 $FNDRY (enforced at model and service level).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.database import get_db_session
from app.exceptions import (
    BoostBelowMinimumError,
    BoostInvalidBountyError,
)
from app.models.boost import (
    MINIMUM_BOOST_AMOUNT,
    BountyBoostTable,
    BoostLeaderboardResponse,
    BoostListResponse,
    BoostResponse,
    BoostStatus,
    BoostSummary,
    BoosterLeaderboardEntry,
)
from app.models.bounty_table import BountyTable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Telegram notification (best-effort, non-blocking)
# ---------------------------------------------------------------------------

_TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


async def _send_telegram(message: str) -> None:
    """Fire-and-forget Telegram notification. Logs on failure but never raises."""
    if not _TELEGRAM_TOKEN or not _TELEGRAM_CHAT_ID:
        logger.debug("Telegram not configured — skipping notification")
        return
    url = f"https://api.telegram.org/bot{_TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                url,
                json={
                    "chat_id": _TELEGRAM_CHAT_ID,
                    "text": message,
                    "parse_mode": "HTML",
                },
            )
    except Exception as exc:
        logger.warning("Telegram notification failed: %s", exc)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _row_to_response(row: BountyBoostTable) -> BoostResponse:
    return BoostResponse(
        id=str(row.id),
        bounty_id=str(row.bounty_id),
        booster_wallet=row.booster_wallet,
        amount=float(row.amount),
        status=BoostStatus(row.status),
        tx_hash=row.tx_hash,
        refund_tx_hash=row.refund_tx_hash,
        created_at=row.created_at,
    )


async def _get_bounty(db: AsyncSession, bounty_id: str) -> BountyTable | None:
    result = await db.execute(select(BountyTable).where(BountyTable.id == bounty_id))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def create_boost(
    bounty_id: str,
    booster_wallet: str,
    amount: float,
    tx_hash: str | None = None,
) -> BoostResponse:
    """Record a community boost contribution to a bounty's prize pool.

    Validates that:
    - The bounty exists and is in a boostable state (OPEN or IN_PROGRESS).
    - The amount meets the 1,000 $FNDRY minimum.

    On success, sends a Telegram notification to the bounty owner and
    emits an audit event.

    Args:
        bounty_id: UUID of the target bounty.
        booster_wallet: Solana base-58 wallet address of the booster.
        amount: $FNDRY amount to add to the prize pool.
        tx_hash: Optional on-chain SPL transfer signature; if provided the
            boost is immediately set to CONFIRMED, otherwise PENDING.

    Returns:
        The created :class:`BoostResponse`.

    Raises:
        BoostInvalidBountyError: If the bounty does not exist or is not open.
        BoostBelowMinimumError: If amount < 1,000 $FNDRY.
    """
    if amount < MINIMUM_BOOST_AMOUNT:
        raise BoostBelowMinimumError(
            f"Boost amount {amount:,.0f} is below the 1,000 $FNDRY minimum"
        )

    async with get_db_session() as db:
        bounty = await _get_bounty(db, bounty_id)
        if bounty is None:
            raise BoostInvalidBountyError(f"Bounty '{bounty_id}' not found")

        if str(bounty.status).lower() not in {"open", "in_progress"}:
            raise BoostInvalidBountyError(
                f"Bounty '{bounty_id}' has status '{bounty.status}' and cannot be boosted"
            )

        status = BoostStatus.CONFIRMED if tx_hash else BoostStatus.PENDING
        boost = BountyBoostTable(
            bounty_id=bounty_id,
            booster_wallet=booster_wallet,
            amount=amount,
            status=status.value,
            tx_hash=tx_hash,
        )
        db.add(boost)
        await db.commit()
        await db.refresh(boost)

        response = _row_to_response(boost)
        bounty_title = bounty.title

    audit_event(
        "bounty_boosted",
        bounty_id=bounty_id,
        booster_wallet=booster_wallet,
        amount=amount,
        status=status.value,
        tx_hash=tx_hash,
    )

    # Telegram notification — best effort
    await _send_telegram(
        f"🚀 <b>Bounty Boosted!</b>\n"
        f"Bounty: <b>{bounty_title}</b>\n"
        f"Booster: <code>{booster_wallet[:8]}…{booster_wallet[-4:]}</code>\n"
        f"Amount: <b>+{amount:,.0f} $FNDRY</b>"
    )

    return response


async def get_boosts(
    bounty_id: str, skip: int = 0, limit: int = 50
) -> BoostListResponse:
    """Return paginated boost history for a bounty (newest first).

    Args:
        bounty_id: UUID of the target bounty.
        skip: Pagination offset.
        limit: Maximum rows to return (capped at 100).

    Returns:
        A :class:`BoostListResponse` with confirmed boosts and aggregate total.
    """
    limit = min(limit, 100)
    async with get_db_session() as db:
        # Total confirmed count + sum
        agg_result = await db.execute(
            select(
                func.count(BountyBoostTable.id),
                func.coalesce(func.sum(BountyBoostTable.amount), 0),
            ).where(
                BountyBoostTable.bounty_id == bounty_id,
                BountyBoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        total, total_boosted = agg_result.one()

        rows_result = await db.execute(
            select(BountyBoostTable)
            .where(BountyBoostTable.bounty_id == bounty_id)
            .order_by(BountyBoostTable.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        rows = rows_result.scalars().all()

    return BoostListResponse(
        boosts=[_row_to_response(r) for r in rows],
        total=total,
        total_boosted=float(total_boosted),
    )


async def get_boost_summary(bounty_id: str, original_amount: float) -> BoostSummary:
    """Return a reward summary showing original + boosted amounts.

    Args:
        bounty_id: UUID of the target bounty.
        original_amount: The bounty's base reward_amount.

    Returns:
        A :class:`BoostSummary` with breakdown and totals.
    """
    async with get_db_session() as db:
        result = await db.execute(
            select(
                func.count(BountyBoostTable.id),
                func.coalesce(func.sum(BountyBoostTable.amount), 0),
            ).where(
                BountyBoostTable.bounty_id == bounty_id,
                BountyBoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        count, total_boosted = result.one()

    total_boosted = float(total_boosted)
    return BoostSummary(
        original_amount=original_amount,
        total_boosted=total_boosted,
        total_amount=original_amount + total_boosted,
        boost_count=count,
    )


async def get_boost_leaderboard(bounty_id: str) -> BoostLeaderboardResponse:
    """Return top boosters for a bounty, ranked by total confirmed contributions.

    Args:
        bounty_id: UUID of the target bounty.

    Returns:
        A :class:`BoostLeaderboardResponse` with ranked entries.
    """
    async with get_db_session() as db:
        rows_result = await db.execute(
            select(
                BountyBoostTable.booster_wallet,
                func.sum(BountyBoostTable.amount).label("total_boosted"),
                func.count(BountyBoostTable.id).label("boost_count"),
            )
            .where(
                BountyBoostTable.bounty_id == bounty_id,
                BountyBoostTable.status == BoostStatus.CONFIRMED.value,
            )
            .group_by(BountyBoostTable.booster_wallet)
            .order_by(func.sum(BountyBoostTable.amount).desc())
            .limit(20)
        )
        rows = rows_result.all()

        # Total boosted (across all confirmed boosts for this bounty)
        total_result = await db.execute(
            select(func.coalesce(func.sum(BountyBoostTable.amount), 0)).where(
                BountyBoostTable.bounty_id == bounty_id,
                BountyBoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        total_boosted = float(total_result.scalar_one())

    leaderboard = [
        BoosterLeaderboardEntry(
            rank=i + 1,
            booster_wallet=row.booster_wallet,
            total_boosted=float(row.total_boosted),
            boost_count=row.boost_count,
        )
        for i, row in enumerate(rows)
    ]

    return BoostLeaderboardResponse(
        leaderboard=leaderboard, total_boosted=total_boosted
    )


async def refund_bounty_boosts(bounty_id: str) -> int:
    """Mark all confirmed boosts for a bounty as REFUNDED.

    Called when a bounty expires or is cancelled without a winner.
    In production this would also trigger on-chain SPL refund transfers
    back to each booster wallet.

    Args:
        bounty_id: UUID of the bounty whose boosts should be refunded.

    Returns:
        Number of boosts refunded.
    """
    async with get_db_session() as db:
        result = await db.execute(
            select(BountyBoostTable).where(
                BountyBoostTable.bounty_id == bounty_id,
                BountyBoostTable.status == BoostStatus.CONFIRMED.value,
            )
        )
        boosts = result.scalars().all()

        refunded = 0
        for boost in boosts:
            boost.status = BoostStatus.REFUNDED.value
            boost.updated_at = datetime.now(timezone.utc)
            refunded += 1

        if refunded > 0:
            await db.commit()

        audit_event(
            "bounty_boosts_refunded",
            bounty_id=bounty_id,
            count=refunded,
        )
        logger.info("Refunded %d boosts for bounty %s", refunded, bounty_id)
        return refunded
