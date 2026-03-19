"""Payout & Treasury API endpoints."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.payout import PayoutStatus
from app.services.payout_service import get_payout, get_treasury, list_payouts

router = APIRouter(prefix="/api", tags=["payouts"])


@router.get("/payouts", summary="Paginated payout history")
async def payouts(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
) -> dict:
    """Return paginated payout history, newest first."""
    return list_payouts(skip=skip, limit=limit).model_dump()


@router.get("/payouts/{tx_hash}", summary="Single payout details")
async def payout_detail(tx_hash: str) -> dict:
    """Return full details for a single payout by transaction hash."""
    payout = get_payout(tx_hash)
    if payout is None:
        raise HTTPException(status_code=404, detail="Payout not found")
    return payout.model_dump()


@router.get("/treasury", summary="Treasury / financial stats")
async def treasury() -> dict:
    """Return current treasury statistics."""
    return get_treasury().model_dump()
