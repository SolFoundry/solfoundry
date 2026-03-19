"""Bounty API routes with search and filtering."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from decimal import Decimal
from app.database import get_db
from app.services.search import search_service
from app.schemas.bounty import (
    BountyResponse,
    BountiesResponse,
    SuggestionResponse,
)

router = APIRouter(prefix="/bounties", tags=["Bounties"])


@router.get("/search", response_model=BountiesResponse)
async def search_bounties(
    q: Optional[str] = Query(None, description="Search query"),
    tier: Optional[int] = Query(None, description="Bounty tier (1/2/3)"),
    category: Optional[str] = Query(None, description="Category filter"),
    status: Optional[str] = Query(None, description="Status filter (open/claimed/completed)"),
    reward_min: Optional[Decimal] = Query(None, description="Minimum reward"),
    reward_max: Optional[Decimal] = Query(None, description="Maximum reward"),
    skills: Optional[List[str]] = Query(None, description="Required skills"),
    sort_by: Optional[str] = Query("newest", description="Sort by: newest/reward_high/reward_low/deadline/popularity"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db),
):
    """Search and filter bounties with full-text search."""
    bounties, total = await search_service.search_bounties(
        query=q,
        tier=tier,
        category=category,
        status=status,
        reward_min=float(reward_min) if reward_min else None,
        reward_max=float(reward_max) if reward_max else None,
        skills=skills,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
        session=db,
    )
    
    return BountiesResponse(
        bounties=[BountyResponse.model_validate(b) for b in bounties],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/suggestions", response_model=SuggestionResponse)
async def get_suggestions(
    q: str = Query(..., min_length=1, description="Search query for autocomplete"),
    limit: int = Query(10, ge=1, le=20, description="Number of suggestions"),
    db: AsyncSession = Depends(get_db),
):
    """Get autocomplete suggestions for search."""
    suggestions = await search_service.get_autocomplete_suggestions(q, limit, db)
    
    return SuggestionResponse(suggestions=suggestions)


@router.get("/{bounty_id}", response_model=BountyResponse)
async def get_bounty(
    bounty_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get single bounty by ID."""
    from sqlalchemy import select
    from app.models.bounty import Bounty
    
    stmt = select(Bounty).where(Bounty.id == bounty_id)
    result = await db.execute(stmt)
    bounty = result.scalar_one_or_none()
    
    if not bounty:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Bounty not found")
    
    return BountyResponse.model_validate(bounty)
