"""Bounty search and filter API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
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
)
from app.services.bounty_service import BountySearchService
from app.database import get_db
from app.core.errors import NotFoundException, ValidationException, ErrorCode
from app.core.logging_config import get_logger
from app.core.audit import audit_log, AuditAction


logger = get_logger(__name__)
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
    logger.info(
        "Searching bounties",
        extra={"extra_data": {
            "query": q,
            "tier": tier,
            "category": category,
            "status": status,
        }}
    )
    
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
    
    logger.debug(f"Fetching bounty: {bounty_id}")
    
    query = select(BountyDB).where(BountyDB.id == bounty_id)
    result = await db.execute(query)
    bounty = result.scalar_one_or_none()
    
    if not bounty:
        raise NotFoundException("Bounty", bounty_id)
    
    return BountyResponse.model_validate(bounty)


@router.post("/", response_model=BountyResponse, status_code=201)
async def create_bounty(
    bounty: BountyCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new bounty."""
    from app.models.bounty import BountyDB
    
    logger.info(
        "Creating bounty",
        extra={"extra_data": {
            "title": bounty.title,
            "tier": bounty.tier,
            "reward": bounty.reward_amount,
        }}
    )
    
    db_bounty = BountyDB(**bounty.model_dump())
    db.add(db_bounty)
    await db.commit()
    await db.refresh(db_bounty)
    
    # Update search vector
    service = BountySearchService(db)
    await service.update_search_vector(str(db_bounty.id))
    
    # Audit log
    audit_log(
        action=AuditAction.BOUNTY_CREATED,
        actor="api",  # Would be replaced with actual user in auth implementation
        resource="bounty",
        resource_id=str(db_bounty.id),
        metadata={
            "title": bounty.title,
            "tier": bounty.tier,
            "reward": bounty.reward_amount,
        }
    )
    
    logger.info(f"Bounty created: {db_bounty.id}")
    
    return BountyResponse.model_validate(db_bounty)


@router.patch("/{bounty_id}", response_model=BountyResponse)
async def update_bounty(
    bounty_id: str,
    bounty_update: BountyUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing bounty."""
    from app.models.bounty import BountyDB
    
    # Fetch existing bounty
    query = select(BountyDB).where(BountyDB.id == bounty_id)
    result = await db.execute(query)
    bounty = result.scalar_one_or_none()
    
    if not bounty:
        raise NotFoundException("Bounty", bounty_id)
    
    # Update fields
    update_data = bounty_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bounty, field, value)
    
    await db.commit()
    await db.refresh(bounty)
    
    logger.info(
        "Bounty updated",
        extra={"extra_data": {
            "bounty_id": bounty_id,
            "fields_updated": list(update_data.keys()),
        }}
    )
    
    return BountyResponse.model_validate(bounty)


@router.delete("/{bounty_id}", status_code=204)
async def delete_bounty(
    bounty_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a bounty."""
    from app.models.bounty import BountyDB
    
    query = select(BountyDB).where(BountyDB.id == bounty_id)
    result = await db.execute(query)
    bounty = result.scalar_one_or_none()
    
    if not bounty:
        raise NotFoundException("Bounty", bounty_id)
    
    await db.delete(bounty)
    await db.commit()
    
    logger.info(f"Bounty deleted: {bounty_id}")