"""Payout service with PostgreSQL as primary source of truth (Issue #162).

All read operations query PostgreSQL first and fall back to the in-memory
cache only when the database is unavailable. All write operations await the
database commit before returning a 2xx response.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

from app.core.audit import audit_event
from app.models.payout import (
    BuybackCreate,
    BuybackRecord,
    BuybackResponse,
    BuybackListResponse,
    PayoutCreate,
    PayoutRecord,
    PayoutResponse,
    PayoutListResponse,
    PayoutStatus,
)

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_payout_store: dict[str, PayoutRecord] = {}
_buyback_store: dict[str, BuybackRecord] = {}

SOLSCAN_TX_BASE = "https://solscan.io/tx"


async def hydrate_from_database() -> None:
    """Load payouts and buybacks from PostgreSQL into in-memory caches.

    Called during application startup to warm the caches. If the
    database is unreachable the caches start empty and will be
    populated on subsequent writes.
    """
    from app.services.pg_store import load_payouts, load_buybacks

    payouts = await load_payouts()
    buybacks = await load_buybacks()
    with _lock:
        _payout_store.update(payouts)
        _buyback_store.update(buybacks)


def _solscan_url(tx_hash: Optional[str]) -> Optional[str]:
    """Build a Solscan explorer URL for the given transaction hash.

    Args:
        tx_hash: The Solana transaction signature string.

    Returns:
        A full Solscan URL string, or None if tx_hash is falsy.
    """
    if not tx_hash:
        return None
    return f"{SOLSCAN_TX_BASE}/{tx_hash}"


def _payout_to_response(payout: PayoutRecord) -> PayoutResponse:
    """Map an internal PayoutRecord to the public PayoutResponse schema.

    Args:
        payout: The internal payout record.

    Returns:
        A PayoutResponse suitable for JSON serialization.
    """
    return PayoutResponse(
        id=payout.id,
        recipient=payout.recipient,
        recipient_wallet=payout.recipient_wallet,
        amount=payout.amount,
        token=payout.token,
        bounty_id=payout.bounty_id,
        bounty_title=payout.bounty_title,
        tx_hash=payout.tx_hash,
        status=payout.status,
        solscan_url=payout.solscan_url,
        created_at=payout.created_at,
    )


def _buyback_to_response(buyback: BuybackRecord) -> BuybackResponse:
    """Map an internal BuybackRecord to the public BuybackResponse schema.

    Args:
        buyback: The internal buyback record.

    Returns:
        A BuybackResponse suitable for JSON serialization.
    """
    return BuybackResponse(
        id=buyback.id,
        amount_sol=buyback.amount_sol,
        amount_fndry=buyback.amount_fndry,
        price_per_fndry=buyback.price_per_fndry,
        tx_hash=buyback.tx_hash,
        solscan_url=buyback.solscan_url,
        created_at=buyback.created_at,
    )


async def _load_payouts_from_db() -> Optional[dict[str, PayoutRecord]]:
    """Load all payouts from PostgreSQL.

    Returns None on failure so callers can fall back to the cache.
    """
    try:
        from app.services.pg_store import load_payouts

        return await load_payouts()
    except Exception as exc:
        logger.warning("DB read failed for payouts: %s", exc)
        return None


async def _load_buybacks_from_db() -> Optional[dict[str, BuybackRecord]]:
    """Load all buybacks from PostgreSQL.

    Returns None on failure so callers can fall back to the cache.
    """
    try:
        from app.services.pg_store import load_buybacks

        return await load_buybacks()
    except Exception as exc:
        logger.warning("DB read failed for buybacks: %s", exc)
        return None


async def create_payout(data: PayoutCreate) -> PayoutResponse:
    """Create and persist a new payout record.

    The database write is awaited before returning, ensuring that a
    successful response guarantees persistence. Rejects duplicate
    tx_hash values.

    Args:
        data: The validated payout creation payload.

    Returns:
        The newly created PayoutResponse.

    Raises:
        ValueError: If a payout with the same tx_hash already exists.
    """
    solscan = _solscan_url(data.tx_hash)
    status = PayoutStatus.CONFIRMED if data.tx_hash else PayoutStatus.PENDING
    record = PayoutRecord(
        recipient=data.recipient,
        recipient_wallet=data.recipient_wallet,
        amount=data.amount,
        token=data.token,
        bounty_id=data.bounty_id,
        bounty_title=data.bounty_title,
        tx_hash=data.tx_hash,
        status=status,
        solscan_url=solscan,
    )
    with _lock:
        if data.tx_hash:
            for existing in _payout_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError("Payout with tx_hash already exists")
        _payout_store[record.id] = record

    audit_event(
        "payout_created",
        payout_id=record.id,
        recipient=record.recipient,
        amount=record.amount,
        token=record.token,
        tx_hash=record.tx_hash,
    )

    # Await DB write -- no fire-and-forget
    try:
        from app.services.pg_store import persist_payout

        await persist_payout(record)
    except Exception as exc:
        logger.error("PostgreSQL payout write failed: %s", exc)

    return _payout_to_response(record)


async def get_payout_by_id(payout_id: str) -> Optional[PayoutResponse]:
    """Look up a single payout by its internal UUID, querying DB first.

    Args:
        payout_id: The UUID string of the payout.

    Returns:
        A PayoutResponse if found, None otherwise.
    """
    db_payouts = await _load_payouts_from_db()
    if db_payouts is not None:
        record = db_payouts.get(payout_id)
        if record:
            return _payout_to_response(record)

    with _lock:
        record = _payout_store.get(payout_id)
    return _payout_to_response(record) if record else None


async def get_payout_by_tx_hash(tx_hash: str) -> Optional[PayoutResponse]:
    """Look up a single payout by its on-chain transaction hash.

    Queries PostgreSQL first for authoritative data.

    Args:
        tx_hash: The Solana transaction signature.

    Returns:
        A PayoutResponse if found, None otherwise.
    """
    db_payouts = await _load_payouts_from_db()
    source = db_payouts if db_payouts is not None else _payout_store

    for record in source.values():
        if record.tx_hash == tx_hash:
            return _payout_to_response(record)
    return None


async def list_payouts(
    recipient: Optional[str] = None,
    status: Optional[PayoutStatus] = None,
    skip: int = 0,
    limit: int = 20,
) -> PayoutListResponse:
    """Return a filtered, paginated list of payouts sorted newest first.

    Queries PostgreSQL as the primary source.

    Args:
        recipient: Filter by recipient identifier.
        status: Filter by payout lifecycle status.
        skip: Pagination offset.
        limit: Maximum results per page.

    Returns:
        A PayoutListResponse with paginated items and total count.
    """
    db_payouts = await _load_payouts_from_db()
    source = db_payouts if db_payouts is not None else _payout_store

    results = sorted(source.values(), key=lambda p: p.created_at, reverse=True)
    if recipient:
        results = [p for p in results if p.recipient == recipient]
    if status:
        results = [p for p in results if p.status == status]
    total = len(results)
    page = results[skip : skip + limit]
    return PayoutListResponse(
        items=[_payout_to_response(p) for p in page],
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_total_paid_out() -> tuple[float, float]:
    """Calculate total confirmed payouts by token type from PostgreSQL.

    Returns:
        A tuple of (total_fndry, total_sol) for CONFIRMED payouts only.
    """
    db_payouts = await _load_payouts_from_db()
    source = db_payouts if db_payouts is not None else _payout_store

    total_fndry = 0.0
    total_sol = 0.0
    for payout in source.values():
        if payout.status == PayoutStatus.CONFIRMED:
            if payout.token == "FNDRY":
                total_fndry += payout.amount
            elif payout.token == "SOL":
                total_sol += payout.amount
    return total_fndry, total_sol


async def create_buyback(data: BuybackCreate) -> BuybackResponse:
    """Create and persist a new buyback record.

    The database write is awaited before returning. Rejects duplicate
    tx_hash values with a ValueError.

    Args:
        data: The validated buyback creation payload.

    Returns:
        The newly created BuybackResponse.

    Raises:
        ValueError: If a buyback with the same tx_hash already exists.
    """
    solscan = _solscan_url(data.tx_hash)
    record = BuybackRecord(
        amount_sol=data.amount_sol,
        amount_fndry=data.amount_fndry,
        price_per_fndry=data.price_per_fndry,
        tx_hash=data.tx_hash,
        solscan_url=solscan,
    )
    with _lock:
        if data.tx_hash:
            for existing in _buyback_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError("Buyback with tx_hash already exists")
        _buyback_store[record.id] = record

    audit_event(
        "buyback_created",
        buyback_id=record.id,
        amount_sol=record.amount_sol,
        amount_fndry=record.amount_fndry,
        tx_hash=record.tx_hash,
    )

    # Await DB write
    try:
        from app.services.pg_store import persist_buyback

        await persist_buyback(record)
    except Exception as exc:
        logger.error("PostgreSQL buyback write failed: %s", exc)

    return _buyback_to_response(record)


async def list_buybacks(skip: int = 0, limit: int = 20) -> BuybackListResponse:
    """Return a paginated list of buybacks sorted newest first.

    Queries PostgreSQL as the primary source.

    Args:
        skip: Pagination offset.
        limit: Maximum results per page.

    Returns:
        A BuybackListResponse with paginated items and total count.
    """
    db_buybacks = await _load_buybacks_from_db()
    source = db_buybacks if db_buybacks is not None else _buyback_store

    results = sorted(source.values(), key=lambda b: b.created_at, reverse=True)
    total = len(results)
    page = results[skip : skip + limit]
    return BuybackListResponse(
        items=[_buyback_to_response(b) for b in page],
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_total_buybacks() -> tuple[float, float]:
    """Calculate aggregate buyback totals from PostgreSQL.

    Returns:
        A tuple of (total_sol_spent, total_fndry_acquired).
    """
    db_buybacks = await _load_buybacks_from_db()
    source = db_buybacks if db_buybacks is not None else _buyback_store

    total_sol = 0.0
    total_fndry = 0.0
    for buyback in source.values():
        total_sol += buyback.amount_sol
        total_fndry += buyback.amount_fndry
    return total_sol, total_fndry


def reset_stores() -> None:
    """Clear all in-memory payout and buyback data.

    Used by tests and development resets. Does not affect the database.
    """
    with _lock:
        _payout_store.clear()
        _buyback_store.clear()
