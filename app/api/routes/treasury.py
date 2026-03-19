from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi_cache.decorator import cache
from typing import Optional, List
import asyncio

from app.api.dependencies import get_current_user
from app.api.models import (
    PayoutResponse,
    PayoutDetailResponse,
    TreasuryStatsResponse,
    BuybackResponse,
    TokenomicsResponse,
    PaginatedResponse
)
from app.core.treasury import TreasuryService
from app.core.exceptions import TreasuryError, PayoutNotFoundError

router = APIRouter(prefix="/treasury", tags=["treasury"])

@router.get("/payouts", response_model=PaginatedResponse[PayoutResponse])
@cache(expire=300)  # 5 minutes
async def get_payouts(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by payout status"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user)
):
    """Get paginated list of payouts with optional filters"""
    try:
        treasury_service = TreasuryService()
        result = await treasury_service.get_payouts(
            page=page,
            limit=limit,
            status=status,
            start_date=start_date,
            end_date=end_date
        )
        return result
    except TreasuryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/payouts/{tx_hash}", response_model=PayoutDetailResponse)
@cache(expire=300)  # 5 minutes
async def get_payout_detail(
    tx_hash: str,
    current_user = Depends(get_current_user)
):
    """Get detailed information about a specific payout"""
    try:
        treasury_service = TreasuryService()
        payout = await treasury_service.get_payout_by_hash(tx_hash)
        return payout
    except PayoutNotFoundError:
        raise HTTPException(status_code=404, detail="Payout not found")
    except TreasuryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("", response_model=TreasuryStatsResponse)
@cache(expire=600)  # 10 minutes
async def get_treasury_stats(
    current_user = Depends(get_current_user)
):
    """Get treasury statistics and current holdings"""
    try:
        treasury_service = TreasuryService()
        stats = await treasury_service.get_treasury_stats()
        return stats
    except TreasuryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/buybacks", response_model=PaginatedResponse[BuybackResponse])
@cache(expire=300)  # 5 minutes
async def get_buybacks(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user = Depends(get_current_user)
):
    """Get paginated list of token buyback transactions"""
    try:
        treasury_service = TreasuryService()
        result = await treasury_service.get_buybacks(
            page=page,
            limit=limit,
            start_date=start_date,
            end_date=end_date
        )
        return result
    except TreasuryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/tokenomics", response_model=TokenomicsResponse)
@cache(expire=3600)  # 1 hour
async def get_tokenomics(
    current_user = Depends(get_current_user)
):
    """Get current tokenomics data including supply metrics and distribution"""
    try:
        treasury_service = TreasuryService()
        tokenomics = await treasury_service.get_tokenomics()
        return tokenomics
    except TreasuryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")