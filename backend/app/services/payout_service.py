"""Payout and Buyback service layer -- business logic and persistence coordination.

Coordinates transactional state transitions for payouts:
PENDING -> APPROVED -> PROCESSING -> CONFIRMED/FAILED.
"""

import logging
import threading
from typing import Any, Optional, Dict, List, Tuple
from datetime import datetime, timezone

from fastapi import HTTPException
from app.models.payout import (
    PayoutRecord, PayoutStatus, PayoutCreate, PayoutResponse, PayoutListResponse,
    BuybackRecord, BuybackCreate, BuybackResponse, BuybackListResponse,
    AdminApprovalResponse
)
from app.services import pg_store

log = logging.getLogger(__name__)

# In-memory backup stores and synchronization lock
_store_lock = threading.Lock()
_payout_store: Dict[str, PayoutRecord] = {}
_buyback_store: Dict[str, BuybackRecord] = {}

def _solscan_url(tx_hash: Optional[str]) -> Optional[str]:
    return f"https://solscan.io/tx/{tx_hash}" if tx_hash else None

def _payout_to_response(record: PayoutRecord) -> PayoutResponse:
    return PayoutResponse(
        id=record.id,
        recipient=record.recipient,
        recipient_wallet=record.recipient_wallet,
        amount=record.amount,
        token=record.token,
        bounty_id=record.bounty_id,
        bounty_title=record.bounty_title,
        tx_hash=record.tx_hash,
        status=record.status,
        solscan_url=record.solscan_url,
        created_at=record.created_at,
        updated_at=getattr(record, "updated_at", record.created_at)
    )

def _buyback_to_response(record: BuybackRecord) -> BuybackResponse:
    return BuybackResponse(
        id=record.id,
        amount_sol=record.amount_sol,
        amount_fndry=record.amount_fndry,
        price_per_fndry=record.price_per_fndry,
        tx_hash=record.tx_hash,
        solscan_url=record.solscan_url,
        created_at=record.created_at,
    )

# ---------------------------------------------------------------------------
# Public API Methods
# ---------------------------------------------------------------------------

async def create_payout(data: PayoutCreate) -> PayoutResponse:
    """Create and persist a new payout record."""
    if data.tx_hash:
        # Check for duplicate tx_hash in memory
        with _store_lock:
            for existing in _payout_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise HTTPException(status_code=400, detail="Payout with tx_hash already exists")

    # Double-pay check (bounty level)
    if data.bounty_id:
        all_payouts = await pg_store.load_payouts(limit=5000)
        for p in all_payouts.values():
            if str(p.bounty_id) == str(data.bounty_id):
                raise HTTPException(status_code=400, detail=f"Bounty {data.bounty_id} already has a payout.")

    record = PayoutRecord(
        recipient=data.recipient,
        recipient_wallet=data.recipient_wallet,
        amount=data.amount,
        token=data.token,
        bounty_id=data.bounty_id,
        bounty_title=data.bounty_title,
        tx_hash=data.tx_hash,
        status=PayoutStatus.CONFIRMED if data.tx_hash else PayoutStatus.PENDING,
        solscan_url=_solscan_url(data.tx_hash)
    )

    await pg_store.persist_payout(record)
    with _store_lock:
        _payout_store[record.id] = record
    
    log.info("Created payout: %s (Status: %s)", record.id, record.status)
    return _payout_to_response(record)

async def list_payouts(
    *, 
    recipient: Optional[str] = None,
    status: Optional[PayoutStatus] = None,
    bounty_id: Optional[str] = None,
    token: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0, 
    limit: int = 20
) -> PayoutListResponse:
    """List payouts with filtering."""
    # In a full production implementation, these filters would be passed to pg_store.load_payouts.
    # For now, we utilize the high-limit load and filter in-memory for the sovereign layer.
    all_records = await pg_store.load_payouts(limit=limit + skip + 1000)
    items = list(all_records.values())

    if recipient:
        items = [p for p in items if recipient.lower() in p.recipient.lower()]
    if status:
        items = [p for p in items if p.status == status]
    if bounty_id:
        items = [p for p in items if str(p.bounty_id) == str(bounty_id)]
    if token:
        items = [p for p in items if p.token == token]
    if start_date:
        items = [p for p in items if p.created_at >= start_date]
    if end_date:
        items = [p for p in items if p.created_at <= end_date]

    total = len(items)
    page = items[skip : skip + limit]
    return PayoutListResponse(
        items=[_payout_to_response(i) for i in page],
        total=total,
        skip=skip,
        limit=limit
    )

async def get_payout_by_id(payout_id: str) -> Optional[PayoutResponse]:
    """Retrieve payout by UUID from DB or cache."""
    with _lock:
        if payout_id in _payout_store:
            return _payout_to_response(_payout_store[payout_id])
    
    # DB Fallback
    all_payouts = await pg_store.load_payouts(limit=5000)
    if payout_id in all_payouts:
        return _payout_to_response(all_payouts[payout_id])
    return None

async def get_payout_by_tx_hash(tx_hash: str) -> Optional[PayoutResponse]:
    """Retrieve payout by transaction hash."""
    all_payouts = await pg_store.load_payouts(limit=10000)
    for p in all_payouts.values():
        if p.tx_hash == tx_hash:
            return _payout_to_response(p)
    return None

async def approve_payout(payout_id: str, admin_id: str) -> AdminApprovalResponse:
    """Admin approval gate."""
    with _lock:
        record = _payout_store.get(payout_id)
    
    if not record:
        # Final attempt to load from DB before failing
        all_p = await pg_store.load_payouts(limit=5000)
        record = all_p.get(payout_id)

    if not record:
        raise HTTPException(status_code=404, detail="Payout not found")
    if record.status != PayoutStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot approve payout in {record.status} state")

    record.status = PayoutStatus.APPROVED
    record.updated_at = datetime.now(timezone.utc)
    await pg_store.persist_payout(record)
    
    return AdminApprovalResponse(
        payout_id=payout_id,
        status=record.status,
        admin_id=admin_id,
        message="Payout approved successfully"
    )

async def reject_payout(payout_id: str, admin_id: str, reason: Optional[str] = None) -> AdminApprovalResponse:
    """Admin rejection gate."""
    all_p = await pg_store.load_payouts(limit=5000)
    record = all_p.get(payout_id)
    if not record: raise HTTPException(status_code=404, detail="Payout not found")
    
    record.status = PayoutStatus.FAILED
    record.failure_reason = reason
    record.updated_at = datetime.now(timezone.utc)
    await pg_store.persist_payout(record)

    return AdminApprovalResponse(
        payout_id=payout_id,
        status=record.status,
        admin_id=admin_id,
        message=f"Payout rejected: {reason}"
    )

async def process_payout(payout_id: str) -> PayoutResponse:
    """Execute on-chain SPL transfer."""
    from app.services.transfer_service import send_spl_transfer, confirm_transaction
    
    all_p = await pg_store.load_payouts(limit=5000)
    record = all_p.get(payout_id)
    if not record: raise HTTPException(status_code=404, detail="Payout not found")
    if record.status != PayoutStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Payout must be APPROVED before execution")

    record.status = PayoutStatus.PROCESSING
    record.updated_at = datetime.now(timezone.utc)
    await pg_store.persist_payout(record)

    try:
        tx_hash = await send_spl_transfer(
            recipient_wallet=record.recipient_wallet or "",
            amount=record.amount
        )
        if await confirm_transaction(tx_hash):
            record.status = PayoutStatus.CONFIRMED
            record.tx_hash = tx_hash
            record.solscan_url = _solscan_url(tx_hash)
        else:
            record.status = PayoutStatus.FAILED
            record.failure_reason = "Transaction confirmation timeout"
    except Exception as e:
        record.status = PayoutStatus.FAILED
        record.failure_reason = str(e)

    record.updated_at = datetime.now(timezone.utc)
    await pg_store.persist_payout(record)
    
    # Update cache
    with _store_lock:
        _payout_store[record.id] = record
        
    return _payout_to_response(record)

# ---------------------------------------------------------------------------
# Buyback logic
# ---------------------------------------------------------------------------

async def create_buyback(data: BuybackCreate) -> BuybackResponse:
    if data.tx_hash:
        all_b = await pg_store.load_buybacks(limit=1000)
        for b in all_b.values():
            if b.tx_hash == data.tx_hash:
                raise HTTPException(status_code=400, detail="Buyback already exists")

    record = BuybackRecord(
        amount_sol=data.amount_sol,
        amount_fndry=data.amount_fndry,
        price_per_fndry=data.price_per_fndry,
        tx_hash=data.tx_hash,
        solscan_url=_solscan_url(data.tx_hash)
    )
    await pg_store.persist_buyback(record)
    with _store_lock:
        _buyback_store[record.id] = record
    return _buyback_to_response(record)

async def list_buybacks(skip: int = 0, limit: int = 20) -> BuybackListResponse:
    all_records = await pg_store.load_buybacks(limit=limit + skip + 100)
    items = list(all_records.values())
    page = items[skip : skip + limit]
    return BuybackListResponse(
        items=[_buyback_to_response(b) for b in page],
        total=len(items),
        skip=skip,
        limit=limit
    )

async def get_total_buybacks() -> Tuple[float, float]:
    """Calculate aggregate buyback totals."""
    all_b = await pg_store.load_buybacks(limit=10000)
    total_sol = sum(b.amount_sol for b in all_b.values())
    total_fndry = sum(b.amount_fndry for b in all_b.values())
    return total_sol, total_fndry

async def get_total_paid_out() -> tuple[float, float]:
    """Calculate total confirmed payouts for both FNDRY and SOL."""
    payouts = await pg_store.load_payouts(limit=10000)
    fndry = sum(p.amount for p in payouts.values() if p.status == PayoutStatus.CONFIRMED and p.token == "FNDRY")
    sol = sum(p.amount for p in payouts.values() if p.status == PayoutStatus.CONFIRMED and p.token == "SOL")
    return fndry, sol

async def _count_confirmed_payouts() -> int:
    """Count payouts with CONFIRMED status."""
    payouts = await pg_store.load_payouts(limit=10000)
    return sum(1 for p in payouts.values() if p.status == PayoutStatus.CONFIRMED)

async def _count_buybacks() -> int:
    """Return the total number of recorded buyback events."""
    buybacks = await pg_store.load_buybacks(limit=10000)
    return len(buybacks)

def reset_stores() -> None:
    with _store_lock:
        _payout_store.clear()
        _buyback_store.clear()
