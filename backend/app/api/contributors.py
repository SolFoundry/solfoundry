"""Contributor profiles and reputation API router."""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.constants import INTERNAL_SYSTEM_USER_ID
from app.exceptions import ContributorNotFoundError, TierNotUnlockedError
from app.database import get_db
from app.models.contributor import (
    ContributorCreate, ContributorResponse, ContributorListResponse, ContributorUpdate,
)
from app.models.reputation import ReputationRecordCreate, ReputationSummary, ReputationHistoryEntry
from app.services import contributor_service, reputation_service

router = APIRouter(prefix="/contributors", tags=["contributors"])


@router.get("", response_model=ContributorListResponse)
async def list_contributors(
    search: Optional[str] = Query(None, description="Search by username or display name"),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    badges: Optional[str] = Query(None, description="Comma-separated badge filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List contributors with optional filtering and pagination."""
    skill_list = skills.split(",") if skills else None
    badge_list = badges.split(",") if badges else None
    return await contributor_service.list_contributors(
        db, search=search, skills=skill_list, badges=badge_list, skip=skip, limit=limit
    )


@router.post("", response_model=ContributorResponse, status_code=201)
async def create_contributor(data: ContributorCreate, db: AsyncSession = Depends(get_db)):
    """Create a new contributor profile."""
    if await contributor_service.get_contributor_by_username(db, data.username):
        raise HTTPException(status_code=409, detail=f"Username '{data.username}' already exists")
    return await contributor_service.create_contributor(db, data)


@router.get("/leaderboard/reputation", response_model=list[ReputationSummary])
async def get_reputation_leaderboard(
    limit: int = Query(20, ge=1, le=100), 
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return contributors ranked by reputation score."""
    return await reputation_service.get_reputation_leaderboard(db, limit=limit, offset=offset)


@router.get("/{contributor_id}", response_model=ContributorResponse)
async def get_contributor(contributor_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single contributor profile by ID."""
    c = await contributor_service.get_contributor(db, contributor_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return c


@router.patch("/{contributor_id}", response_model=ContributorResponse)
async def update_contributor(
    contributor_id: str, 
    data: ContributorUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Partially update a contributor profile."""
    c = await contributor_service.update_contributor(db, contributor_id, data)
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return c


@router.delete("/{contributor_id}", status_code=204)
async def delete_contributor(contributor_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a contributor profile by ID."""
    if not await contributor_service.delete_contributor(db, contributor_id):
        raise HTTPException(status_code=404, detail="Contributor not found")


@router.get("/{contributor_id}/reputation", response_model=ReputationSummary)
async def get_contributor_reputation(contributor_id: str, db: AsyncSession = Depends(get_db)):
    """Return full reputation profile for a contributor."""
    summary = await reputation_service.get_reputation(db, contributor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return summary


@router.get("/{contributor_id}/reputation/history", response_model=list[ReputationHistoryEntry])
async def get_contributor_reputation_history(contributor_id: str, db: AsyncSession = Depends(get_db)):
    """Return per-bounty reputation history for a contributor."""
    if await contributor_service.get_contributor(db, contributor_id) is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return await reputation_service.get_history(db, contributor_id)


@router.post("/{contributor_id}/reputation", response_model=ReputationHistoryEntry, status_code=201)
async def record_contributor_reputation(
    contributor_id: str,
    data: ReputationRecordCreate,
    caller_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Record reputation earned from a completed bounty."""
    if data.contributor_id != contributor_id:
        raise HTTPException(status_code=400, detail="contributor_id in path must match body")

    # Allow internal system user (automated review pipeline) or the contributor themselves
    if caller_id != contributor_id and caller_id != INTERNAL_SYSTEM_USER_ID:
        raise HTTPException(status_code=403, detail="Not authorized to record reputation for this contributor")

    try:
        return await reputation_service.record_reputation(db, data)
    except ContributorNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except TierNotUnlockedError as error:
        raise HTTPException(status_code=400, detail=str(error))
