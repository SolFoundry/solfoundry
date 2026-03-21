"""Payout and Buyback service layer -- business logic and persistence coordination."""

import logging
from typing import Any, Optional, List, Tuple
from datetime import datetime, timezone

from fastapi import HTTPException
from app.models.payout import (
    PayoutRecord, PayoutStatus, PayoutCreate, PayoutResponse, PayoutListResponse,
    BuybackRecord, BuybackCreate, BuybackResponse, BuybackListResponse
)
from app.services import pg_store

log = logging.getLogger(__name__)

def _payout_to_response(record: PayoutRecord) -> PayoutResponse:
    """Map internal PayoutRecord to API PayoutResponse."""
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
        retry_count=record.retry_count,
        failure_reason=record.failure_reason,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )

def _buyback_to_response(record: BuybackRecord) -> BuybackResponse:
    """Map internal BuybackRecord to API BuybackResponse."""
    return BuybackResponse(
        id=record.id,
        amount_sol=record.amount_sol,
        amount_fndry=record.amount_fndry,
        price_per_fndry=record.price_per_fndry,
        tx_hash=record.tx_hash,
        solscan_url=record.solscan_url,
        created_at=record.created_at,
    )

async def create_payout(payout_in: PayoutCreate) -> PayoutResponse:
    """Create a new payout record (Duplicate check before DB write)."""
    # 1. Duplicate Check: Ensure bounty_id (if provided) isn't already paid
    if payout_in.bounty_id:
        existing_payouts = await pg_store.load_payouts(limit=1000)
        for p in existing_payouts.values():
            if str(p.bounty_id) == str(payout_in.bounty_id):
                log.warning("Duplicate payout attempt for bounty_id: %s", payout_in.bounty_id)
                raise HTTPException(status_code=400, detail=f"Bounty {payout_in.bounty_id} already has a payout.")

    # 2. Record Construction
    record = PayoutRecord(
        recipient=payout_in.recipient,
        recipient_wallet=payout_in.recipient_wallet,
        amount=payout_in.amount,
        token=payout_in.token,
        bounty_id=payout_in.bounty_id,
        bounty_title=payout_in.bounty_title,
        tx_hash=payout_in.tx_hash,
        status=PayoutStatus.CONFIRMED if payout_in.tx_hash else PayoutStatus.PENDING,
        solscan_url=f"https://solscan.io/tx/{payout_in.tx_hash}" if payout_in.tx_hash else None,
    )

    # 3. Persistence
    await pg_store.persist_payout(record)
    log.info("Created payout: %s for %s", record.id, record.recipient)
    return _payout_to_response(record)

async def list_payouts(
    *, 
    status: Optional[str] = None, 
    recipient: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100
) -> PayoutListResponse:
    """List payouts with server-side filtering and pagination."""
    # Note: In production, filtering should happen via SQL query in pg_store.
    # For now, we load all and filter in-memory to maintain backward compatibility during migration.
    all_records = await pg_store.load_payouts(limit=10000)
    filtered = list(all_records.values())

    if status:
        filtered = [p for p in filtered if p.status.value.lower() == status.lower()]
    if recipient:
        filtered = [p for p in filtered if recipient.lower() in p.recipient.lower()]

    total = len(filtered)
    page = filtered[skip : skip + limit]
    
    return PayoutListResponse(
        items=[_payout_to_response(p) for p in page],
        total=total,
        skip=skip,
        limit=limit
    )

async def get_payout(payout_id: str) -> PayoutResponse:
    """Retrieve a single payout by UUID."""
    all_payouts = await pg_store.load_payouts(limit=10000)
    if payout_id not in all_payouts:
        raise HTTPException(status_code=404, detail="Payout not found")
    return _payout_to_response(all_payouts[payout_id])

async def create_buyback(buyback_in: BuybackCreate) -> BuybackResponse:
    """Record a manual buyback event (Duplicate check by tx_hash)."""
    if buyback_in.tx_hash:
        existing = await pg_store.load_buybacks(limit=1000)
        for b in existing.values():
            if b.tx_hash == buyback_in.tx_hash:
                 raise HTTPException(status_code=400, detail="Buyback with this tx_hash already exists.")

    record = BuybackRecord(
        amount_sol=buyback_in.amount_sol,
        amount_fndry=buyback_in.amount_fndry,
        price_per_fndry=buyback_in.price_per_fndry,
        tx_hash=buyback_in.tx_hash,
        solscan_url=f"https://solscan.io/tx/{buyback_in.tx_hash}" if buyback_in.tx_hash else None,
    )
    await pg_store.persist_buyback(record)
    return _buyback_to_response(record)

async def list_buybacks(skip: int = 0, limit: int = 100) -> BuybackListResponse:
    """List all buyback events."""
    all_records = await pg_store.load_buybacks(limit=10000)
    items = list(all_records.values())
    total = len(items)
    page = items[skip : skip + limit]
    
    return BuybackListResponse(
        items=[_buyback_to_response(b) for b in page],
        total=total,
        skip=skip,
        limit=limit
    )
