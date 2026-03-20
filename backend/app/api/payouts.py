"""Payout, treasury, and tokenomics API endpoints."""

from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.payout import (
    BuybackCreate, BuybackListResponse, BuybackResponse,
    PayoutCreate, PayoutListResponse, PayoutResponse, PayoutStatus,
    TokenomicsResponse, TreasuryStats,
)
from app.services.payout_service import (
    create_buyback, create_payout, get_payout_by_tx_hash, list_buybacks, list_payouts,
)
from app.services.treasury_service import get_tokenomics, get_treasury_stats, invalidate_cache

router = APIRouter(prefix="/api", tags=["payouts", "treasury"])

_TX_HASH_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")


@router.get("/payouts", response_model=PayoutListResponse)
async def get_payouts(
    recipient: Optional[str] = Query(
        None, min_length=1, max_length=100, description="Filter by recipient username"
    ),
    status: Optional[PayoutStatus] = Query(None, description="Filter by payout status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
) -> PayoutListResponse:
    """Paginated payout history."""
    return list_payouts(recipient=recipient, status=status, skip=skip, limit=limit)


@router.get("/payouts/{tx_hash}", response_model=PayoutResponse)
async def get_payout_detail(tx_hash: str) -> PayoutResponse:
    """Single payout detail by transaction hash with Solscan link."""
    if not _TX_HASH_RE.match(tx_hash):
        raise HTTPException(
            status_code=400,
            detail="tx_hash must be a valid Solana transaction signature (64-88 base-58 chars)",
        )
    payout = get_payout_by_tx_hash(tx_hash)
    if payout is None:
        raise HTTPException(status_code=404, detail=f"Payout with tx_hash \'{tx_hash}\' not found")
    return payout


@router.post("/payouts", response_model=PayoutResponse, status_code=201)
async def record_payout(data: PayoutCreate) -> PayoutResponse:
    """Record a new payout."""
    try:
        result = create_payout(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get("/treasury", response_model=TreasuryStats)
async def treasury_stats() -> TreasuryStats:
    """Live treasury balance (SOL + $FNDRY), total paid out, total buybacks."""
    return await get_treasury_stats()


@router.get("/treasury/buybacks", response_model=BuybackListResponse)
async def treasury_buybacks(
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
) -> BuybackListResponse:
    """Buyback history."""
    return list_buybacks(skip=skip, limit=limit)


@router.post("/treasury/buybacks", response_model=BuybackResponse, status_code=201)
async def record_buyback(data: BuybackCreate) -> BuybackResponse:
    """Record a new buyback event."""
    try:
        result = create_buyback(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get("/tokenomics", response_model=TokenomicsResponse)
async def tokenomics() -> TokenomicsResponse:
    """$FNDRY supply breakdown, distribution stats, fee revenue."""
    return await get_tokenomics()
