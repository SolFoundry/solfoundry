"""Dispute resolution service.

Implements the full dispute lifecycle:
    PENDING (filed) → UNDER_REVIEW (evidence) → RESOLVED

Key features:
- 72-hour dispute window from submission rejection
- Duplicate dispute prevention
- AI auto-mediation (score ≥ 7.0 → contributor wins)
- Admin manual resolution
- Reputation impact on resolution
- Telegram notification stubs (TODO: wire real client when available)
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dispute import (
    DisputeDB,
    DisputeHistoryDB,
    DisputeCreate,
    DisputeResolve,
    DisputeDetailResponse,
    DisputeHistoryItem,
    DisputeListItem,
    DisputeListResponse,
    DisputeResponse,
    DisputeStats,
    DisputeStatus,
    DisputeOutcome,
    EvidenceItem,
)
from app.models.bounty import SubmissionStatus

logger = logging.getLogger(__name__)

# How long a contributor has to file a dispute after rejection.
DISPUTE_WINDOW_HOURS = 72

# AI score threshold for auto-resolution in contributor's favour.
AI_AUTO_RESOLVE_THRESHOLD = 7.0


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_dispute_by_id(
    db: AsyncSession, dispute_id: str
) -> Optional[DisputeDB]:
    """Fetch a DisputeDB row by primary-key UUID string."""
    try:
        uid = uuid.UUID(dispute_id)
    except ValueError:
        return None
    result = await db.execute(select(DisputeDB).where(DisputeDB.id == uid))
    return result.scalar_one_or_none()


async def _append_history(
    db: AsyncSession,
    dispute: DisputeDB,
    action: str,
    actor_id: str,
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None,
    notes: Optional[str] = None,
) -> None:
    """Append an audit entry to dispute_history."""
    entry = DisputeHistoryDB(
        id=uuid.uuid4(),
        dispute_id=dispute.id,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        actor_id=actor_id,
        notes=notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)


def _to_response(dispute: DisputeDB) -> DisputeResponse:
    """Convert a DisputeDB ORM row to a DisputeResponse Pydantic model.

    UUID columns (as_uuid=True) are cast to strings so the Pydantic ``str``
    fields are satisfied on both PostgreSQL (real UUIDs) and SQLite test DBs.
    """
    return DisputeResponse(
        id=str(dispute.id),
        bounty_id=str(dispute.bounty_id),
        submitter_id=str(dispute.submitter_id),
        reason=dispute.reason,
        description=dispute.description,
        evidence_links=dispute.evidence_links or [],
        status=dispute.status,
        outcome=dispute.outcome,
        reviewer_id=str(dispute.reviewer_id) if dispute.reviewer_id else None,
        review_notes=dispute.review_notes,
        resolution_action=dispute.resolution_action,
        created_at=dispute.created_at,
        updated_at=dispute.updated_at,
        resolved_at=dispute.resolved_at,
    )


def _to_detail_response(
    dispute: DisputeDB, history_rows: list[DisputeHistoryDB]
) -> DisputeDetailResponse:
    """Convert a DisputeDB + history rows to DisputeDetailResponse.

    Explicitly converts each ORM history row to its Pydantic counterpart
    to avoid assigning raw SQLAlchemy objects to a Pydantic field.
    """
    base = _to_response(dispute)
    detail = DisputeDetailResponse(**base.model_dump())
    detail.history = [
        DisputeHistoryItem(
            id=str(h.id),
            dispute_id=str(h.dispute_id),
            action=h.action,
            previous_status=h.previous_status,
            new_status=h.new_status,
            actor_id=str(h.actor_id),
            notes=h.notes,
            created_at=h.created_at,
        )
        for h in history_rows
    ]
    return detail


# ---------------------------------------------------------------------------
# Notification stubs
# ---------------------------------------------------------------------------


async def _notify_admin_of_dispute(dispute: DisputeDB) -> None:
    """Notify platform admin of a new dispute via Telegram.

    TODO: Replace with real Telegram bot call when the client is wired in.
    """
    try:
        logger.info(
            "DISPUTE_OPENED dispute_id=%s bounty_id=%s submitter_id=%s — "
            "TODO: send Telegram message to admin group",
            dispute.id,
            dispute.bounty_id,
            dispute.submitter_id,
        )
    except Exception as exc:  # pragma: no cover
        logger.error("Failed to notify admin of dispute %s: %s", dispute.id, exc)


async def _notify_parties_of_resolution(
    dispute: DisputeDB, outcome: str
) -> None:
    """Notify involved parties of the dispute resolution via Telegram.

    TODO: Replace with real Telegram bot call when the client is wired in.
    """
    try:
        logger.info(
            "DISPUTE_RESOLVED dispute_id=%s outcome=%s — "
            "TODO: send Telegram message to parties",
            dispute.id,
            outcome,
        )
    except Exception as exc:  # pragma: no cover
        logger.error(
            "Failed to notify parties of dispute %s resolution: %s",
            dispute.id,
            exc,
        )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


async def initiate_dispute(
    db: AsyncSession,
    data: DisputeCreate,
    submitter_id: str,
    submission_rejected_at: Optional[datetime] = None,
) -> DisputeResponse:
    """File a new dispute for a rejected bounty submission.

    Args:
        db: Async database session.
        data: Dispute creation payload (reason, description, evidence_links).
        submitter_id: UUID string of the contributor filing the dispute.
        submission_rejected_at: When the submission was rejected. If provided
            the 72-hour window is enforced. Pass ``None`` to skip (e.g. tests).

    Returns:
        The newly created DisputeResponse.

    Raises:
        ValueError: If the 72-hour window has expired or a dispute already
            exists for this bounty + submitter combination.
    """
    # Enforce the 72-hour dispute window.
    if submission_rejected_at is not None:
        now = datetime.now(timezone.utc)
        age = now - submission_rejected_at
        if age > timedelta(hours=DISPUTE_WINDOW_HOURS):
            raise ValueError(
                f"Dispute window expired: disputes must be filed within "
                f"{DISPUTE_WINDOW_HOURS} hours of rejection."
            )

    # Prevent duplicate disputes for the same bounty by the same contributor.
    existing = await db.execute(
        select(DisputeDB).where(
            and_(
                DisputeDB.bounty_id == uuid.UUID(data.bounty_id),
                DisputeDB.submitter_id == uuid.UUID(submitter_id),
                DisputeDB.status.notin_(
                    [DisputeStatus.RESOLVED, DisputeStatus.CLOSED]
                ),
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError(
            "An open dispute already exists for this bounty and submitter."
        )

    evidence = [e.model_dump() for e in data.evidence_links]

    dispute = DisputeDB(
        id=uuid.uuid4(),
        bounty_id=uuid.UUID(data.bounty_id),
        submitter_id=uuid.UUID(submitter_id),
        reason=data.reason,
        description=data.description,
        evidence_links=evidence,
        status=DisputeStatus.PENDING.value,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(dispute)

    await _append_history(
        db,
        dispute,
        action="dispute_opened",
        actor_id=submitter_id,
        previous_status=None,
        new_status=DisputeStatus.PENDING.value,
        notes="Dispute filed by contributor.",
    )

    await db.commit()
    await db.refresh(dispute)

    await _notify_admin_of_dispute(dispute)
    logger.info("Dispute %s opened for bounty %s", dispute.id, dispute.bounty_id)
    return _to_response(dispute)


async def get_dispute_detail(
    db: AsyncSession,
    dispute_id: str,
    requesting_user_id: Optional[str] = None,
) -> Optional[DisputeDetailResponse]:
    """Retrieve full dispute details including history.

    Args:
        db: Async database session.
        dispute_id: UUID string of the dispute.
        requesting_user_id: If provided, access is restricted to parties
            involved in the dispute (submitter or reviewer).

    Returns:
        DisputeDetailResponse or None if not found / not authorised.
    """
    dispute = await _get_dispute_by_id(db, dispute_id)
    if dispute is None:
        return None

    if requesting_user_id is not None:
        uid = str(dispute.submitter_id)
        reviewer = str(dispute.reviewer_id) if dispute.reviewer_id else None
        if requesting_user_id not in (uid, reviewer):
            return None  # Caller receives a 404 — no info leakage.

    history_result = await db.execute(
        select(DisputeHistoryDB)
        .where(DisputeHistoryDB.dispute_id == dispute.id)
        .order_by(DisputeHistoryDB.created_at)
    )
    history_rows = list(history_result.scalars().all())
    return _to_detail_response(dispute, history_rows)


async def submit_evidence(
    db: AsyncSession,
    dispute_id: str,
    actor_id: str,
    items: list[EvidenceItem],
    notes: Optional[str] = None,
) -> DisputeResponse:
    """Append evidence links to an open dispute.

    Only the original submitter (contributor) may add evidence.

    Args:
        db: Async database session.
        dispute_id: UUID string of the dispute.
        actor_id: UUID string of the authenticated user.
        items: New evidence items to append.
        notes: Optional notes to record in history.

    Returns:
        Updated DisputeResponse.

    Raises:
        ValueError: If the dispute is not found, is already resolved, or the
            caller is not authorised.
    """
    dispute = await _get_dispute_by_id(db, dispute_id)
    if dispute is None:
        raise ValueError("Dispute not found.")

    # Only the contributor who filed the dispute may submit evidence.
    if str(dispute.submitter_id) != actor_id:
        raise PermissionError(
            "Only the dispute submitter may add evidence."
        )

    if dispute.status in (DisputeStatus.RESOLVED.value, DisputeStatus.CLOSED.value):
        raise ValueError("Cannot add evidence to a resolved or closed dispute.")

    # Append new evidence to the existing list.
    current: list = list(dispute.evidence_links or [])
    current.extend(item.model_dump() for item in items)
    dispute.evidence_links = current

    prev_status = dispute.status
    dispute.status = DisputeStatus.UNDER_REVIEW.value
    dispute.updated_at = datetime.now(timezone.utc)

    await _append_history(
        db,
        dispute,
        action="evidence_submitted",
        actor_id=actor_id,
        previous_status=prev_status,
        new_status=dispute.status,
        notes=notes or f"Evidence submitted: {len(items)} item(s).",
    )

    await db.commit()
    await db.refresh(dispute)
    logger.info("Evidence submitted for dispute %s", dispute.id)
    return _to_response(dispute)


async def try_ai_auto_mediation(
    db: AsyncSession,
    dispute_id: str,
    ai_review_score: float,
    system_actor_id: str = "system",
) -> Optional[DisputeResponse]:
    """Attempt AI-powered automatic mediation.

    If the AI review score meets or exceeds the threshold (7.0/10) the
    dispute is automatically resolved in the contributor's favour.

    Args:
        db: Async database session.
        dispute_id: UUID string of the dispute.
        ai_review_score: Score from AI review (0.0–10.0).
        system_actor_id: Actor ID to record in history.

    Returns:
        Updated DisputeResponse if auto-resolved, else None.
    """
    if ai_review_score < AI_AUTO_RESOLVE_THRESHOLD:
        logger.info(
            "AI score %.1f below threshold %.1f for dispute %s — no auto-resolve",
            ai_review_score,
            AI_AUTO_RESOLVE_THRESHOLD,
            dispute_id,
        )
        return None

    dispute = await _get_dispute_by_id(db, dispute_id)
    if dispute is None or dispute.status == DisputeStatus.RESOLVED.value:
        return None

    prev_status = dispute.status
    dispute.status = DisputeStatus.RESOLVED.value
    dispute.outcome = DisputeOutcome.APPROVED.value
    dispute.review_notes = (
        f"AI auto-mediation: score {ai_review_score:.1f} ≥ threshold "
        f"{AI_AUTO_RESOLVE_THRESHOLD:.1f}. Resolved in contributor's favour."
    )
    dispute.resolved_at = datetime.now(timezone.utc)
    dispute.updated_at = datetime.now(timezone.utc)

    await _append_history(
        db,
        dispute,
        action="ai_auto_resolved",
        actor_id=system_actor_id,
        previous_status=prev_status,
        new_status=dispute.status,
        notes=dispute.review_notes,
    )

    await db.commit()
    await db.refresh(dispute)

    await _notify_parties_of_resolution(dispute, DisputeOutcome.APPROVED.value)
    logger.info("Dispute %s auto-resolved (AI score %.1f)", dispute.id, ai_review_score)
    return _to_response(dispute)


async def resolve_dispute(
    db: AsyncSession,
    dispute_id: str,
    resolution: DisputeResolve,
    admin_id: str,
) -> DisputeResponse:
    """Manually resolve a dispute (admin only).

    Args:
        db: Async database session.
        dispute_id: UUID string of the dispute.
        resolution: Resolution payload (outcome, notes, action).
        admin_id: UUID string of the admin performing the resolution.

    Returns:
        Updated DisputeResponse.

    Raises:
        ValueError: If the dispute is not found or already resolved.
    """
    dispute = await _get_dispute_by_id(db, dispute_id)
    if dispute is None:
        raise ValueError("Dispute not found.")

    if dispute.status == DisputeStatus.RESOLVED.value:
        raise ValueError("Dispute is already resolved.")

    prev_status = dispute.status
    dispute.status = DisputeStatus.RESOLVED.value
    dispute.outcome = resolution.outcome
    dispute.reviewer_id = uuid.UUID(admin_id)
    dispute.review_notes = resolution.review_notes
    dispute.resolution_action = resolution.resolution_action
    dispute.resolved_at = datetime.now(timezone.utc)
    dispute.updated_at = datetime.now(timezone.utc)

    await _append_history(
        db,
        dispute,
        action="admin_resolved",
        actor_id=admin_id,
        previous_status=prev_status,
        new_status=dispute.status,
        notes=f"Admin resolution: {resolution.outcome}. {resolution.review_notes}",
    )

    await db.commit()
    await db.refresh(dispute)

    await _notify_parties_of_resolution(dispute, resolution.outcome)
    logger.info(
        "Dispute %s resolved by admin %s with outcome %s",
        dispute.id,
        admin_id,
        resolution.outcome,
    )
    return _to_response(dispute)


async def list_disputes(
    db: AsyncSession,
    bounty_id: Optional[str] = None,
    submitter_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> DisputeListResponse:
    """List disputes with optional filters."""
    query = select(DisputeDB)

    conditions = []
    if bounty_id:
        try:
            conditions.append(DisputeDB.bounty_id == uuid.UUID(bounty_id))
        except ValueError:
            pass
    if submitter_id:
        try:
            conditions.append(DisputeDB.submitter_id == uuid.UUID(submitter_id))
        except ValueError:
            pass
    if status:
        conditions.append(DisputeDB.status == status)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(DisputeDB.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = list(result.scalars().all())

    # Count total matching rows (without pagination).
    count_query = select(DisputeDB)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return DisputeListResponse(
        items=[DisputeListItem.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_dispute_stats(db: AsyncSession) -> DisputeStats:
    """Return aggregate dispute statistics."""
    result = await db.execute(select(DisputeDB))
    all_disputes = list(result.scalars().all())

    total = len(all_disputes)
    pending = sum(1 for d in all_disputes if d.status == DisputeStatus.PENDING.value)
    resolved = sum(1 for d in all_disputes if d.status == DisputeStatus.RESOLVED.value)
    approved = sum(
        1
        for d in all_disputes
        if d.outcome == DisputeOutcome.APPROVED.value
    )
    rejected = sum(
        1
        for d in all_disputes
        if d.outcome == DisputeOutcome.REJECTED.value
    )
    approval_rate = (approved / resolved) if resolved > 0 else 0.0

    return DisputeStats(
        total_disputes=total,
        pending_disputes=pending,
        resolved_disputes=resolved,
        approved_disputes=approved,
        rejected_disputes=rejected,
        approval_rate=round(approval_rate, 4),
    )
