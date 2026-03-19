"""PR Status Tracker API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pr_tracker import (
    PRTrackerResponse,
    PRTrackerListResponse,
    PRTrackerCreate,
    PRTrackerUpdate,
)
from app.services.pr_tracker_service import PRTrackerService
from app.database import get_db

router = APIRouter(prefix="/pr-trackers", tags=["pr-trackers"])


@router.get("", response_model=PRTrackerListResponse)
async def list_pr_trackers(
    repository: Optional[str] = Query(None, description="Filter by repository"),
    status: Optional[str] = Query(None, description="Filter by status"),
    author: Optional[str] = Query(None, description="Filter by author"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    db: AsyncSession = Depends(get_db),
):
    """
    List PR trackers with optional filters.
    
    - **repository**: Filter by repository (e.g., 'owner/repo')
    - **status**: Filter by status (draft, open, in_review, approved, merged, closed)
    - **author**: Filter by PR author
    - **skip**: Pagination offset
    - **limit**: Number of results per page
    """
    service = PRTrackerService(db)
    return await service.list_prs(
        repository=repository,
        status=status,
        author=author,
        skip=skip,
        limit=limit,
    )


@router.get("/{repository}/{pr_number}", response_model=PRTrackerResponse)
async def get_pr_tracker(
    repository: str,
    pr_number: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific PR tracker.
    
    - **repository**: Repository full name (e.g., 'owner/repo')
    - **pr_number**: PR number
    """
    service = PRTrackerService(db)
    tracker = await service.get_pr(repository, pr_number)
    
    if not tracker:
        raise HTTPException(status_code=404, detail="PR tracker not found")
    
    return tracker


@router.post("", response_model=PRTrackerResponse, status_code=201)
async def create_pr_tracker(
    data: PRTrackerCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new PR tracker.
    
    - **pr_number**: PR number
    - **repository**: Repository full name
    - **title**: PR title
    - **author**: PR author
    - **bounty_id**: Linked bounty ID (optional)
    """
    service = PRTrackerService(db)
    tracker = await service.create_pr(data)
    
    return PRTrackerResponse.model_validate(tracker)


@router.patch("/{repository}/{pr_number}", response_model=PRTrackerResponse)
async def update_pr_tracker(
    repository: str,
    pr_number: int,
    data: PRTrackerUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a PR tracker.
    
    - **repository**: Repository full name
    - **pr_number**: PR number
    """
    service = PRTrackerService(db)
    tracker = await service.update_pr(repository, pr_number, data)
    
    if not tracker:
        raise HTTPException(status_code=404, detail="PR tracker not found")
    
    return PRTrackerResponse.model_validate(tracker)


@router.delete("/{repository}/{pr_number}")
async def delete_pr_tracker(
    repository: str,
    pr_number: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a PR tracker.
    
    - **repository**: Repository full name
    - **pr_number**: PR number
    """
    service = PRTrackerService(db)
    success = await service.delete_pr(repository, pr_number)
    
    if not success:
        raise HTTPException(status_code=404, detail="PR tracker not found")
    
    return {"message": "PR tracker deleted"}