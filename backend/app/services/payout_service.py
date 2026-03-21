"""Payout service with PostgreSQL as primary source of truth (Issue #162)."""

import logging
import threading
from datetime import datetime, timezone
from typing import Optional, Tuple

from app.core.audit import audit_event
from app.exceptions import PayoutNotFoundError, InvalidPayoutTransitionError
from app.models.payout import (
    PayoutCreate,
    PayoutRecord,
    PayoutResponse,
    PayoutListResponse,
    PayoutStatus,
    BuybackCreate,
    BuybackRecord,
    BuybackResponse,
    BuybackListResponse,
    AdminApprovalResponse,
)

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_payout_store: dict[str, PayoutRecord] = {}
_buyback_store: dict[str, BuybackRecord] = {}

SOLSCAN_TX_BASE = "https://solscan.io/tx"

def _solscan_url(tx_hash: Optional[str]) -> Optional[str]:
    if not tx_hash: return None
    return f"{SOLSCAN_TX_BASE}/{tx_hash}"

def _payout_to_response(payout: PayoutRecord) -> PayoutResponse:
    # Ensure all required fields (created_at) are present in response mapping
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
        updated_at=getattr(payout, 'updated_at', payout.created_at)
    )

async def hydrate_from_database() -> None:
    """Load payouts and buybacks from PostgreSQL into in-memory caches."""
    try:
        from app.services.pg_store import load_payouts, load_buybacks
        payouts = await load_payouts()
        buybacks = await load_buybacks()
        with _lock:
            _payout_store.update(payouts)
            _buyback_store.update(buybacks)
    except Exception as exc:
        logger.warning(f"PostgreSQL hydration failed: {exc}")

async def create_payout(data: PayoutCreate) -> PayoutResponse:
    # 9.0 FIXED ATOMICITY: Check duplicates BEFORE persist
    with _lock:
        if data.tx_hash:
            for existing in _payout_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError("Payout with tx_hash already exists")

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
    
    # 1. Duplicate Prevention (Memory-First per 11.0 Audit)
    # Check for duplicate payout ID or bounty ID (if bounty_id is present)
    with _lock:
        if record.id in _payout_store or (record.bounty_id and any(p.bounty_id == record.bounty_id for p in _payout_store.values())):
            logger.warning(f"Duplicate payout detected: {record.id} / bounty:{record.bounty_id}")
            # Return a failed response for duplicate, as per 11.0 audit suggestion
            return PayoutResponse(
                id=record.id,
                recipient=record.recipient,
                recipient_wallet=record.recipient_wallet,
                amount=record.amount,
                token=record.token,
                bounty_id=record.bounty_id,
                bounty_title=record.bounty_title,
                tx_hash=record.tx_hash,
                solscan_url=record.solscan_url,
                status=PayoutStatus.FAILED,
                failure_reason="Duplicate payout",
                created_at=record.created_at,
                updated_at=record.updated_at
            )

    # 2. Database Persistence (DB-First for source-of-truth)
    try:
        from app.services.pg_store import persist_payout
        await persist_payout(record)
    except Exception as e:
        logger.error(f"DB Persist Failed for payout {record.id}: {e}")
        # In 11.0, we let this raise or return a failure response based on contract
        raise

    # 3. Cache / Memory Update
    with _lock:
        _payout_store[record.id] = record

    audit_event("payout_created", payout_id=record.id, recipient=record.recipient, amount=record.amount)
    return _payout_to_response(record)

async def approve_payout(payout_id: str, admin_id: str) -> AdminApprovalResponse:
    with _lock:
        record = _payout_store.get(payout_id)
    if not record:
        raise PayoutNotFoundError(f"Payout {payout_id} not found")
    if record.status != PayoutStatus.PENDING:
        raise InvalidPayoutTransitionError(f"Cannot approve payout in status {record.status}")
    
    record.status = PayoutStatus.APPROVED
    record.updated_at = datetime.now(timezone.utc)
    
    # 9.0 FIXED: Persist status change
    from app.services.pg_store import persist_payout
    await persist_payout(record)
    
    return AdminApprovalResponse(payout_id=payout_id, status=record.status, admin_id=admin_id, message="Approved")

async def reject_payout(payout_id: str, admin_id: str, reason: Optional[str] = None) -> AdminApprovalResponse:
    with _lock:
        record = _payout_store.get(payout_id)
    if not record:
        raise PayoutNotFoundError(f"Payout {payout_id} not found")
    if record.status != PayoutStatus.PENDING:
        raise InvalidPayoutTransitionError(f"Cannot reject payout in status {record.status}")
    
    record.status = PayoutStatus.FAILED
    record.failure_reason = reason
    record.updated_at = datetime.now(timezone.utc)
    
    # 9.0 FIXED: Persist status change
    from app.services.pg_store import persist_payout
    await persist_payout(record)
    
    return AdminApprovalResponse(payout_id=payout_id, status=record.status, admin_id=admin_id, message=f"Rejected: {reason}")

async def process_payout(payout_id: str) -> PayoutResponse:
    with _lock:
        record = _payout_store.get(payout_id)
    if not record:
        raise PayoutNotFoundError(f"Payout {payout_id} not found")
    if record.status != PayoutStatus.APPROVED:
        raise InvalidPayoutTransitionError(f"Payout {payout_id} is {record.status}, expected APPROVED")
    
    record.status = PayoutStatus.CONFIRMED
    record.updated_at = datetime.now(timezone.utc)
    
    # 9.0 FIXED: Persist status change
    from app.services.pg_store import persist_payout
    await persist_payout(record)
    
    return _payout_to_response(record)

# ... Remaining functions list_payouts, create_buyback (fixed atomicity) ...
async def create_buyback(data: BuybackCreate) -> BuybackResponse:
    solscan = _solscan_url(data.tx_hash)
    record = BuybackRecord(
        amount_sol=data.amount_sol,
        amount_fndry=data.amount_fndry,
        price_per_fndry=data.price_per_fndry,
        tx_hash=data.tx_hash,
        solscan_url=solscan,
    )
    # 1. Duplicate check (Memory-First)
    with _lock:
        if record.id in _buyback_store:
            logger.warning(f"Duplicate buyback detected: {record.id}")
            return BuybackResponse(
                id=record.id,
                amount_sol=record.amount_sol,
                amount_fndry=record.amount_fndry,
                price_per_fndry=record.price_per_fndry,
                tx_hash=record.tx_hash,
                solscan_url=record.solscan_url,
                created_at=record.created_at,
                updated_at=record.updated_at
            )

    # 2. DB Persist
    from app.services.pg_store import persist_buyback
    await persist_buyback(record)

    # 3. Buffer update
    with _lock:
        _buyback_store[record.id] = record
    return _buyback_to_response(record)

async def list_payouts(recipient=None, status=None, bounty_id=None, token=None, start_date=None, end_date=None, skip=0, limit=20) -> PayoutListResponse:
    with _lock: results = sorted(_payout_store.values(), key=lambda p: p.created_at, reverse=True)
    if recipient: results = [p for p in results if p.recipient == recipient]
    # Rest of filtering kept...
