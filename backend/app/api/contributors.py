"""Contributor profiles and reputation API router.

Provides CRUD endpoints for contributor profiles and delegates reputation
operations to the reputation service.  All contributor queries now hit
PostgreSQL via async sessions.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user_id
from app.constants import INTERNAL_SYSTEM_USER_ID
from app.exceptions import ContributorNotFoundError, TierNotUnlockedError
from app.models.contributor import (
    ContributorCreate,
    ContributorListResponse,
    ContributorResponse,
    ContributorUpdate,
)
from app.models.reputation import (
    ReputationHistoryEntry,
    ReputationRecordCreate,
    ReputationSummary,
)
from app.services import contributor_service, reputation_service

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
) -> ContributorListResponse:
    """List contributors with optional filtering and pagination.

    Supports text search on username/display_name, skill filtering,
    and badge filtering.  Results are paginated via ``skip`` and ``limit``.

    Args:
        search: Case-insensitive substring match.
        skills: Comma-separated skill names to filter by.
        badges: Comma-separated badge names to filter by.
        skip: Pagination offset.
        limit: Page size (max 100).

    Returns:
        Paginated contributor list with total count.
    """
    skill_list = skills.split(",") if skills else None
    badge_list = badges.split(",") if badges else None
    return await contributor_service.list_contributors(
        search=search, skills=skill_list, badges=badge_list, skip=skip, limit=limit
    )


@router.post("", response_model=ContributorResponse, status_code=201)
async def create_contributor(data: ContributorCreate) -> ContributorResponse:
    """Create a new contributor profile.

    Validates that the username is unique before inserting.

    Args:
        data: Contributor creation payload with username and profile info.

    Returns:
        The newly created contributor profile.

    Raises:
        HTTPException 409: Username already exists.
    """
    existing = await contributor_service.get_contributor_by_username(data.username)
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Username '{data.username}' already exists"
        )
    return await contributor_service.create_contributor(data)


@router.get("/leaderboard/reputation", response_model=list[ReputationSummary])
async def get_reputation_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[ReputationSummary]:
    """Return contributors ranked by reputation score.

    Args:
        limit: Maximum number of entries.
        offset: Pagination offset.

    Returns:
        List of reputation summaries sorted by score descending.
    """
    return await reputation_service.get_reputation_leaderboard(
        limit=limit, offset=offset
    )


@router.get("/{contributor_id}", response_model=ContributorResponse)
async def get_contributor(contributor_id: str) -> ContributorResponse:
    """Get a single contributor profile by ID.

    Args:
        contributor_id: UUID of the contributor.

    Returns:
        Full contributor profile including stats.

    Raises:
        HTTPException 404: Contributor not found.
    """
    contributor = await contributor_service.get_contributor(contributor_id)
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return contributor


@router.patch("/{contributor_id}", response_model=ContributorResponse)
async def update_contributor(
    contributor_id: str, data: ContributorUpdate
) -> ContributorResponse:
    """Partially update a contributor profile.

    Only fields present in the request body are updated.

    Args:
        contributor_id: UUID of the contributor to update.
        data: Partial update payload.

    Returns:
        The updated contributor profile.

    Raises:
        HTTPException 404: Contributor not found.
    """
    contributor = await contributor_service.update_contributor(contributor_id, data)
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return contributor


@router.delete("/{contributor_id}", status_code=204)
async def delete_contributor(contributor_id: str) -> None:
    """Delete a contributor profile by ID.

    Args:
        contributor_id: UUID of the contributor to delete.

    Raises:
        HTTPException 404: Contributor not found.
    """
    deleted = await contributor_service.delete_contributor(contributor_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contributor not found")


@router.get("/unsubscribe", status_code=200)
async def unsubscribe_contributor(
    token: str = Query(..., description="Unique unsubscribe token"),
    notification_type: Optional[str] = Query(
        None, description="Specific type to unsubscribe from"
    ),
) -> dict:
    """Handle one-click unsubscribe via token.

    If notification_type is provided, disables only that type.
    Otherwise, disables all email notifications globally.
    """
    contributor = await contributor_service.get_contributor_by_token(token)
    if not contributor:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token")

    update_data = {}
    if notification_type:
        prefs = contributor.notification_preferences.copy()
        prefs[notification_type] = False
        update_data["notification_preferences"] = prefs
    else:
        update_data["email_notifications_enabled"] = False

    await contributor_service.update_contributor(
        contributor.id, ContributorUpdate(**update_data)
    )

    return {
        "success": True,
        "message": f"Successfully unsubscribed from {notification_type or 'all emails'}.",
    }


@router.get("/{contributor_id}/reputation", response_model=ReputationSummary)
async def get_contributor_reputation(
    contributor_id: str,
) -> ReputationSummary:
    """Return full reputation profile for a contributor.

    Args:
        contributor_id: UUID of the contributor.

    Returns:
        Reputation summary with tier progression and badge info.

    Raises:
        HTTPException 404: Contributor not found.
    """
    summary = await reputation_service.get_reputation(contributor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return summary


@router.get(
    "/{contributor_id}/reputation/history",
    response_model=list[ReputationHistoryEntry],
)
async def get_contributor_reputation_history(
    contributor_id: str,
) -> list[ReputationHistoryEntry]:
    """Return per-bounty reputation history for a contributor.

    Args:
        contributor_id: UUID of the contributor.

    Returns:
        List of reputation history entries sorted newest-first.

    Raises:
        HTTPException 404: Contributor not found.
    """
    contributor = await contributor_service.get_contributor(contributor_id)
    if contributor is None:
        raise HTTPException(status_code=404, detail="Contributor not found")
    return await reputation_service.get_history(contributor_id)


@router.post(
    "/{contributor_id}/reputation",
    response_model=ReputationHistoryEntry,
    status_code=201,
)
async def record_contributor_reputation(
    contributor_id: str,
    data: ReputationRecordCreate,
    caller_id: str = Depends(get_current_user_id),
) -> ReputationHistoryEntry:
    """Record reputation earned from a completed bounty.

    Requires authentication.  The caller must be the contributor themselves
    or the internal system user (all-zeros UUID used by automated pipelines).

    Args:
        contributor_id: Path parameter -- the contributor receiving reputation.
        data: Reputation record payload.
        caller_id: Authenticated user ID injected by the auth dependency.

    Returns:
        The created reputation history entry.

    Raises:
        HTTPException 400: Path/body contributor_id mismatch.
        HTTPException 401: Missing credentials (from auth dependency).
        HTTPException 403: Caller is not authorized to record for this contributor.
        HTTPException 404: Contributor not found.
    """
    if data.contributor_id != contributor_id:
        raise HTTPException(
            status_code=400,
            detail="contributor_id in path must match body",
        )

    if caller_id != contributor_id and caller_id != INTERNAL_SYSTEM_USER_ID:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to record reputation for this contributor",
        )

    try:
        return await reputation_service.record_reputation(data)
    except ContributorNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except TierNotUnlockedError as error:
        raise HTTPException(status_code=400, detail=str(error))
