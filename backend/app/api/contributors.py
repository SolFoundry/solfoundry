"""Contributor profiles API router."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.contributor import ContributorCreate, ContributorResponse, ContributorListResponse, ContributorUpdate
from app.services import contributor_service

router = APIRouter(prefix="/contributors", tags=["contributors"])


@router.get("", response_model=ContributorListResponse)
async def list_contributors(
    search: Optional[str] = Query(None, description="Search by username or display name"),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    badges: Optional[str] = Query(None, description="Comma-separated badge filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    skill_list = skills.split(",") if skills else None
    badge_list = badges.split(",") if badges else None
    return contributor_service.list_contributors(search=search, skills=skill_list, badges=badge_list, skip=skip, limit=limit)


@router.post("", response_model=ContributorResponse, status_code=201)
async def create_contributor(data: ContributorCreate):
    if contributor_service.get_contributor_by_username(data.username):
        raise HTTPException(status_code=409, detail=f"Username '{data.username}' already exists")
    return contributor_service.create_contributor(data)


@router.get("/{contributor_id}", response_model=ContributorResponse)
async def get_contributor(contributor_id: str):
    c = contributor_service.get_contributor(contributor_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return c


@router.patch("/{contributor_id}", response_model=ContributorResponse)
async def update_contributor(contributor_id: str, data: ContributorUpdate):
    c = contributor_service.update_contributor(contributor_id, data)
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return c


@router.delete("/{contributor_id}", status_code=204)
async def delete_contributor(contributor_id: str):
    if not contributor_service.delete_contributor(contributor_id):
        raise HTTPException(status_code=404, detail="Contributor not found")
