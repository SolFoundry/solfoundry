"""Query-focused treasury, payout, tokenomics, and buyback endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.models.treasury import (
    BuybackHistoryQuery,
    BuybackHistoryResponse,
    PayoutHistoryQuery,
    PayoutHistoryResponse,
    TokenomicsSummaryResponse,
    TreasuryStatsResponse,
)
from app.services.treasury_service import TreasuryQueryService, get_treasury_service

router = APIRouter(prefix="/api", tags=["treasury"])


@router.get("/payouts/history", response_model=PayoutHistoryResponse)
async def payout_history(
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    recipient_wallet: Optional[str] = Query(None, description="Filter by recipient wallet"),
    status: Optional[str] = Query(None, description="Filter by payout status"),
    service: TreasuryQueryService = Depends(get_treasury_service),
) -> PayoutHistoryResponse:
    """List treasury payout events, optionally filtered by recipient/status."""
    query = PayoutHistoryQuery(
        limit=limit,
        offset=offset,
        recipient_wallet=recipient_wallet,
        status=status,
    )
    return await service.get_payout_history(query)


@router.get("/buybacks/history", response_model=BuybackHistoryResponse)
async def buyback_history(
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    service: TreasuryQueryService = Depends(get_treasury_service),
) -> BuybackHistoryResponse:
    """List treasury buyback events."""
    query = BuybackHistoryQuery(limit=limit, offset=offset)
    return await service.get_buyback_history(query)


@router.get("/treasury/stats", response_model=TreasuryStatsResponse)
async def treasury_stats(
    service: TreasuryQueryService = Depends(get_treasury_service),
) -> TreasuryStatsResponse:
    """Return aggregate treasury metrics."""
    return await service.get_treasury_stats()


@router.get("/tokenomics/summary", response_model=TokenomicsSummaryResponse)
async def tokenomics_summary(
    service: TreasuryQueryService = Depends(get_treasury_service),
) -> TokenomicsSummaryResponse:
    """Return token metadata, policy, and treasury context."""
    return await service.get_tokenomics_summary()
