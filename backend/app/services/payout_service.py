"""Payout service with queue, locks, admin approval, and transfer execution.

In-memory MVP — data lost on restart.
PostgreSQL migration: CREATE TABLE payouts (id UUID PK, recipient VARCHAR(100),
recipient_wallet VARCHAR(44), amount NUMERIC, token VARCHAR(10), bounty_id UUID,
tx_hash TEXT UNIQUE, status VARCHAR(20), solscan_url TEXT, admin_approved_by VARCHAR(100),
retry_count INT DEFAULT 0, failure_reason TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);
"""

from __future__ import annotations

import asyncio
import threading
from typing import Optional
from app.core.audit import audit_event
from app.exceptions import (
    DoublePayError,
    InvalidPayoutTransitionError,
    PayoutLockError,
    PayoutNotFoundError,
)

from app.models.payout import (
    ALLOWED_TRANSITIONS,
    AdminApprovalResponse,
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
from app.services.transfer_service import confirm_transaction, send_spl_transfer

_lock = threading.Lock()
_payout_store: dict[str, PayoutRecord] = {}
_buyback_store: dict[str, BuybackRecord] = {}
_bounty_locks: dict[str, threading.Lock] = {}

SOLSCAN_TX_BASE = "https://solscan.io/tx"


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
    """Persist a new payout; CONFIRMED if tx_hash given, else PENDING.

    Acquires a per-bounty lock and checks for double-pay when bounty_id is set.
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

    def _insert() -> None:
        """Check duplicates and insert under lock."""
        if data.tx_hash:
            for existing in _payout_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError("Payout with tx_hash already exists")
        if data.bounty_id:
            for existing in _payout_store.values():
                if existing.bounty_id == data.bounty_id and existing.status != PayoutStatus.FAILED:
                    raise DoublePayError(f"Bounty '{data.bounty_id}' already has an active payout (id={existing.id}, status={existing.status.value})")
        _payout_store[record.id] = record

    if data.bounty_id:
        with _lock:
            if data.bounty_id not in _bounty_locks:
                _bounty_locks[data.bounty_id] = threading.Lock()
            bounty_lock = _bounty_locks[data.bounty_id]
        if not bounty_lock.acquire(timeout=5):
            raise PayoutLockError(f"Could not acquire lock for bounty '{data.bounty_id}'")
        try:
            with _lock:
                _insert()
        finally:
            bounty_lock.release()
    else:
        with _lock:
            _insert()

    audit_event("payout_created", payout_id=record.id, recipient=record.recipient, amount=record.amount, token=record.token, tx_hash=record.tx_hash)
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
    bounty_id: Optional[str] = None,
    token: Optional[str] = None,
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
    if bounty_id:
        results = [p for p in results if p.bounty_id == bounty_id]
    if token:
        results = [p for p in results if p.token == token]
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


def _transition_status(record: PayoutRecord, new_status: PayoutStatus) -> None:
    """Apply a state-machine transition; raises on illegal moves."""
    allowed = ALLOWED_TRANSITIONS.get(record.status, frozenset())
    if new_status not in allowed:
        raise InvalidPayoutTransitionError(f"Cannot transition from '{record.status.value}' to '{new_status.value}'")
    record.status = new_status


def approve_payout(payout_id: str, admin_id: str) -> AdminApprovalResponse:
    """Admin-approve a pending payout, advancing to APPROVED."""
    with _lock:
        record = _payout_store.get(payout_id)
        if record is None:
            raise PayoutNotFoundError(f"Payout '{payout_id}' not found")
        _transition_status(record, PayoutStatus.APPROVED)
        record.admin_approved_by = admin_id
    audit_event("payout_approved", payout_id=payout_id, admin_id=admin_id)
    return AdminApprovalResponse(payout_id=payout_id, status=PayoutStatus.APPROVED, admin_id=admin_id, message=f"Payout approved by {admin_id}")


def reject_payout(payout_id: str, admin_id: str, reason: Optional[str] = None) -> AdminApprovalResponse:
    """Admin-reject a pending payout, moving to FAILED."""
    with _lock:
        record = _payout_store.get(payout_id)
        if record is None:
            raise PayoutNotFoundError(f"Payout '{payout_id}' not found")
        _transition_status(record, PayoutStatus.FAILED)
        record.admin_approved_by = admin_id
    audit_event("payout_rejected", payout_id=payout_id, admin_id=admin_id, reason=reason)
    return AdminApprovalResponse(payout_id=payout_id, status=PayoutStatus.FAILED, admin_id=admin_id, message=f"Payout rejected by {admin_id}")


async def process_payout(payout_id: str) -> PayoutResponse:
    """Execute on-chain transfer for an APPROVED payout (uses asyncio.to_thread for locks)."""
    def _start() -> PayoutRecord:
        with _lock:
            record = _payout_store.get(payout_id)
            if record is None:
                raise PayoutNotFoundError(f"Payout '{payout_id}' not found")
            _transition_status(record, PayoutStatus.PROCESSING)
            return record

    record = await asyncio.to_thread(_start)
    try:
        tx_sig = await send_spl_transfer(record.recipient_wallet or "", record.amount, "FNDRY")
        await confirm_transaction(tx_sig)

        def _ok() -> None:
            with _lock:
                record.tx_hash = tx_sig
                record.solscan_url = _solscan_url(tx_sig)
                record.status = PayoutStatus.CONFIRMED
        await asyncio.to_thread(_ok)
        audit_event("payout_confirmed", payout_id=payout_id, tx_hash=tx_sig)
    except Exception as err:
        def _fail() -> None:
            with _lock:
                record.status = PayoutStatus.FAILED
                record.failure_reason = str(err)
        await asyncio.to_thread(_fail)
        audit_event("payout_failed", payout_id=payout_id, error=str(err))
    return _payout_to_response(record)


def reset_stores() -> None:
    """Clear all in-memory data.  Used by tests and development resets."""
    with _lock:
        _payout_store.clear()
        _buyback_store.clear()
        _bounty_locks.clear()
