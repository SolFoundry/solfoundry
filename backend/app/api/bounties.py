"""Bounty search and filter API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.bounty import (
    BountyDB,
    BountySearchParams,
    BountyListResponse,
    BountyResponse,
    BountyCreate,
    BountyUpdate,
    AutocompleteResponse,
    BountyClaimRequest,
    BountyUnclaimRequest,
    BountyClaimantResponse,
    BountyClaimHistoryItem,
    BountyClaimHistoryResponse,
)
from app.services.bounty_service import BountySearchService, BountyClaimService
from app.database import get_db

router = APIRouter(prefix="/bounties", tags=["bounties"])


@router.get("/search", response_model=BountyListResponse)
async def search_bounties(
    q: Optional[str] = Query(None, description="Search query for title and description"),
    tier: Optional[int] = Query(None, ge=1, le=3, description="Filter by tier (1/2/3)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    reward_min: Optional[float] = Query(None, ge=0, description="Minimum reward amount"),
    reward_max: Optional[float] = Query(None, ge=0, description="Maximum reward amount"),
    skills: Optional[str] = Query(None, description="Comma-separated list of skills"),
    sort: str = Query("newest", pattern="^(newest|reward_high|reward_low|deadline|popularity)$", description="Sort order"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search and filter for bounties.
    
    - **q**: Search query for full-text search across title and description
    - **tier**: Filter by bounty tier (1, 2, or 3)
    - **category**: Filter by category (frontend, backend, smart_contract, documentation, testing, infrastructure, other)
    - **status**: Filter by status (open, claimed, completed, cancelled)
    - **reward_min**: Minimum reward amount
    - **reward_max**: Maximum reward amount
    - **skills**: Comma-separated list of required skills
    - **sort**: Sort order (newest, reward_high, reward_low, deadline, popularity)
    - **skip**: Pagination offset
    - **limit**: Number of results per page
    """
    
    params = BountySearchParams(
        q=q,
        tier=tier,
        category=category,
        status=status,
        reward_min=reward_min,
        reward_max=reward_max,
        skills=skills,
        sort=sort,
        skip=skip,
        limit=limit,
    )
    
    service = BountySearchService(db)
    return await service.search_bounties(params)


@router.get("/autocomplete", response_model=AutocompleteResponse)
async def get_autocomplete(
    q: str = Query(..., min_length=2, description="Search query for autocomplete"),
    limit: int = Query(10, ge=1, le=20, description="Number of suggestions"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get autocomplete suggestions for bounty search.
    
    Returns matching bounty titles and skills.
    """
    service = BountySearchService(db)
    return await service.get_autocomplete_suggestions(q, limit)


@router.get("/{bounty_id}", response_model=BountyResponse)
async def get_bounty(
    bounty_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single bounty by ID."""
    from sqlalchemy import select
    from app.models.bounty import BountyDB
    
    query = select(BountyDB).where(BountyDB.id == bounty_id)
    result = await db.execute(query)
    bounty = result.scalar_one_or_none()
    
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    
    return BountyResponse.model_validate(bounty)


@router.post("/", response_model=BountyResponse, status_code=201)
async def create_bounty(
    bounty: BountyCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new bounty."""
    from app.models.bounty import BountyDB
    
    db_bounty = BountyDB(**bounty.model_dump())
    db.add(db_bounty)
    await db.commit()
    await db.refresh(db_bounty)
    
    # Update search vector
    service = BountySearchService(db)
    await service.update_search_vector(str(db_bounty.id))
    
    return BountyResponse.model_validate(db_bounty)


# Claim endpoints

@router.post("/{bounty_id}/claim", response_model=BountyResponse)
async def claim_bounty(
    bounty_id: str,
    request: BountyClaimRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Claim a bounty.
    
    The claimant_id in the request body will be set as the bounty's claimant.
    The bounty status will change to 'in_progress'.
    
    Only bounties with status 'open' can be claimed.
    Each bounty can only have one claimant at a time.
    """
    service = BountyClaimService(db)
    
    try:
        bounty, history = await service.claim_bounty(
            bounty_id=bounty_id,
            claimant_id=request.claimant_id
        )
        await db.commit()
        return BountyResponse.model_validate(bounty)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{bounty_id}/claim", response_model=BountyResponse)
async def unclaim_bounty(
    bounty_id: str,
    request: BountyUnclaimRequest,
    claimant_id: str = Query(..., description="UUID of the current claimant"),
    db: AsyncSession = Depends(get_db),
):
    """
    Release a claimed bounty.
    
    Only the current claimant can unclaim a bounty.
    The bounty status will change back to 'open'.
    An optional reason can be provided for the unclaim.
    """
    service = BountyClaimService(db)
    
    try:
        bounty, history = await service.unclaim_bounty(
            bounty_id=bounty_id,
            claimant_id=claimant_id,
            reason=request.reason
        )
        await db.commit()
        return BountyResponse.model_validate(bounty)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{bounty_id}/claimant", response_model=BountyClaimantResponse)
async def get_bounty_claimant(
    bounty_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the current claimant of a bounty.
    
    Returns the claimant's ID and the time the bounty was claimed.
    Returns 404 if the bounty exists but is not claimed.
    """
    service = BountyClaimService(db)
    
    try:
        result = await service.get_claimant(bounty_id)
        if result is None:
            raise HTTPException(
                status_code=404, 
                detail="Bounty is not currently claimed"
            )
        return BountyClaimantResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{bounty_id}/claim-history", response_model=BountyClaimHistoryResponse)
async def get_bounty_claim_history(
    bounty_id: str,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the claim history for a bounty.
    
    Returns a paginated list of all claim and unclaim events.
    """
    service = BountyClaimService(db)
    
    items, total = await service.get_claim_history(
        bounty_id=bounty_id,
        skip=skip,
        limit=limit
    )
    
    return BountyClaimHistoryResponse(
        items=[BountyClaimHistoryItem.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit
    )