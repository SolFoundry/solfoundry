"""In-memory payout service with pipeline transitions (MVP)."""

from __future__ import annotations

import threading
from datetime import datetime, timezone
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
    PipelineStatusResponse,
)

_lock = threading.Lock()
_payout_store: dict[str, PayoutRecord] = {}
_buyback_store: dict[str, BuybackRecord] = {}
_payout_locks: set[str] = set()

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
        admin_approved=p.admin_approved,
        approved_by=p.approved_by,
        retry_count=p.retry_count,
        failure_reason=p.failure_reason,
        created_at=p.created_at,
        updated_at=p.updated_at,
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
        admin_approved=bool(data.tx_hash),
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


def _require(payout_id: str, expected: PayoutStatus) -> PayoutRecord:
    """Get a payout record and verify its status, raising ValueError if invalid."""
    r = _payout_store.get(payout_id)
    if not r:
        raise ValueError(f"Payout {payout_id} not found")
    if r.status != expected:
        raise ValueError(f"Payout {payout_id} is {r.status.value}, expected {expected.value}")
    return r


def approve_payout(payout_id: str, admin_id: str) -> PayoutResponse:
    """Mark a pending payout as admin-approved."""
    with _lock:
        r = _require(payout_id, PayoutStatus.PENDING)
        r.admin_approved = True
        r.approved_by = admin_id
        r.updated_at = datetime.now(timezone.utc)
    return _payout_to_response(r)


def reject_payout(payout_id: str, admin_id: str, reason: str) -> PayoutResponse:
    """Reject a pending payout, marking it as failed."""
    with _lock:
        r = _require(payout_id, PayoutStatus.PENDING)
        r.status = PayoutStatus.FAILED
        r.approved_by = admin_id
        r.failure_reason = reason
        r.updated_at = datetime.now(timezone.utc)
    return _payout_to_response(r)


def acquire_payout_lock(bounty_id: str) -> bool:
    """Acquire exclusive processing lock (double-pay prevention)."""
    with _lock:
        if bounty_id in _payout_locks:
            return False
        _payout_locks.add(bounty_id)
        return True


def release_payout_lock(bounty_id: str) -> None:
    """Release the processing lock for a bounty payout."""
    with _lock:
        _payout_locks.discard(bounty_id)


def transition_to_processing(payout_id: str) -> PayoutResponse:
    """Move a payout from PENDING to PROCESSING."""
    with _lock:
        r = _require(payout_id, PayoutStatus.PENDING)
        if not r.admin_approved:
            raise ValueError(f"Payout {payout_id} not admin-approved")
        r.status = PayoutStatus.PROCESSING
        r.updated_at = datetime.now(timezone.utc)
    return _payout_to_response(r)


def transition_to_confirmed(payout_id: str, tx_hash: str) -> PayoutResponse:
    """Move a payout from PROCESSING to CONFIRMED with tx hash."""
    with _lock:
        r = _require(payout_id, PayoutStatus.PROCESSING)
        r.status = PayoutStatus.CONFIRMED
        r.tx_hash = tx_hash
        r.solscan_url = _solscan_url(tx_hash)
        r.updated_at = datetime.now(timezone.utc)
    return _payout_to_response(r)


def transition_to_failed(payout_id: str, reason: str, increment_retry: bool = True) -> PayoutResponse:
    """Move a payout from PROCESSING to FAILED."""
    with _lock:
        r = _require(payout_id, PayoutStatus.PROCESSING)
        r.status = PayoutStatus.FAILED
        r.failure_reason = reason
        if increment_retry:
            r.retry_count += 1
        r.updated_at = datetime.now(timezone.utc)
    return _payout_to_response(r)


def retry_failed_payout(payout_id: str) -> PayoutResponse:
    """Reset a FAILED payout back to PENDING for retry."""
    with _lock:
        r = _require(payout_id, PayoutStatus.FAILED)
        r.status = PayoutStatus.PENDING
        r.failure_reason = None
        r.updated_at = datetime.now(timezone.utc)
    return _payout_to_response(r)


def get_pipeline_status() -> PipelineStatusResponse:
    """Return aggregate counts and amounts for each pipeline status."""
    counts = {s: 0 for s in PayoutStatus}
    pending_amt = confirmed_amt = 0.0
    with _lock:
        for p in _payout_store.values():
            counts[p.status] += 1
            if p.status == PayoutStatus.PENDING:
                pending_amt += p.amount
            elif p.status == PayoutStatus.CONFIRMED:
                confirmed_amt += p.amount
    return PipelineStatusResponse(
        pending_count=counts[PayoutStatus.PENDING], processing_count=counts[PayoutStatus.PROCESSING],
        confirmed_count=counts[PayoutStatus.CONFIRMED], failed_count=counts[PayoutStatus.FAILED],
        total_pending_amount=pending_amt, total_confirmed_amount=confirmed_amt,
    )


def reset_stores() -> None:
    """Clear all in-memory data.  Used by tests and development resets."""
    with _lock:
        _payout_store.clear()
        _buyback_store.clear()
        _payout_locks.clear()
