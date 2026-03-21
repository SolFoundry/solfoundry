"""Payout service with PostgreSQL write-through persistence (Issue #162).

In-memory cache is the hot read path.  On startup ``hydrate_from_database``
loads all rows from PostgreSQL so the database is the durable source of
truth.  Every create operation fires a background write to PostgreSQL.
"""

from __future__ import annotations

import asyncio
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
    """Load payouts and buybacks from PostgreSQL into in-memory cache.

    Called once during application startup.  Errors propagate so the
    lifespan handler can log them and decide on fallback behaviour.
    """
    from app.services.pg_store import load_payouts, load_buybacks

    payouts = await load_payouts()
    buybacks = await load_buybacks()
    with _lock:
        _payout_store.update(payouts)
        _buyback_store.update(buybacks)


def _fire_db(record, kind: str) -> None:
    """Schedule an async DB write as a background task.

    Logs errors via a done-callback so failures are never silent.
    """
    try:
        loop = asyncio.get_running_loop()
        if kind == "payout":
            from app.services.pg_store import insert_payout
            coro = insert_payout(record)
        else:
            from app.services.pg_store import insert_buyback
            coro = insert_buyback(record)
        task = loop.create_task(coro)
        task.add_done_callback(
            lambda t: logger.error("pg_store %s write failed", kind, exc_info=t.exception())
            if t.exception() else None
        )
    except RuntimeError:
        pass  # No event loop (sync tests)


def _solscan_url(tx_hash: Optional[str]) -> Optional[str]:
    """Return a Solscan explorer link for *tx_hash*, or ``None``."""
    if not tx_hash:
        return None
    return f"{SOLSCAN_TX_BASE}/{tx_hash}"


def _payout_to_response(p: PayoutRecord) -> PayoutResponse:
    """Map an internal ``PayoutRecord`` to the public ``PayoutResponse`` schema."""
    return PayoutResponse(
        id=p.id,
        recipient=p.recipient,
        recipient_wallet=p.recipient_wallet,
        amount=p.amount,
        token=p.token,
        bounty_id=p.bounty_id,
        bounty_title=p.bounty_title,
        tx_hash=p.tx_hash,
        status=p.status,
        solscan_url=p.solscan_url,
        created_at=p.created_at,
    )


def _buyback_to_response(b: BuybackRecord) -> BuybackResponse:
    """Map an internal ``BuybackRecord`` to the public ``BuybackResponse`` schema."""
    return BuybackResponse(
        id=b.id,
        amount_sol=b.amount_sol,
        amount_fndry=b.amount_fndry,
        price_per_fndry=b.price_per_fndry,
        tx_hash=b.tx_hash,
        solscan_url=b.solscan_url,
        created_at=b.created_at,
    )


def create_payout(data: PayoutCreate) -> PayoutResponse:
    """Persist a new payout; CONFIRMED if tx_hash given, else PENDING."""
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
        tx_hash=record.tx_hash
    )
    _fire_db(record, "payout")
    return _payout_to_response(record)


def get_payout_by_id(payout_id: str) -> Optional[PayoutResponse]:
    """Look up a single payout by its internal UUID."""
    with _lock:
        record = _payout_store.get(payout_id)
    return _payout_to_response(record) if record else None


def get_payout_by_tx_hash(tx_hash: str) -> Optional[PayoutResponse]:
    """Look up a single payout by its on-chain transaction hash."""
    with _lock:
        for record in _payout_store.values():
            if record.tx_hash == tx_hash:
                return _payout_to_response(record)
    return None


def list_payouts(
    recipient: Optional[str] = None,
    status: Optional[PayoutStatus] = None,
    skip: int = 0,
    limit: int = 20,
) -> PayoutListResponse:
    """Return a filtered, paginated list of payouts (newest first)."""
    with _lock:
        results = sorted(
            _payout_store.values(), key=lambda p: p.created_at, reverse=True
        )
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


def get_total_paid_out() -> tuple[float, float]:
    """Return ``(total_fndry, total_sol)`` for CONFIRMED payouts only."""
    total_fndry = 0.0
    total_sol = 0.0
    with _lock:
        for p in _payout_store.values():
            if p.status == PayoutStatus.CONFIRMED:
                if p.token == "FNDRY":
                    total_fndry += p.amount
                elif p.token == "SOL":
                    total_sol += p.amount
    return total_fndry, total_sol


def create_buyback(data: BuybackCreate) -> BuybackResponse:
    """Persist a new buyback; rejects duplicate tx_hash with ValueError."""
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
        tx_hash=record.tx_hash
    )
    _fire_db(record, "buyback")
    return _buyback_to_response(record)


def list_buybacks(skip: int = 0, limit: int = 20) -> BuybackListResponse:
    """Return a paginated list of buybacks (newest first)."""
    with _lock:
        results = sorted(
            _buyback_store.values(), key=lambda b: b.created_at, reverse=True
        )
    total = len(results)
    page = results[skip : skip + limit]
    return BuybackListResponse(
        items=[_buyback_to_response(b) for b in page],
        total=total,
        skip=skip,
        limit=limit,
    )


def get_total_buybacks() -> tuple[float, float]:
    """Return ``(total_sol_spent, total_fndry_acquired)``."""
    total_sol = 0.0
    total_fndry = 0.0
    with _lock:
        for b in _buyback_store.values():
            total_sol += b.amount_sol
            total_fndry += b.amount_fndry
    return total_sol, total_fndry


def reset_stores() -> None:
    """Clear all in-memory data.  Used by tests and development resets."""
    with _lock:
        _payout_store.clear()
        _buyback_store.clear()
