"""Milestone payout API endpoints for multi-stage bounty releases.

Provides REST endpoints for the milestone lifecycle:

- ``POST /bounties/{bounty_id}/milestones`` -- Create milestones (owner only).
- ``GET /bounties/{bounty_id}/milestones`` -- List milestones with progress.
- ``POST /milestones/{milestone_id}/submit`` -- Submit milestone (contributor).
- ``POST /milestones/{milestone_id}/approve`` -- Approve + trigger payout (owner).
- ``POST /milestones/{milestone_id}/reject`` -- Reject milestone (owner).

All mutation endpoints require authentication via ``get_current_user``.
Ownership and contributor checks are enforced at the service layer.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database import get_db
from app.exceptions import (
    BountyNotFoundError,
    DuplicateMilestoneError,
    InvalidMilestoneTransitionError,
    MilestoneNotFoundError,
    MilestonePercentageError,
    MilestoneSequenceError,
    UnauthorizedMilestoneAccessError,
)
from app.models.errors import ErrorResponse
from app.models.milestone import (
    MilestoneBatchCreate,
    MilestoneListResponse,
    MilestoneRejectRequest,
    MilestoneResponse,
    MilestoneSubmitRequest,
)
from app.models.user import UserResponse
from app.services import milestone_service

router = APIRouter(tags=["milestones"])


def _get_caller_id(user: UserResponse) -> str:
    """Extract the caller identifier from an authenticated user.

    Prefers the wallet address (a Solana public key) when available,
    falling back to the user's internal ID as a string.

    Args:
        user: The authenticated user injected by the auth dependency.

    Returns:
        A string identifier suitable for ownership and contributor checks.
    """
    return user.wallet_address or str(user.id)


# ---------------------------------------------------------------------------
# Create milestones for a bounty (owner only)
# ---------------------------------------------------------------------------


@router.post(
    "/bounties/{bounty_id}/milestones",
    response_model=MilestoneListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create milestones for a bounty",
    description="""
    Define milestone checkpoints for a bounty's multi-stage payout.

    Only the bounty owner can create milestones. Milestones are defined
    as a batch and their percentages must sum to exactly 100%.  Once
    created, milestones cannot be replaced.
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid milestone data"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        403: {"model": ErrorResponse, "description": "Not the bounty owner"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
        409: {"model": ErrorResponse, "description": "Milestones already exist"},
    },
)
async def create_milestones(
    bounty_id: UUID,
    data: MilestoneBatchCreate,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MilestoneListResponse:
    """Validate input and create milestones for the bounty.

    The authenticated user must be the bounty owner. Milestone numbers
    are assigned sequentially (1-based) in the order provided.

    Args:
        bounty_id: UUID of the parent bounty.
        data: Batch of milestone definitions with percentages summing to 100%.
        user: The authenticated user (injected by dependency).
        db: Database session (injected by dependency).

    Returns:
        MilestoneListResponse with all created milestones.
    """
    caller_id = _get_caller_id(user)
    try:
        result = await milestone_service.create_milestones(
            db=db,
            bounty_id=str(bounty_id),
            data=data,
            created_by=caller_id,
        )
        await db.commit()
        return result
    except BountyNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except DuplicateMilestoneError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except MilestonePercentageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except UnauthorizedMilestoneAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ---------------------------------------------------------------------------
# List milestones for a bounty (public)
# ---------------------------------------------------------------------------


@router.get(
    "/bounties/{bounty_id}/milestones",
    response_model=MilestoneListResponse,
    summary="List milestones for a bounty",
    description="""
    Retrieve all milestones for a bounty ordered by milestone number.
    Includes progress aggregates (total approved %, total paid %, total amount paid).
    This endpoint is public and does not require authentication.
    """,
    responses={
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def list_milestones(
    bounty_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> MilestoneListResponse:
    """Retrieve milestones with progress tracking for the bounty detail page.

    Args:
        bounty_id: UUID of the parent bounty.
        db: Database session (injected by dependency).

    Returns:
        MilestoneListResponse with milestones and progress aggregates.
    """
    try:
        return await milestone_service.get_milestones(db=db, bounty_id=str(bounty_id))
    except BountyNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ---------------------------------------------------------------------------
# Submit a milestone (contributor only)
# ---------------------------------------------------------------------------


@router.post(
    "/milestones/{milestone_id}/submit",
    response_model=MilestoneResponse,
    summary="Submit a milestone for approval",
    description="""
    A contributor submits a milestone with evidence of completion.
    The milestone must be in PENDING or REJECTED status.
    Only the assigned contributor can submit milestones.
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid submission"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        403: {"model": ErrorResponse, "description": "Not the assigned contributor"},
        404: {"model": ErrorResponse, "description": "Milestone not found"},
        409: {"model": ErrorResponse, "description": "Invalid status transition"},
    },
)
async def submit_milestone(
    milestone_id: UUID,
    data: MilestoneSubmitRequest,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MilestoneResponse:
    """Submit a milestone for the bounty owner to review.

    The evidence field should contain a link to the deliverable (e.g.
    a GitHub PR URL) or a description of what was completed.

    Args:
        milestone_id: UUID of the milestone to submit.
        data: Submission evidence.
        user: The authenticated contributor (injected by dependency).
        db: Database session (injected by dependency).

    Returns:
        The updated MilestoneResponse in SUBMITTED state.
    """
    caller_id = _get_caller_id(user)
    try:
        result = await milestone_service.submit_milestone(
            db=db,
            milestone_id=str(milestone_id),
            submitted_by=caller_id,
            evidence=data.evidence,
        )
        await db.commit()
        return result
    except MilestoneNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InvalidMilestoneTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except UnauthorizedMilestoneAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ---------------------------------------------------------------------------
# Approve a milestone (owner only) -- triggers payout
# ---------------------------------------------------------------------------


@router.post(
    "/milestones/{milestone_id}/approve",
    response_model=MilestoneResponse,
    summary="Approve a milestone and trigger payout",
    description="""
    The bounty owner approves a submitted milestone, triggering a
    proportional $FNDRY payout to the contributor.

    Milestone N+1 cannot be approved before milestone N is approved.
    Uses atomic compare-and-swap to prevent double-approval.
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        403: {"model": ErrorResponse, "description": "Not the bounty owner"},
        404: {"model": ErrorResponse, "description": "Milestone not found"},
        409: {"model": ErrorResponse, "description": "Invalid transition or sequence"},
    },
)
async def approve_milestone(
    milestone_id: UUID,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MilestoneResponse:
    """Approve the milestone and execute the proportional SPL transfer.

    The payout amount is calculated as:
        bounty.reward_amount * (milestone.percentage / 100)

    Args:
        milestone_id: UUID of the milestone to approve.
        user: The authenticated bounty owner (injected by dependency).
        db: Database session (injected by dependency).

    Returns:
        The updated MilestoneResponse with payout details.
    """
    caller_id = _get_caller_id(user)
    try:
        result = await milestone_service.approve_milestone(
            db=db,
            milestone_id=str(milestone_id),
            approved_by=caller_id,
        )
        await db.commit()
        return result
    except MilestoneNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InvalidMilestoneTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except MilestoneSequenceError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except UnauthorizedMilestoneAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ---------------------------------------------------------------------------
# Reject a milestone (owner only)
# ---------------------------------------------------------------------------


@router.post(
    "/milestones/{milestone_id}/reject",
    response_model=MilestoneResponse,
    summary="Reject a submitted milestone",
    description="""
    The bounty owner rejects a submitted milestone. The contributor
    can then re-submit after addressing the feedback.
    The rejection reason is optional.
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        403: {"model": ErrorResponse, "description": "Not the bounty owner"},
        404: {"model": ErrorResponse, "description": "Milestone not found"},
        409: {"model": ErrorResponse, "description": "Invalid status transition"},
    },
)
async def reject_milestone(
    milestone_id: UUID,
    data: MilestoneRejectRequest,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MilestoneResponse:
    """Reject the milestone and allow the contributor to re-submit.

    Args:
        milestone_id: UUID of the milestone to reject.
        data: Optional rejection reason.
        user: The authenticated bounty owner (injected by dependency).
        db: Database session (injected by dependency).

    Returns:
        The updated MilestoneResponse in REJECTED state.
    """
    caller_id = _get_caller_id(user)
    try:
        result = await milestone_service.reject_milestone(
            db=db,
            milestone_id=str(milestone_id),
            rejected_by=caller_id,
            reason=data.reason,
        )
        await db.commit()
        return result
    except MilestoneNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InvalidMilestoneTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except UnauthorizedMilestoneAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
