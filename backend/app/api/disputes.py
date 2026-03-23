"""Dispute resolution API endpoints (Issue #192).

Provides RESTful endpoints for the full dispute lifecycle:
- POST   /disputes              — Initiate a dispute on a rejected submission
- GET    /disputes              — List disputes (filtered to user's own)
- GET    /disputes/{id}         — Get dispute detail with audit trail
- POST   /disputes/{id}/evidence — Submit additional evidence
- POST   /disputes/{id}/mediate  — Trigger AI-assisted mediation
- POST   /disputes/{id}/resolve  — Admin-only dispute resolution

All endpoints require authentication via the ``get_current_user_id``
dependency. Access control is enforced at the service layer: users
can only see and act on disputes where they are a participant.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.exceptions import (
    BountyNotFoundError,
    DisputeNotFoundError,
    DisputeWindowExpiredError,
    DuplicateDisputeError,
    InvalidDisputeTransitionError,
    SubmissionNotFoundError,
    UnauthorizedDisputeAccessError,
)
from app.models.dispute import (
    DisputeCreate,
    DisputeDetailResponse,
    DisputeEvidenceSubmit,
    DisputeListResponse,
    DisputeResolve,
    DisputeResponse,
)
from app.services.dispute_service import DisputeService

router = APIRouter(prefix="/disputes", tags=["disputes"])


def _get_service(db: AsyncSession = Depends(get_db)) -> DisputeService:
    """FastAPI dependency that creates a DisputeService for the current request.

    Args:
        db: The database session injected by FastAPI.

    Returns:
        A DisputeService instance bound to the request's DB session.
    """
    return DisputeService(db)


@router.post(
    "",
    response_model=DisputeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate a dispute",
)
async def create_dispute(
    data: DisputeCreate,
    user_id: str = Depends(get_current_user_id),
    service: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """Initiate a dispute on a rejected submission within the 72-hour window.

    The caller must be the contributor who submitted the rejected PR.
    A dispute can only be filed once per submission and within 72 hours
    of the rejection timestamp.

    Args:
        data: Dispute creation payload with bounty_id, submission_id, reason, etc.
        user_id: The authenticated user's ID.
        service: The dispute service instance.

    Returns:
        The newly created dispute.
    """
    try:
        return await service.create_dispute(data, user_id)
    except (BountyNotFoundError, SubmissionNotFoundError) as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
    except UnauthorizedDisputeAccessError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except (DuplicateDisputeError, DisputeWindowExpiredError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "",
    response_model=DisputeListResponse,
    summary="List disputes",
)
async def list_disputes(
    dispute_status: Optional[str] = Query(None, alias="status"),
    bounty_id: Optional[str] = Query(None),
    contributor_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    service: DisputeService = Depends(_get_service),
) -> DisputeListResponse:
    """List disputes with optional filters and pagination.

    Non-admin users only see disputes where they are a participant
    (contributor or creator). Admins see all disputes.

    Args:
        dispute_status: Optional filter by dispute status.
        bounty_id: Optional filter by bounty ID.
        contributor_id: Optional filter by contributor ID.
        skip: Pagination offset (default 0).
        limit: Page size (default 20, max 100).
        user_id: The authenticated user's ID.
        service: The dispute service instance.

    Returns:
        Paginated list of disputes.
    """
    return await service.list_disputes(
        user_id=user_id,
        status_filter=dispute_status,
        bounty_id=bounty_id,
        contributor_id=contributor_id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{dispute_id}",
    response_model=DisputeDetailResponse,
    summary="Get dispute detail",
)
async def get_dispute(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DisputeService = Depends(_get_service),
) -> DisputeDetailResponse:
    """Get a dispute's full detail including audit history timeline.

    Only dispute participants (contributor, creator) and admins can
    view dispute details.

    Args:
        dispute_id: The unique dispute identifier.
        user_id: The authenticated user's ID.
        service: The dispute service instance.

    Returns:
        Full dispute detail with history entries.
    """
    try:
        return await service.get_dispute(dispute_id, user_id)
    except DisputeNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
    except UnauthorizedDisputeAccessError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )


@router.post(
    "/{dispute_id}/evidence",
    response_model=DisputeResponse,
    summary="Submit evidence",
)
async def submit_evidence(
    dispute_id: str,
    data: DisputeEvidenceSubmit,
    user_id: str = Depends(get_current_user_id),
    service: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """Submit additional evidence for a dispute.

    Transitions the dispute from OPENED to EVIDENCE on the first
    evidence submission. Both participants can submit evidence.

    Args:
        dispute_id: The dispute to add evidence to.
        data: Evidence payload with links and optional notes.
        user_id: The authenticated user's ID.
        service: The dispute service instance.

    Returns:
        Updated dispute response.
    """
    try:
        return await service.submit_evidence(dispute_id, data, user_id)
    except DisputeNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
    except UnauthorizedDisputeAccessError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except InvalidDisputeTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.post(
    "/{dispute_id}/mediate",
    response_model=DisputeResponse,
    summary="Trigger AI mediation",
)
async def mediate(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """Move a dispute to mediation and trigger AI analysis.

    The dispute must be in EVIDENCE state. If the AI mediation score
    is >= 7.0/10, the dispute is auto-resolved in the contributor's
    favor. Otherwise it remains in MEDIATION awaiting admin resolution.

    Args:
        dispute_id: The dispute to advance to mediation.
        user_id: The authenticated user's ID.
        service: The dispute service instance.

    Returns:
        Updated dispute response (may be auto-resolved).
    """
    try:
        return await service.move_to_mediation(dispute_id, user_id)
    except DisputeNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
    except InvalidDisputeTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.post(
    "/{dispute_id}/resolve",
    response_model=DisputeResponse,
    summary="Resolve dispute (admin only)",
)
async def resolve(
    dispute_id: str,
    data: DisputeResolve,
    user_id: str = Depends(get_current_user_id),
    service: DisputeService = Depends(_get_service),
) -> DisputeResponse:
    """Resolve a dispute with an admin decision.

    Admin-only endpoint. The dispute must be in MEDIATION state.
    Possible outcomes: release_to_contributor, refund_to_creator, split.

    Args:
        dispute_id: The dispute to resolve.
        data: Resolution payload with outcome and notes.
        user_id: The authenticated admin user's ID.
        service: The dispute service instance.

    Returns:
        The resolved dispute response with reputation impacts applied.
    """
    try:
        return await service.resolve_dispute(dispute_id, data, user_id)
    except UnauthorizedDisputeAccessError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        )
    except DisputeNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
    except InvalidDisputeTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )
