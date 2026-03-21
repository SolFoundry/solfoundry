"""Bounty lifecycle engine.

Central service enforcing the state machine, implementing claim flow (T2/T3),
T1 open-race auto-win, and deadline enforcement. Every transition is recorded
via the lifecycle audit log.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.audit import audit_event
from app.models.bounty import (
    BountyDB,
    BountyResponse,
    BountyStatus,
    BountyTier,
    VALID_STATUS_TRANSITIONS,
)
from app.models.lifecycle import LifecycleEventType
from app.services import bounty_service, lifecycle_service

logger = logging.getLogger(__name__)

# Default claim duration for T2/T3 bounties (7 days)
DEFAULT_CLAIM_DURATION_HOURS: int = 7 * 24  # 168 hours
DEADLINE_WARNING_THRESHOLD: float = 0.80  # warn at 80 %


# ---------------------------------------------------------------------------
#  State machine helpers
# ---------------------------------------------------------------------------


class LifecycleError(Exception):
    """Raised when a lifecycle operation is invalid."""

    def __init__(self, message: str, code: str = "LIFECYCLE_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


def _validate_transition(current: BountyStatus, target: BountyStatus) -> None:
    """Raise LifecycleError if the transition is not allowed."""
    allowed = VALID_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise LifecycleError(
            f"Invalid status transition: {current.value} → {target.value}. "
            f"Allowed: {sorted(s.value for s in allowed)}",
            code="INVALID_TRANSITION",
        )


def _get_bounty_db(bounty_id: str) -> BountyDB:
    """Get raw BountyDB or raise LifecycleError."""
    bounty = bounty_service._bounty_store.get(bounty_id)
    if bounty is None:
        raise LifecycleError("Bounty not found", code="NOT_FOUND")
    return bounty


# ---------------------------------------------------------------------------
#  Lifecycle operations
# ---------------------------------------------------------------------------


def transition_status(
    bounty_id: str,
    target_status: BountyStatus,
    *,
    actor_id: str = "system",
    actor_type: str = "system",
    details: Optional[dict] = None,
) -> BountyResponse:
    """Apply a validated state transition, log it, and return the updated bounty."""
    bounty = _get_bounty_db(bounty_id)
    prev = bounty.status
    _validate_transition(prev, target_status)

    bounty.status = target_status
    bounty.updated_at = datetime.now(timezone.utc)

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.BOUNTY_STATUS_CHANGED,
        previous_state=prev.value,
        new_state=target_status.value,
        actor_id=actor_id,
        actor_type=actor_type,
        details=details,
    )

    audit_event(
        "lifecycle_transition",
        bounty_id=bounty_id,
        previous=prev.value,
        new=target_status.value,
        actor=actor_id,
    )

    return bounty_service._to_bounty_response(bounty)


def publish_bounty(
    bounty_id: str,
    *,
    actor_id: str = "system",
) -> BountyResponse:
    """Publish a draft bounty (draft → open)."""
    bounty = _get_bounty_db(bounty_id)
    if bounty.status != BountyStatus.DRAFT:
        raise LifecycleError(
            f"Can only publish DRAFT bounties (current: {bounty.status.value})",
            code="INVALID_STATE",
        )

    resp = transition_status(
        bounty_id,
        BountyStatus.OPEN,
        actor_id=actor_id,
        actor_type="user",
        details={"action": "publish"},
    )

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.BOUNTY_PUBLISHED,
        new_state=BountyStatus.OPEN.value,
        actor_id=actor_id,
        actor_type="user",
    )

    return resp


# ---------------------------------------------------------------------------
#  Claim flow (T2 / T3)
# ---------------------------------------------------------------------------


def claim_bounty(
    bounty_id: str,
    claimer_id: str,
    *,
    claim_duration_hours: int = DEFAULT_CLAIM_DURATION_HOURS,
) -> BountyResponse:
    """Claim a T2/T3 bounty: lock it for the claimer with a deadline."""
    bounty = _get_bounty_db(bounty_id)

    # Only T2/T3 can be claimed
    if bounty.tier == BountyTier.T1:
        raise LifecycleError(
            "T1 bounties use open-race — they cannot be claimed",
            code="T1_NOT_CLAIMABLE",
        )

    # Must be open
    if bounty.status != BountyStatus.OPEN:
        raise LifecycleError(
            f"Bounty must be OPEN to claim (current: {bounty.status.value})",
            code="INVALID_STATE",
        )

    # Already claimed?
    if bounty.claimed_by is not None:
        raise LifecycleError("Bounty is already claimed", code="ALREADY_CLAIMED")

    now = datetime.now(timezone.utc)
    bounty.claimed_by = claimer_id
    bounty.claimed_at = now
    bounty.claim_deadline = now + timedelta(hours=claim_duration_hours)
    bounty.status = BountyStatus.IN_PROGRESS
    bounty.updated_at = now

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.BOUNTY_CLAIMED,
        previous_state=BountyStatus.OPEN.value,
        new_state=BountyStatus.IN_PROGRESS.value,
        actor_id=claimer_id,
        actor_type="user",
        details={
            "claim_deadline": bounty.claim_deadline.isoformat(),
            "claim_duration_hours": claim_duration_hours,
        },
    )

    audit_event(
        "bounty_claimed",
        bounty_id=bounty_id,
        claimer=claimer_id,
        deadline=bounty.claim_deadline.isoformat(),
    )

    return bounty_service._to_bounty_response(bounty)


def unclaim_bounty(
    bounty_id: str,
    *,
    actor_id: str = "system",
    reason: str = "manual",
) -> BountyResponse:
    """Release a claim on a bounty (manual or auto-released)."""
    bounty = _get_bounty_db(bounty_id)

    if bounty.claimed_by is None:
        raise LifecycleError("Bounty is not claimed", code="NOT_CLAIMED")

    prev_claimer = bounty.claimed_by
    bounty.claimed_by = None
    bounty.claimed_at = None
    bounty.claim_deadline = None
    bounty.status = BountyStatus.OPEN
    bounty.updated_at = datetime.now(timezone.utc)

    event_type = (
        LifecycleEventType.BOUNTY_CLAIM_AUTO_RELEASED
        if reason == "deadline_expired"
        else LifecycleEventType.BOUNTY_UNCLAIMED
    )

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=event_type,
        previous_state=BountyStatus.IN_PROGRESS.value,
        new_state=BountyStatus.OPEN.value,
        actor_id=actor_id,
        actor_type="system" if reason == "deadline_expired" else "user",
        details={"previous_claimer": prev_claimer, "reason": reason},
    )

    audit_event(
        "bounty_unclaimed",
        bounty_id=bounty_id,
        previous_claimer=prev_claimer,
        reason=reason,
    )

    return bounty_service._to_bounty_response(bounty)


# ---------------------------------------------------------------------------
#  T1 open-race auto-win
# ---------------------------------------------------------------------------


def handle_t1_auto_win(
    bounty_id: str,
    submission_id: str,
) -> BountyResponse:
    """Auto-complete a T1 bounty when the first passing PR is merged."""
    bounty = _get_bounty_db(bounty_id)

    if bounty.tier != BountyTier.T1:
        raise LifecycleError("Auto-win only applies to T1 bounties", code="NOT_T1")

    if bounty.status in (BountyStatus.COMPLETED, BountyStatus.PAID):
        raise LifecycleError(
            f"Bounty already in terminal state: {bounty.status.value}",
            code="ALREADY_COMPLETED",
        )

    # Find the submission
    sub = None
    for s in bounty.submissions:
        if s.id == submission_id:
            sub = s
            break

    if sub is None:
        raise LifecycleError("Submission not found", code="NOT_FOUND")

    # Mark winner and complete
    now = datetime.now(timezone.utc)
    sub.winner = True
    bounty.winner_submission_id = submission_id
    bounty.winner_wallet = sub.contributor_wallet
    bounty.status = BountyStatus.COMPLETED
    bounty.updated_at = now

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.BOUNTY_T1_AUTO_WON,
        previous_state=BountyStatus.OPEN.value,
        new_state=BountyStatus.COMPLETED.value,
        actor_id="system",
        actor_type="system",
        details={
            "submission_id": submission_id,
            "pr_url": sub.pr_url,
            "submitted_by": sub.submitted_by,
        },
    )

    # Trigger payout
    bounty_service._trigger_payout(bounty, sub)

    return bounty_service._to_bounty_response(bounty)


# ---------------------------------------------------------------------------
#  Deadline enforcement (cron)
# ---------------------------------------------------------------------------


def check_deadlines() -> dict:
    """Check all claimed bounties for deadline enforcement.

    - At 80% elapsed: emit a warning event.
    - At 100% elapsed: auto-release the claim.

    Returns summary dict with counts.
    """
    now = datetime.now(timezone.utc)
    warned = 0
    released = 0

    for bounty_id, bounty in list(bounty_service._bounty_store.items()):
        if bounty.claimed_by is None or bounty.claim_deadline is None:
            continue
        if bounty.claimed_at is None:
            continue
        if bounty.status != BountyStatus.IN_PROGRESS:
            continue

        total_seconds = (bounty.claim_deadline - bounty.claimed_at).total_seconds()
        if total_seconds <= 0:
            continue

        elapsed_seconds = (now - bounty.claimed_at).total_seconds()
        progress = elapsed_seconds / total_seconds

        # 100% — auto-release
        if progress >= 1.0:
            try:
                unclaim_bounty(
                    bounty_id,
                    actor_id="system",
                    reason="deadline_expired",
                )
                released += 1
                logger.info("Auto-released claim on bounty %s (deadline passed)", bounty_id)
            except LifecycleError as exc:
                logger.warning("Failed to auto-release bounty %s: %s", bounty_id, exc.message)

        # 80% — warning
        elif progress >= DEADLINE_WARNING_THRESHOLD:
            lifecycle_service.log_event(
                bounty_id=bounty_id,
                event_type=LifecycleEventType.BOUNTY_CLAIM_DEADLINE_WARNING,
                actor_id="system",
                actor_type="system",
                details={
                    "progress_pct": round(progress * 100, 1),
                    "deadline": bounty.claim_deadline.isoformat(),
                    "claimer": bounty.claimed_by,
                },
            )
            warned += 1
            logger.info(
                "Deadline warning for bounty %s (%.0f%% elapsed)", bounty_id, progress * 100
            )

    return {"warned": warned, "released": released}


async def periodic_deadline_check(interval_seconds: int = 60) -> None:
    """Background task that runs deadline enforcement periodically."""
    while True:
        try:
            result = check_deadlines()
            if result["warned"] or result["released"]:
                logger.info("Deadline check: %s", result)
        except Exception:
            logger.exception("Error in periodic deadline check")
        await asyncio.sleep(interval_seconds)
