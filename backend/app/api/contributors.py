"""Contributor profiles and reputation API router."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
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
):
    """List contributors with optional filtering and pagination."""
    skill_list = skills.split(",") if skills else None
    badge_list = badges.split(",") if badges else None
    return contributor_service.list_contributors(
        search=search, skills=skill_list, badges=badge_list, skip=skip, limit=limit
    )


@router.post("", response_model=ContributorResponse, status_code=201)
async def create_contributor(data: ContributorCreate):
    """Create a new contributor profile."""
    if contributor_service.get_contributor_by_username(data.username):
        raise HTTPException(status_code=409, detail=f"Username '{data.username}' already exists")
    return contributor_service.create_contributor(data)


@router.get("/leaderboard/reputation", response_model=list[ReputationSummary])
async def get_reputation_leaderboard(
    limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
):
    """Return contributors ranked by reputation score."""
    return reputation_service.get_reputation_leaderboard(limit=limit, offset=offset)


@router.get("/{contributor_id}", response_model=ContributorResponse)
async def get_contributor(contributor_id: str):
    """Get a single contributor profile by ID."""
    c = contributor_service.get_contributor(contributor_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return c


@router.patch("/{contributor_id}", response_model=ContributorResponse)
async def update_contributor(contributor_id: str, data: ContributorUpdate):
    """Partially update a contributor profile."""
    c = contributor_service.update_contributor(contributor_id, data)
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return c


@router.delete("/{contributor_id}", status_code=204)
async def delete_contributor(contributor_id: str):
    """Delete a contributor profile by ID."""
    if not contributor_service.delete_contributor(contributor_id):
        raise HTTPException(status_code=404, detail="Contributor not found")


@router.get("/{contributor_id}/reputation", response_model=ReputationSummary)
async def get_contributor_reputation(contributor_id: str):
    """Return full reputation profile for a contributor."""
    summary = reputation_service.get_reputation(contributor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return summary


@router.get("/{contributor_id}/reputation/history", response_model=list[ReputationHistoryEntry])
async def get_contributor_reputation_history(contributor_id: str):
    """Return per-bounty reputation history for a contributor."""
    if contributor_service.get_contributor(contributor_id) is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return reputation_service.get_history(contributor_id)


@router.post("/{contributor_id}/reputation", response_model=ReputationHistoryEntry, status_code=201)
async def record_contributor_reputation(contributor_id: str, data: ReputationRecordCreate):
    """Record reputation earned from a completed bounty."""
    if data.contributor_id != contributor_id:
        raise HTTPException(status_code=400, detail="contributor_id in path must match body")
    try:
        return reputation_service.record_reputation(data)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
