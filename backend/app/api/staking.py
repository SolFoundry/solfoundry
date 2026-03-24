"""Staking API router — stake, unstake, claim rewards, position, history."""

from fastapi import APIRouter, HTTPException

from app.models.staking import (
    ClaimRewardsRequest,
    StakeRequest,
    StakingHistoryResponse,
    StakingPositionResponse,
    StakingStats,
    UnstakeCompleteRequest,
    UnstakeInitiateRequest,
)
from app.services import staking_service

router = APIRouter(prefix="/staking", tags=["staking"])


@router.get("/position/{wallet}", response_model=StakingPositionResponse)
async def get_position(wallet: str):
    """Return the current staking position for a wallet."""
    return await staking_service.get_position(wallet)


@router.post("/stake", response_model=StakingPositionResponse)
async def record_stake(body: StakeRequest):
    """Record a confirmed on-chain stake transaction."""
    try:
        return await staking_service.record_stake(
            body.wallet_address, body.amount, body.signature
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/unstake/initiate", response_model=StakingPositionResponse)
async def initiate_unstake(body: UnstakeInitiateRequest):
    """Begin the 7-day unstake cooldown period."""
    try:
        return await staking_service.initiate_unstake(body.wallet_address, body.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/unstake/complete", response_model=StakingPositionResponse)
async def complete_unstake(body: UnstakeCompleteRequest):
    """Complete the unstake after the cooldown period has elapsed."""
    try:
        return await staking_service.complete_unstake(
            body.wallet_address, body.signature
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/claim", response_model=dict)
async def claim_rewards(body: ClaimRewardsRequest):
    """Claim all accrued staking rewards for a wallet."""
    try:
        position, amount_claimed = await staking_service.claim_rewards(
            body.wallet_address
        )
        return {"amount_claimed": amount_claimed, "position": position.model_dump()}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/history/{wallet}", response_model=StakingHistoryResponse)
async def get_history(wallet: str, limit: int = 50, offset: int = 0):
    """Return paginated staking event history for a wallet."""
    limit = min(max(1, limit), 100)
    offset = max(0, offset)
    return await staking_service.get_history(wallet, limit, offset)


@router.get("/stats", response_model=StakingStats)
async def get_stats():
    """Return global platform staking statistics."""
    return await staking_service.get_platform_stats()
