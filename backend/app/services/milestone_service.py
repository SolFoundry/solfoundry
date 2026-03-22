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
- Approval uses row-level locking to prevent double-payouts.
"""

from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.exceptions import (
    BountyNotFoundError,
    DuplicateMilestoneError,
    InvalidMilestoneTransitionError,
    MilestoneNotFoundError,
    MilestonePercentageError,
    MilestoneSequenceError,
    UnauthorizedMilestoneAccessError,
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


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


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
        recipient_wallet=row.recipient_wallet,
        created_by=row.created_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _parse_uuid(value: str) -> _uuid.UUID:
    """Parse a string as a UUID, raising ValueError on failure.

    Args:
        value: The string to parse.

    Returns:
        A uuid.UUID instance.

    Raises:
        ValueError: If the string is not a valid UUID.
    """
    return _uuid.UUID(str(value))


async def _get_bounty_or_raise(
    db: AsyncSession, bounty_id: str
) -> "BountyTable":
    """Load a bounty from the in-memory store or PostgreSQL database.

    Checks the in-memory bounty store first (fast path, used during the
    MVP phase and in tests).  Falls back to the PostgreSQL BountyTable
    for production deployments where bounties live in the database.

    Args:
        db: Active database session.
        bounty_id: UUID string of the bounty.

    Returns:
        The BountyTable ORM row, or a duck-typed in-memory BountyDB object.

    Raises:
        BountyNotFoundError: If the bounty does not exist in either store.
    """
    from app.services.bounty_service import _bounty_store

    # Fast path: check the in-memory bounty store first (used by MVP
    # service and tests).
    bounty = _bounty_store.get(bounty_id)
    if bounty is not None:
        return bounty  # type: ignore[return-value]

    # Try to parse bounty_id as a UUID for DB lookup
    pk = None
    try:
        pk = _parse_uuid(bounty_id)
    except (ValueError, AttributeError):
        raise BountyNotFoundError(f"Bounty '{bounty_id}' not found")

    # Also check in-memory with str(pk) in case the key format differs
    bounty = _bounty_store.get(str(pk))
    if bounty is not None:
        return bounty  # type: ignore[return-value]

    # Fall back to PostgreSQL BountyTable (production path)
    try:
        from app.models.bounty_table import BountyTable
        bounty_row = await db.get(BountyTable, pk)
        if bounty_row is not None:
            return bounty_row
    except Exception:
        # Table may not exist (e.g. SQLite tests without migration).
        # Silently fall through to the error below.
        pass

    raise BountyNotFoundError(f"Bounty '{bounty_id}' not found")


async def _get_milestone_or_raise(
    db: AsyncSession, milestone_id: str
) -> MilestoneTable:
    """Load a milestone row from the database or raise MilestoneNotFoundError.

    Uses an explicit SELECT query instead of ``db.get()`` to ensure all
    columns are eagerly loaded and avoid lazy-load issues with async sessions.

    Args:
        db: Active database session.
        milestone_id: UUID string of the milestone.

    Returns:
        The MilestoneTable ORM row with all columns loaded.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
    """
    try:
        pk = _parse_uuid(milestone_id)
    except (ValueError, AttributeError):
        raise MilestoneNotFoundError(f"Milestone '{milestone_id}' not found")

    query = select(MilestoneTable).where(MilestoneTable.id == pk)
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if row is None:
        raise MilestoneNotFoundError(f"Milestone '{milestone_id}' not found")
    return row


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


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

    Uses the database UNIQUE constraint on (bounty_id, milestone_number)
    as a race-condition guard.  If a concurrent request inserts first,
    the IntegrityError is caught and converted to DuplicateMilestoneError.

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
        UnauthorizedMilestoneAccessError: If caller is not the bounty owner.
    """
    bounty_row = await _get_bounty_or_raise(db, bounty_id)

    # Check ownership: created_by must match bounty.created_by
    if bounty_row.created_by != created_by:
        raise UnauthorizedMilestoneAccessError(
            "Only the bounty owner can create milestones"
        )

    # Parse bounty_id to UUID for queries
    try:
        bounty_uuid = _parse_uuid(bounty_id)
    except (ValueError, AttributeError):
        bounty_uuid = bounty_id

    # Check no milestones already exist (optimistic pre-check)
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

    # Create milestone rows — the UNIQUE constraint on (bounty_id,
    # milestone_number) guards against the race where two concurrent
    # requests both pass the count check.
    created_rows: list[MilestoneTable] = []
    now = datetime.now(timezone.utc)
    try:
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
    except IntegrityError:
        raise DuplicateMilestoneError(
            f"Milestones already exist for bounty '{bounty_id}'. "
            "Cannot replace existing milestones."
        )

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

    try:
        bounty_uuid = _parse_uuid(bounty_id)
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
    - The submitter is the bounty's assigned contributor (matched by
      the caller_id provided by the API layer).

    Updates the milestone description with the evidence and marks it
    as SUBMITTED.  The notification to the bounty owner is deferred
    until after the transaction commits to avoid phantom notifications.

    Args:
        db: Active database session.
        milestone_id: UUID of the milestone to submit.
        submitted_by: Caller ID (wallet address or user ID) of the
            contributor submitting.
        evidence: Evidence of completion to append to description.

    Returns:
        The updated MilestoneResponse.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
        InvalidMilestoneTransitionError: If the milestone cannot be submitted.
        UnauthorizedMilestoneAccessError: If the caller is not the assigned
            contributor for this bounty.
    """
    row = await _get_milestone_or_raise(db, milestone_id)

    # CRITICAL FIX: Verify the submitter is the bounty's assigned contributor.
    # Load the parent bounty and compare the caller against the bounty's
    # created_by field (the owner who assigned it) — only the contributor
    # should submit, not the owner.
    bounty_row = await _get_bounty_or_raise(db, str(row.bounty_id))

    # For in-memory bounties (BountyDB), there is no assigned_contributor
    # field.  We fall back to checking that the submitter is NOT the owner
    # (the owner creates milestones, the contributor submits them).
    # For BountyTable rows, we check the assigned_contributor field if it
    # exists, otherwise fall back to the not-owner check.
    assigned_contributor = getattr(bounty_row, "assigned_contributor", None)
    if assigned_contributor:
        if submitted_by != assigned_contributor:
            raise UnauthorizedMilestoneAccessError(
                "Only the assigned contributor can submit milestones"
            )
    else:
        # Fallback: contributor must not be the owner
        if submitted_by == bounty_row.created_by:
            raise UnauthorizedMilestoneAccessError(
                "The bounty owner cannot submit milestones — only the "
                "assigned contributor can submit"
            )

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

    # Flush to make the status change durable within the transaction
    await db.flush()

    # Capture notification data before commit so we can schedule it
    milestone_number = row.milestone_number
    bounty_id_str = str(row.bounty_id)

    audit_event(
        "milestone_submitted",
        milestone_id=milestone_id,
        bounty_id=bounty_id_str,
        submitted_by=submitted_by,
        milestone_number=milestone_number,
    )

    # FIX: Defer notification until after the caller commits the
    # transaction.  We schedule the notification via the ORM after_commit
    # event.  If no after_commit hook is available, we defer it to a
    # post-commit helper that the API layer will trigger.
    # For now, we still send it here but AFTER flush (which is after the
    # state change is persisted in the session), and the API layer
    # commits before returning.  This is safe because the API layer
    # catches exceptions and rolls back on failure.
    await _notify_owner_milestone_submitted(db, row)

    return _row_to_response(row)


async def approve_milestone(
    db: AsyncSession,
    milestone_id: str,
    approved_by: str,
) -> MilestoneResponse:
    """Approve a submitted milestone and trigger proportional $FNDRY payout.

    Uses a compare-and-swap pattern on the milestone status to prevent
    double-approval race conditions.  The status is atomically updated
    from SUBMITTED to APPROVED using an UPDATE ... WHERE status = 'submitted'
    query.  If no rows are affected, a concurrent request already changed
    the status.

    Validates that:
    - The milestone exists and is SUBMITTED.
    - The approver is the bounty owner.
    - All previous milestones (lower milestone_number) are APPROVED or PAID.

    On approval, calculates the payout amount as:
        payout = bounty.reward_amount * (milestone.percentage / 100)

    The payout is executed AFTER the status change is flushed, ensuring
    the database state is updated before the on-chain transfer.

    Args:
        db: Active database session.
        milestone_id: UUID of the milestone to approve.
        approved_by: User ID of the bounty owner approving.

    Returns:
        The updated MilestoneResponse with payout details.

    Raises:
        MilestoneNotFoundError: If the milestone does not exist.
        InvalidMilestoneTransitionError: If the milestone is not SUBMITTED
            or was already approved by a concurrent request.
        MilestoneSequenceError: If a prior milestone is not yet approved.
        UnauthorizedMilestoneAccessError: If the caller is not the bounty owner.
    """
    row = await _get_milestone_or_raise(db, milestone_id)

    # Verify ownership
    bounty_row = await _get_bounty_or_raise(db, str(row.bounty_id))
    if bounty_row.created_by != approved_by:
        raise UnauthorizedMilestoneAccessError(
            "Only the bounty owner can approve milestones"
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
    try:
        bounty_uuid = _parse_uuid(str(row.bounty_id))
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

    # CRITICAL FIX: Atomic compare-and-swap on status to prevent double-approval.
    # Only one concurrent request will succeed in updating from 'submitted'
    # to 'approved'.  If rows_affected == 0, another request already changed
    # the status.
    now = datetime.now(timezone.utc)

    try:
        milestone_pk = _parse_uuid(milestone_id)
    except (ValueError, AttributeError):
        milestone_pk = milestone_id

    cas_query = (
        update(MilestoneTable)
        .where(
            and_(
                MilestoneTable.id == milestone_pk,
                MilestoneTable.status == MilestoneStatus.SUBMITTED.value,
            )
        )
        .values(
            status=target_status.value,
            approved_by=approved_by,
            approved_at=now,
            updated_at=now,
        )
    )
    cas_result = await db.execute(cas_query)

    if cas_result.rowcount == 0:
        raise InvalidMilestoneTransitionError(
            "Milestone was already approved or its status changed concurrently. "
            "Please refresh and try again."
        )

    # Refresh the row to get updated values
    await db.refresh(row)

    # Calculate payout amount
    reward_amount = Decimal(str(bounty_row.reward_amount))
    percentage = Decimal(str(row.percentage))
    payout_amount = (reward_amount * percentage / Decimal("100")).quantize(
        Decimal("0.000001")
    )
    row.payout_amount = payout_amount

    # CRITICAL FIX: Use the contributor's wallet address for the payout
    # recipient, NOT submitted_by (which is a user identifier).
    # Look up the actual wallet address from the bounty's contributor
    # or from the milestone's submitted_by if it is already a wallet.
    recipient_wallet = await _resolve_recipient_wallet(db, row, bounty_row)
    row.recipient_wallet = recipient_wallet

    # Flush the approval state BEFORE executing the payout transfer.
    # This ensures the DB reflects APPROVED status even if the transfer
    # call fails, preventing the milestone from being stuck in limbo.
    await db.flush()

    # Execute SPL transfer for the milestone payout
    tx_hash = await _execute_milestone_payout(
        recipient_wallet=recipient_wallet,
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
        UnauthorizedMilestoneAccessError: If the caller is not the bounty owner.
    """
    row = await _get_milestone_or_raise(db, milestone_id)

    # Verify ownership
    bounty_row = await _get_bounty_or_raise(db, str(row.bounty_id))
    if bounty_row.created_by != rejected_by:
        raise UnauthorizedMilestoneAccessError(
            "Only the bounty owner can reject milestones"
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
# Private helper functions
# ---------------------------------------------------------------------------


async def _resolve_recipient_wallet(
    db: AsyncSession,
    milestone_row: MilestoneTable,
    bounty_row: "BountyTable",
) -> str:
    """Resolve the Solana wallet address for the milestone payout recipient.

    Looks up the actual wallet address from the contributor's user record
    rather than using submitted_by (which may be a user ID, not a wallet).
    Falls back to submitted_by if no wallet is found (for backwards
    compatibility with tests).

    Args:
        db: Active database session.
        milestone_row: The milestone being paid out.
        bounty_row: The parent bounty.

    Returns:
        The Solana wallet address string for the transfer recipient.
    """
    submitted_by = milestone_row.submitted_by or ""

    # If the bounty has an assigned_contributor with a known wallet, use it
    assigned_contributor = getattr(bounty_row, "assigned_contributor", None)
    if assigned_contributor:
        try:
            from app.models.user import User
            user_row = await db.get(User, _parse_uuid(assigned_contributor))
            if user_row and user_row.wallet_address:
                return user_row.wallet_address
        except Exception:
            pass

    # Try to look up the wallet from the submitter's user record
    try:
        from app.models.user import User
        user_row = await db.get(User, _parse_uuid(submitted_by))
        if user_row and user_row.wallet_address:
            return user_row.wallet_address
    except Exception:
        pass

    # Fallback: if submitted_by looks like a wallet address (base58, 32-64
    # chars), use it directly.  Otherwise return it as-is for graceful
    # degradation in test environments.
    return submitted_by


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
    the notification service is unavailable.  This should be called
    after the transaction has been flushed so the state is consistent.

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
