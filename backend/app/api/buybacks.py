"""Buyback API endpoints for $FNDRY tokenomics."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from app.models.payout import BuybackCreate, BuybackResponse, BuybackListResponse
from app.services import payout_service

router = APIRouter(prefix="/buybacks", tags=["treasury"])

@router.post("/", response_model=BuybackResponse, summary="Record a buyback")
async def record_buyback(buyback_in: BuybackCreate):
    """Record a manual SOL -> FNDRY buyback event and update treasury stats."""
    return await payout_service.create_buyback(buyback_in)

@router.get("/", response_model=BuybackListResponse, summary="List buybacks")
async def list_buybacks(skip: int = 0, limit: int = 100):
    """Retrieve a paginated list of all recorded buyback events."""
    return await payout_service.list_buybacks(skip=skip, limit=limit)
