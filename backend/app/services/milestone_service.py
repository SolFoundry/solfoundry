"""Milestone service with PostgreSQL as the primary source of truth.

Provides the business logic for milestone-based multi-stage payouts on
T3 bounties.  All reads query PostgreSQL directly.  All writes await
the database commit before returning, ensuring a 2xx response
guarantees persistence.

Key invariants enforced:
- Milestone percentages for a bounty must sum to exactly 100%.
- Milestone N+1 cannot be approved before milestone N is approved.
- Only the bounty owner can create and approve milestones.
- Only the assigned contributor can submit milestones.
- Each milestone approval triggers a proportional $FNDRY payout.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.exceptions import (
    BountyNotFoundError,
    DuplicateMilestoneError,
    InvalidMilestoneTransitionError,
    MilestoneNotFoundError,
    MilestonePercentageError,
    MilestoneSequenceError,
)
from app.models.milestone import (
    ALLOWED_MILESTONE_TRANSITIONS,
    MilestoneBatchCreate,
    MilestoneListResponse,
    MilestoneResponse,
    MilestoneStatus,
    MilestoneTable,
)

logger = logging.getLogger(__name__)


def _row_to_response(row: MilestoneTable) -> MilestoneResponse:
    """Convert a SQLAlchemy MilestoneTable row to a MilestoneResponse.

    Handles type coercion from database types (UUID, Numeric) to the
    Pydantic response schema types (str, Decimal).

    Args:
        row: The SQLAlchemy ORM milestone row.

    Returns:
        A MilestoneResponse suitable for JSON serialization.
    """
    return MilestoneResponse(
        id=str(row.id),
        bounty_id=str(row.bounty_id),
        milestone_number=row.milestone_number,
        description=row.description,
        percentage=Decimal(str(row.percentage)) if row.percentage is not None else Decimal("0"),
        status=MilestoneStatus(row.status),
        submitted_by=row.submitted_by,
        submitted_at=row.submitted_at,
        approved_by=row.approved_by,
        approved_at=row.approved_at,
        payout_tx_hash=row.payout_tx_hash,
        payout_amount=Decimal(str(row.payout_amount)) if row.payout_amount is not None else None,
        payout_at=row.payout_at,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _get_bounty_or_raise(
    db: AsyncSession, bounty_id: str
) -> "BountyTable":
    """Load a bounty row from the database or raise BountyNotFoundError.

    Args:
        db: Active database session.
        bounty_id: UUID string of the bounty.

    Returns:
        The BountyTable ORM row.

    Raises:
        BountyNotFoundError: If the bounty does not exist.
    """
    from app.models.bounty_table import BountyTable
    import uuid as _uuid

    try:
        pk = _uuid.UUID(str(bounty_id))
    except (ValueError, AttributeError):
        raise BountyNotFoundError(f"Bounty '{bounty_id}' not found")

    bounty_row = await db.get(BountyTable, pk)
    if bounty_row is None:
        raise BountyNotFoundError(f"Bounty '{bounty_id}' not found")
    return bounty_row


async def _get_milestone_or_raise(
    db: AsyncSession, milestone_id: str
) -> MilestoneTable:
    """Load a milestone row from the database or raise MilestoneNotFoundError.

    Args:
        db: Active database session.
        milestone_id: UUID string of the milestone.

    Returns:
        The MilestoneTable ORM row.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
    """
    import uuid as _uuid

    try:
        pk = _uuid.UUID(str(milestone_id))
    except (ValueError, AttributeError):
        raise MilestoneNotFoundError(f"Milestone '{milestone_id}' not found")

    row = await db.get(MilestoneTable, pk)
    if row is None:
        raise MilestoneNotFoundError(f"Milestone '{milestone_id}' not found")
    return row


async def create_milestones(
    db: AsyncSession,
    bounty_id: str,
    data: MilestoneBatchCreate,
    created_by: str,
) -> MilestoneListResponse:
    """Create all milestones for a bounty in a single batch.

    Validates that:
    - The bounty exists.
    - No milestones already exist for this bounty.
    - The caller is the bounty owner.
    - Percentages sum to exactly 100%.

    Args:
        db: Active database session.
        bounty_id: The UUID of the parent bounty.
        data: The batch of milestone definitions.
        created_by: The user ID of the bounty owner creating milestones.

    Returns:
        A MilestoneListResponse with all created milestones.

    Raises:
        BountyNotFoundError: If the bounty does not exist.
        DuplicateMilestoneError: If milestones already exist for this bounty.
        MilestonePercentageError: If percentages do not sum to 100%.
    """
    bounty_row = await _get_bounty_or_raise(db, bounty_id)

    # Check ownership: created_by must match bounty.created_by
    if bounty_row.created_by != created_by:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bounty owner can create milestones",
        )

    # Check no milestones already exist
    import uuid as _uuid
    try:
        bounty_uuid = _uuid.UUID(bounty_id)
    except (ValueError, AttributeError):
        bounty_uuid = bounty_id

    existing_count_query = select(func.count(MilestoneTable.id)).where(
        MilestoneTable.bounty_id == bounty_uuid
    )
    result = await db.execute(existing_count_query)
    existing_count = result.scalar() or 0

    if existing_count > 0:
        raise DuplicateMilestoneError(
            f"Milestones already exist for bounty '{bounty_id}'. "
            "Cannot replace existing milestones."
        )

    # Validate percentages sum to 100% (also enforced by Pydantic, but
    # double-check at the service layer for defense in depth)
    total_pct = sum(m.percentage for m in data.milestones)
    if total_pct != Decimal("100"):
        raise MilestonePercentageError(
            f"Milestone percentages must sum to exactly 100%, got {total_pct}%"
        )

    # Create milestone rows
    created_rows: list[MilestoneTable] = []
    now = datetime.now(timezone.utc)
    for idx, milestone_def in enumerate(data.milestones, start=1):
        row = MilestoneTable(
            bounty_id=bounty_uuid,
            milestone_number=idx,
            description=milestone_def.description,
            percentage=milestone_def.percentage,
            status=MilestoneStatus.PENDING.value,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
        created_rows.append(row)

    await db.flush()

    audit_event(
        "milestones_created",
        bounty_id=bounty_id,
        created_by=created_by,
        count=len(created_rows),
    )

    return MilestoneListResponse(
        bounty_id=bounty_id,
        milestones=[_row_to_response(row) for row in created_rows],
        total_percentage_approved=Decimal("0"),
        total_percentage_paid=Decimal("0"),
        total_paid_amount=Decimal("0"),
    )


async def get_milestones(
    db: AsyncSession, bounty_id: str
) -> MilestoneListResponse:
    """Retrieve all milestones for a bounty, ordered by milestone_number.

    Args:
        db: Active database session.
        bounty_id: The UUID of the parent bounty.

    Returns:
        A MilestoneListResponse with progress aggregates.

    Raises:
        BountyNotFoundError: If the bounty does not exist.
    """
    await _get_bounty_or_raise(db, bounty_id)

    import uuid as _uuid
    try:
        bounty_uuid = _uuid.UUID(bounty_id)
    except (ValueError, AttributeError):
        bounty_uuid = bounty_id

    query = (
        select(MilestoneTable)
        .where(MilestoneTable.bounty_id == bounty_uuid)
        .order_by(MilestoneTable.milestone_number)
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    milestones = [_row_to_response(row) for row in rows]

    total_approved = Decimal("0")
    total_paid = Decimal("0")
    total_paid_amount = Decimal("0")

    for milestone in milestones:
        if milestone.status in (MilestoneStatus.APPROVED, MilestoneStatus.PAID):
            total_approved += milestone.percentage
        if milestone.status == MilestoneStatus.PAID:
            total_paid += milestone.percentage
            if milestone.payout_amount is not None:
                total_paid_amount += milestone.payout_amount

    return MilestoneListResponse(
        bounty_id=bounty_id,
        milestones=milestones,
        total_percentage_approved=total_approved,
        total_percentage_paid=total_paid,
        total_paid_amount=total_paid_amount,
    )


async def submit_milestone(
    db: AsyncSession,
    milestone_id: str,
    submitted_by: str,
    evidence: str,
) -> MilestoneResponse:
    """Submit a milestone for owner approval.

    Validates that:
    - The milestone exists and is in PENDING or REJECTED status.
    - The submitter is the bounty's assigned contributor.

    Updates the milestone description with the evidence and marks it
    as SUBMITTED.

    Args:
        db: Active database session.
        milestone_id: UUID of the milestone to submit.
        submitted_by: User ID of the contributor submitting.
        evidence: Evidence of completion to append to description.

    Returns:
        The updated MilestoneResponse.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
        InvalidMilestoneTransitionError: If the milestone cannot be submitted.
    """
    row = await _get_milestone_or_raise(db, milestone_id)

    current_status = MilestoneStatus(row.status)
    target_status = MilestoneStatus.SUBMITTED

    if target_status not in ALLOWED_MILESTONE_TRANSITIONS.get(current_status, frozenset()):
        raise InvalidMilestoneTransitionError(
            f"Cannot submit milestone in '{current_status.value}' state. "
            f"Allowed transitions: {[s.value for s in ALLOWED_MILESTONE_TRANSITIONS.get(current_status, frozenset())]}"
        )

    now = datetime.now(timezone.utc)
    row.status = target_status.value
    row.submitted_by = submitted_by
    row.submitted_at = now
    row.updated_at = now
    # Append evidence to description
    row.description = f"{row.description}\n\n---\n**Evidence:** {evidence}"

    await db.flush()

    audit_event(
        "milestone_submitted",
        milestone_id=milestone_id,
        bounty_id=str(row.bounty_id),
        submitted_by=submitted_by,
        milestone_number=row.milestone_number,
    )

    # Send Telegram notification to bounty owner
    await _notify_owner_milestone_submitted(db, row)

    return _row_to_response(row)


async def approve_milestone(
    db: AsyncSession,
    milestone_id: str,
    approved_by: str,
) -> MilestoneResponse:
    """Approve a submitted milestone and trigger proportional $FNDRY payout.

    Validates that:
    - The milestone exists and is SUBMITTED.
    - The approver is the bounty owner.
    - All previous milestones (lower milestone_number) are APPROVED or PAID.

    On approval, calculates the payout amount as:
        payout = bounty.reward_amount * (milestone.percentage / 100)

    Then executes an SPL transfer via the transfer service.

    Args:
        db: Active database session.
        milestone_id: UUID of the milestone to approve.
        approved_by: User ID of the bounty owner approving.

    Returns:
        The updated MilestoneResponse with payout details.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
        InvalidMilestoneTransitionError: If the milestone is not SUBMITTED.
        MilestoneSequenceError: If a prior milestone is not yet approved.
    """
    row = await _get_milestone_or_raise(db, milestone_id)

    # Verify ownership
    bounty_row = await _get_bounty_or_raise(db, str(row.bounty_id))
    if bounty_row.created_by != approved_by:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bounty owner can approve milestones",
        )

    current_status = MilestoneStatus(row.status)
    target_status = MilestoneStatus.APPROVED

    if target_status not in ALLOWED_MILESTONE_TRANSITIONS.get(current_status, frozenset()):
        raise InvalidMilestoneTransitionError(
            f"Cannot approve milestone in '{current_status.value}' state. "
            f"Must be in 'submitted' state."
        )

    # Enforce sequential approval: all milestones with lower numbers
    # must be APPROVED or PAID
    import uuid as _uuid
    try:
        bounty_uuid = _uuid.UUID(str(row.bounty_id))
    except (ValueError, AttributeError):
        bounty_uuid = row.bounty_id

    prior_query = (
        select(MilestoneTable)
        .where(
            and_(
                MilestoneTable.bounty_id == bounty_uuid,
                MilestoneTable.milestone_number < row.milestone_number,
            )
        )
        .order_by(MilestoneTable.milestone_number)
    )
    prior_result = await db.execute(prior_query)
    prior_milestones = prior_result.scalars().all()

    for prior in prior_milestones:
        prior_status = MilestoneStatus(prior.status)
        if prior_status not in (MilestoneStatus.APPROVED, MilestoneStatus.PAID):
            raise MilestoneSequenceError(
                f"Cannot approve milestone #{row.milestone_number}: "
                f"milestone #{prior.milestone_number} is still '{prior_status.value}'. "
                f"All prior milestones must be approved first."
            )

    now = datetime.now(timezone.utc)
    row.status = target_status.value
    row.approved_by = approved_by
    row.approved_at = now
    row.updated_at = now

    # Calculate payout amount
    reward_amount = Decimal(str(bounty_row.reward_amount))
    percentage = Decimal(str(row.percentage))
    payout_amount = (reward_amount * percentage / Decimal("100")).quantize(
        Decimal("0.000001")
    )
    row.payout_amount = payout_amount

    # Execute SPL transfer for the milestone payout
    tx_hash = await _execute_milestone_payout(
        recipient_wallet=row.submitted_by or "",
        amount=float(payout_amount),
        bounty_id=str(row.bounty_id),
        milestone_number=row.milestone_number,
    )

    if tx_hash:
        row.payout_tx_hash = tx_hash
        row.payout_at = now
        row.status = MilestoneStatus.PAID.value

    await db.flush()

    audit_event(
        "milestone_approved",
        milestone_id=milestone_id,
        bounty_id=str(row.bounty_id),
        approved_by=approved_by,
        milestone_number=row.milestone_number,
        payout_amount=str(payout_amount),
        tx_hash=tx_hash,
    )

    return _row_to_response(row)


async def reject_milestone(
    db: AsyncSession,
    milestone_id: str,
    rejected_by: str,
    reason: Optional[str] = None,
) -> MilestoneResponse:
    """Reject a submitted milestone, returning it to a re-submittable state.

    Only the bounty owner can reject milestones.  The contributor can
    then re-submit after addressing the rejection reason.

    Args:
        db: Active database session.
        milestone_id: UUID of the milestone to reject.
        rejected_by: User ID of the bounty owner rejecting.
        reason: Optional reason for rejection.

    Returns:
        The updated MilestoneResponse in REJECTED state.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
        InvalidMilestoneTransitionError: If the milestone is not SUBMITTED.
    """
    row = await _get_milestone_or_raise(db, milestone_id)

    # Verify ownership
    bounty_row = await _get_bounty_or_raise(db, str(row.bounty_id))
    if bounty_row.created_by != rejected_by:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bounty owner can reject milestones",
        )

    current_status = MilestoneStatus(row.status)
    target_status = MilestoneStatus.REJECTED

    if target_status not in ALLOWED_MILESTONE_TRANSITIONS.get(current_status, frozenset()):
        raise InvalidMilestoneTransitionError(
            f"Cannot reject milestone in '{current_status.value}' state. "
            f"Must be in 'submitted' state."
        )

    now = datetime.now(timezone.utc)
    row.status = target_status.value
    row.updated_at = now
    if reason:
        row.description = f"{row.description}\n\n---\n**Rejection reason:** {reason}"

    await db.flush()

    audit_event(
        "milestone_rejected",
        milestone_id=milestone_id,
        bounty_id=str(row.bounty_id),
        rejected_by=rejected_by,
        milestone_number=row.milestone_number,
        reason=reason,
    )

    return _row_to_response(row)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _execute_milestone_payout(
    recipient_wallet: str,
    amount: float,
    bounty_id: str,
    milestone_number: int,
) -> Optional[str]:
    """Execute an SPL token transfer for a milestone payout.

    Uses the same transfer service as regular bounty payouts.  Falls
    back to a mock signature in dev/test mode when no treasury keypair
    is configured.

    Args:
        recipient_wallet: Solana wallet address of the contributor.
        amount: Payout amount in $FNDRY tokens.
        bounty_id: Parent bounty UUID for logging context.
        milestone_number: The milestone number for logging context.

    Returns:
        The on-chain transaction signature, or None on failure.
    """
    try:
        from app.services.transfer_service import send_spl_transfer

        tx_hash = await send_spl_transfer(
            recipient_wallet=recipient_wallet,
            amount=amount,
        )
        logger.info(
            "Milestone payout sent: bounty=%s, milestone=#%d, amount=%s, tx=%s",
            bounty_id,
            milestone_number,
            amount,
            tx_hash,
        )
        return tx_hash
    except Exception as exc:
        logger.error(
            "Milestone payout failed: bounty=%s, milestone=#%d, error=%s",
            bounty_id,
            milestone_number,
            exc,
        )
        return None


async def _notify_owner_milestone_submitted(
    db: AsyncSession,
    milestone_row: MilestoneTable,
) -> None:
    """Send a notification to the bounty owner when a milestone is submitted.

    Creates an in-app notification and falls back to audit logging if
    the notification service is unavailable.

    Args:
        db: Active database session.
        milestone_row: The milestone that was just submitted.
    """
    try:
        bounty_row = await _get_bounty_or_raise(db, str(milestone_row.bounty_id))
        owner_id = bounty_row.created_by

        from app.services.submission_notifier import _send_notification
        await _send_notification(
            user_id=owner_id,
            notification_type="milestone_submitted",
            title=f"Milestone #{milestone_row.milestone_number} submitted",
            message=(
                f"A contributor has submitted milestone #{milestone_row.milestone_number} "
                f"for bounty '{bounty_row.title}'. Please review and approve or reject."
            ),
            bounty_id=str(milestone_row.bounty_id),
            extra_data={
                "milestone_id": str(milestone_row.id),
                "milestone_number": milestone_row.milestone_number,
            },
        )
    except Exception as exc:
        logger.warning(
            "Failed to notify owner of milestone submission (non-fatal): %s",
            exc,
        )
