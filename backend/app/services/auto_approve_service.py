"""Auto-approve background service.

Runs periodically to check submissions that:
1. Have AI review scores >= threshold (7/10)
2. Have been under review for >= 48 hours with no creator dispute

When both conditions are met, the submission is auto-approved and payout
is triggered.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.models.review import AI_REVIEW_SCORE_THRESHOLD, AUTO_APPROVE_TIMEOUT_HOURS
from app.services import bounty_service
from app.services import review_service
from app.services import lifecycle_service
from app.models.bounty import BountyStatus, BountyTier, SubmissionStatus
from app.models.lifecycle import LifecycleEventType
from app.core.audit import audit_event

logger = logging.getLogger(__name__)


def check_auto_approve_candidates() -> list[dict]:
    """Scan all bounties for submissions eligible for auto-approval.

    Returns a list of {bounty_id, submission_id} pairs that were auto-approved.
    """
    approved = []
    now = datetime.now(timezone.utc)

    for bounty_id, bounty in list(bounty_service._bounty_store.items()):
        if bounty.status not in (BountyStatus.UNDER_REVIEW, BountyStatus.IN_PROGRESS):
            continue

        # T3 bounties must NEVER be auto-approved — they require explicit
        # owner approval via Telegram callback.
        if bounty.tier == BountyTier.T3:
            continue

        for sub in bounty.submissions:
            if sub.status != SubmissionStatus.PENDING:
                continue
            if not sub.auto_approve_eligible:
                continue
            if sub.auto_approve_after is None:
                continue
            if now < sub.auto_approve_after:
                continue

            if not review_service.meets_auto_approve_threshold(sub.id):
                continue

            result = bounty_service.approve_submission(
                bounty_id=bounty_id,
                submission_id=sub.id,
                approved_by="system:auto_approve",
                is_auto=True,
            )
            if result[0] is not None:
                lifecycle_service.log_event(
                    bounty_id=bounty_id,
                    event_type=LifecycleEventType.AUTO_APPROVED,
                    submission_id=sub.id,
                    previous_state=SubmissionStatus.PENDING.value,
                    new_state=SubmissionStatus.APPROVED.value,
                    actor_type="auto",
                    details={
                        "reason": "AI score >= threshold and 48h elapsed with no dispute",
                        "ai_score": review_service.get_aggregated_score(sub.id, bounty_id).overall_score,
                        "threshold": AI_REVIEW_SCORE_THRESHOLD,
                        "timeout_hours": AUTO_APPROVE_TIMEOUT_HOURS,
                    },
                )
                approved.append({"bounty_id": bounty_id, "submission_id": sub.id})
                logger.info(
                    "Auto-approved submission %s for bounty %s",
                    sub.id,
                    bounty_id,
                )

    return approved


async def periodic_auto_approve(interval_seconds: int = 300) -> None:
    """Background task that checks for auto-approvable submissions every interval."""
    logger.info("Auto-approve scheduler started (interval=%ds)", interval_seconds)
    while True:
        try:
            approved = check_auto_approve_candidates()
            if approved:
                logger.info("Auto-approved %d submissions", len(approved))
                audit_event(
                    "auto_approve_batch",
                    count=len(approved),
                    submissions=[a["submission_id"] for a in approved],
                )
        except Exception as e:
            logger.error("Auto-approve check failed: %s", e, exc_info=True)

        await asyncio.sleep(interval_seconds)
