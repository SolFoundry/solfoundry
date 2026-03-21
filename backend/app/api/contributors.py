"""Contributor profiles API router."""

from typing import Optional
from fastapi import APIRouter, Query
from app.models.contributor import (
    ContributorCreate,
    ContributorResponse,
    ContributorListResponse,
    ContributorUpdate,
)
from app.services import contributor_service
from app.core.errors import NotFoundException, ConflictException
from app.core.logging_config import get_logger
from app.core.audit import audit_log, AuditAction


logger = get_logger(__name__)
router = APIRouter(prefix="/contributors", tags=["contributors"])


@router.get("", response_model=ContributorListResponse)
async def list_contributors(
    search: Optional[str] = Query(
        None, description="Search by username or display name"
    ),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    badges: Optional[str] = Query(None, description="Comma-separated badge filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List contributors with optional filtering."""
    logger.debug(
        "Listing contributors",
        extra={
            "extra_data": {
                "search": search,
                "skills": skills,
                "badges": badges,
            }
        },
    )

    skill_list = skills.split(",") if skills else None
    badge_list = badges.split(",") if badges else None
    return contributor_service.list_contributors(
        search=search, skills=skill_list, badges=badge_list, skip=skip, limit=limit
    )


@router.post("", response_model=ContributorResponse, status_code=201)
async def create_contributor(data: ContributorCreate):
    """Create a new contributor profile."""
    logger.info(f"Creating contributor: {data.username}")

    if contributor_service.get_contributor_by_username(data.username):
        raise ConflictException(f"Username '{data.username}' already exists")

    contributor = contributor_service.create_contributor(data)

    # Audit log
    audit_log(
        action=AuditAction.CONTRIBUTOR_REGISTERED,
        actor=data.username,
        resource="contributor",
        resource_id=contributor.id,
        metadata={
            "username": data.username,
        },
    )

    logger.info(f"Contributor created: {contributor.id}")

    return contributor


@router.get("/{contributor_id}", response_model=ContributorResponse)
async def get_contributor(contributor_id: str):
    """Get a contributor by ID."""
    logger.debug(f"Fetching contributor: {contributor_id}")

    c = contributor_service.get_contributor(contributor_id)
    if not c:
        raise NotFoundException("Contributor", contributor_id)
    return c


@router.patch("/{contributor_id}", response_model=ContributorResponse)
async def update_contributor(contributor_id: str, data: ContributorUpdate):
    """Update a contributor profile."""
    logger.info(f"Updating contributor: {contributor_id}")

    c = contributor_service.update_contributor(contributor_id, data)
    if not c:
        raise NotFoundException("Contributor", contributor_id)

    # Audit log
    audit_log(
        action=AuditAction.CONTRIBUTOR_PROFILE_UPDATED,
        actor=contributor_id,
        resource="contributor",
        resource_id=contributor_id,
    )

    return c


@router.delete("/{contributor_id}", status_code=204)
async def delete_contributor(contributor_id: str):
    """Delete a contributor profile."""
    logger.info(f"Deleting contributor: {contributor_id}")

    if not contributor_service.delete_contributor(contributor_id):
        raise NotFoundException("Contributor", contributor_id)
    
    # Audit log
    audit_log(
        action=AuditAction.CONTRIBUTOR_BANNED,
        actor="api",
        resource="contributor",
        resource_id=contributor_id,
    )
