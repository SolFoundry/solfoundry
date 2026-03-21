"""Treasury service -- cached RPC balance queries and aggregated statistics.

Provides treasury balance snapshots and $FNDRY tokenomics by combining
on-chain data (via Solana RPC) with in-memory payout and buyback totals.

Balance queries are cached for ``CACHE_TTL`` seconds (default 60) to
reduce RPC load.  The cache is invalidated after payouts and buybacks.

In-memory MVP -- data is lost on restart.
PostgreSQL migration path: aggregate queries replace in-memory iteration.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from app.models.payout import TokenomicsResponse, TreasuryStats
from app.services.payout_service import (
    PayoutStatus,
    _buyback_store,
    _lock as _store_lock,
    _payout_store,
    get_total_buybacks,
    get_total_paid_out,
)
from app.services.solana_client import (
    FNDRY_TOKEN_CA,
    TREASURY_WALLET,
    get_treasury_balances,
)

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, tuple[float, float]]] = {}
"""RPC balance cache: maps cache_key -> (timestamp, (sol, fndry))."""

CACHE_TTL: int = 60
"""Time-to-live for cached balance data in seconds."""

_cache_lock: asyncio.Lock | None = None
"""Lazy-initialized asyncio lock for cache write serialization."""


def _get_cache_lock() -> asyncio.Lock:
    """Lazily create the per-event-loop asyncio lock for cache writes.

    Returns:
        The shared asyncio lock instance.
    """
    global _cache_lock
    if _cache_lock is None:
        _cache_lock = asyncio.Lock()
    return _cache_lock


def invalidate_cache() -> None:
    """Clear the RPC balance cache.

    Called after payouts, buybacks, or any operation that changes
    the treasury state so the next query fetches fresh data.
    """
    _cache.clear()


async def _get_cached_balances(cache_key: str) -> tuple[float, float]:
    """Return cached ``(sol, fndry)`` balances, refreshing if stale.

    Uses a double-check locking pattern to avoid thundering-herd
    issues when the cache expires under concurrent requests.

    Args:
        cache_key: The cache partition key (e.g. ``"treasury_stats"``).

    Returns:
        A tuple of (SOL balance, FNDRY balance).
    """
    now = time.time()
    entry = _cache.get(cache_key)
    if entry is not None:
        cached_at, balances = entry
        if now - cached_at < CACHE_TTL:
            return balances
    async with _get_cache_lock():
        entry = _cache.get(cache_key)
        if entry is not None:
            cached_at, balances = entry
            if now - cached_at < CACHE_TTL:
                return balances
        return await _fetch_and_cache_balances(cache_key, now)


async def get_treasury_stats() -> TreasuryStats:
    """Build a live treasury snapshot combining cached balances with aggregates.

    Returns:
        A ``TreasuryStats`` model with current SOL/FNDRY balances,
        cumulative payouts, and buyback totals.
    """
    sol_balance, fndry_balance = await _get_cached_balances("treasury_stats")
    total_fndry_paid, total_sol_paid = get_total_paid_out()
    total_buyback_sol, _ = get_total_buybacks()

    return TreasuryStats(
        sol_balance=sol_balance,
        fndry_balance=fndry_balance,
        treasury_wallet=TREASURY_WALLET,
        total_paid_out_fndry=total_fndry_paid,
        total_paid_out_sol=total_sol_paid,
        total_payouts=_count_confirmed_payouts(),
        total_buyback_amount=total_buyback_sol,
        total_buybacks=_count_buybacks(),
        last_updated=datetime.now(timezone.utc),
    )


async def _fetch_and_cache_balances(
    cache_key: str, now: float
) -> tuple[float, float]:
    """Call Solana RPC for fresh balances and update the cache.

    Returns ``(0.0, 0.0)`` on RPC failure so the API degrades
    gracefully instead of raising.

    Args:
        cache_key: The cache partition key.
        now: Current time (``time.time()``) for cache timestamping.

    Returns:
        A tuple of (SOL balance, FNDRY balance).
    """
    try:
        sol_balance, fndry_balance = await get_treasury_balances()
    except Exception:
        logger.exception("Failed to fetch treasury balances from Solana RPC")
        sol_balance, fndry_balance = 0.0, 0.0
    _cache[cache_key] = (now, (sol_balance, fndry_balance))
    return sol_balance, fndry_balance


def _count_confirmed_payouts() -> int:
    """Count payouts with ``CONFIRMED`` status.

    Returns:
        The number of confirmed payouts in the store.
    """
    with _store_lock:
        return sum(
            1 for payout_record in _payout_store.values()
            if payout_record.status == PayoutStatus.CONFIRMED
        )


def _count_buybacks() -> int:
    """Return the total number of recorded buyback events.

    Returns:
        The buyback count.
    """
    with _store_lock:
        return len(_buyback_store)


TOTAL_SUPPLY: float = 1_000_000_000.0
"""Total $FNDRY token supply (1 billion)."""


async def get_tokenomics() -> TokenomicsResponse:
    """Build $FNDRY tokenomics; ``circulating = total_supply - treasury_holdings``.

    Returns:
        A ``TokenomicsResponse`` model with supply breakdown,
        distribution stats, and fee revenue.
    """
    _, fndry_balance = await _get_cached_balances("treasury_stats")
    total_fndry_paid, _ = get_total_paid_out()
    total_sol_buyback, total_buyback_fndry = get_total_buybacks()

    circulating = TOTAL_SUPPLY - fndry_balance

    return TokenomicsResponse(
        token_name="FNDRY",
        token_ca=FNDRY_TOKEN_CA,
        total_supply=TOTAL_SUPPLY,
        circulating_supply=circulating,
        treasury_holdings=fndry_balance,
        total_distributed=total_fndry_paid,
        total_buybacks=total_buyback_fndry,
        total_burned=0.0,
        fee_revenue_sol=total_sol_buyback,
        distribution_breakdown={
            "contributor_rewards": total_fndry_paid,
            "treasury_reserve": fndry_balance,
            "buybacks": total_buyback_fndry,
            "burned": 0.0,
        },
        last_updated=datetime.now(timezone.utc),
    )
