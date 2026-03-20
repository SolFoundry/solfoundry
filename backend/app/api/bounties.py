"""Bounty API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bounty import (
    AutocompleteResponse,
    BountyCreate,
    BountyListResponse,
    BountyResponse,
    BountySearchParams,
    BountyUpdate,
)
from app.services.bounty_service import BountyService

router = APIRouter(prefix="/bounties", tags=["bounties"])


def get_bounty_service(db: AsyncSession = Depends(get_db)) -> BountyService:
    """Build a service instance for the current request."""

    return BountyService(db)


@router.get("", response_model=BountyListResponse)
async def list_bounties(
    tier: int | None = Query(None, ge=1, le=3, description="Filter by tier"),
    category: str | None = Query(None, description="Filter by category"),
    status_value: str | None = Query(None, alias="status", description="Filter by status"),
    reward_min: float | None = Query(None, ge=0, description="Minimum reward amount"),
    reward_max: float | None = Query(None, ge=0, description="Maximum reward amount"),
    skills: str | None = Query(None, description="Comma-separated list of required skills"),
    sort: str = Query(
        "newest",
        pattern="^(newest|reward_high|reward_low|deadline|popularity)$",
        description="Sort order",
    ),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    service: BountyService = Depends(get_bounty_service),
):
    """List bounties with the same filter semantics as search, without a text query."""

    params = BountySearchParams(
        tier=tier,
        category=category,
        status=status_value,
        reward_min=reward_min,
        reward_max=reward_max,
        skills=skills,
        sort=sort,
        skip=skip,
        limit=limit,
    )
    return await _search_or_400(service, params)


@router.get("/search", response_model=BountyListResponse)
async def search_bounties(
    q: str | None = Query(None, description="Search query for title and description"),
    tier: int | None = Query(None, ge=1, le=3, description="Filter by tier"),
    category: str | None = Query(None, description="Filter by category"),
    status_value: str | None = Query(None, alias="status", description="Filter by status"),
    reward_min: float | None = Query(None, ge=0, description="Minimum reward amount"),
    reward_max: float | None = Query(None, ge=0, description="Maximum reward amount"),
    skills: str | None = Query(None, description="Comma-separated list of required skills"),
    sort: str = Query(
        "newest",
        pattern="^(newest|reward_high|reward_low|deadline|popularity)$",
        description="Sort order",
    ),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    service: BountyService = Depends(get_bounty_service),
):
    """Full-text search and filter for bounties."""

    params = BountySearchParams(
        q=q,
        tier=tier,
        category=category,
        status=status_value,
        reward_min=reward_min,
        reward_max=reward_max,
        skills=skills,
        sort=sort,
        skip=skip,
        limit=limit,
    )
    return await _search_or_400(service, params)


@router.get("/autocomplete", response_model=AutocompleteResponse)
async def get_autocomplete(
    q: str = Query(..., min_length=2, description="Search query for autocomplete"),
    limit: int = Query(10, ge=1, le=20, description="Number of suggestions"),
    service: BountyService = Depends(get_bounty_service),
):
    """Return title and skill suggestions for the query."""

    return await service.get_autocomplete_suggestions(q, limit)


@router.get("/{bounty_id}", response_model=BountyResponse)
async def get_bounty(
    bounty_id: UUID,
    service: BountyService = Depends(get_bounty_service),
):
    """Get a single bounty by ID."""

    bounty = await service.get_bounty_by_id(bounty_id)
    if not bounty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")
    return BountyResponse.model_validate(bounty)


@router.post("", response_model=BountyResponse, status_code=status.HTTP_201_CREATED)
async def create_bounty(
    bounty: BountyCreate,
    service: BountyService = Depends(get_bounty_service),
):
    """Create a new bounty."""

    created = await service.create_bounty(bounty)
    return BountyResponse.model_validate(created)


@router.patch("/{bounty_id}", response_model=BountyResponse)
async def update_bounty(
    bounty_id: UUID,
    payload: BountyUpdate,
    service: BountyService = Depends(get_bounty_service),
):
    """Update an existing bounty."""

    bounty = await service.get_bounty_by_id(bounty_id)
    if not bounty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")

    updated = await service.update_bounty(bounty, payload)
    return BountyResponse.model_validate(updated)


@router.delete("/{bounty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bounty(
    bounty_id: UUID,
    service: BountyService = Depends(get_bounty_service),
):
    """Delete a bounty."""

    bounty = await service.get_bounty_by_id(bounty_id)
    if not bounty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bounty not found")

    await service.delete_bounty(bounty)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _search_or_400(service: BountyService, params: BountySearchParams) -> BountyListResponse:
    try:
        return await service.search_bounties(params)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
