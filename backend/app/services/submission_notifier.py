"""Notification dispatching for the submission-to-payout flow.

Sends notifications to:
- Bounty creator when a new submission is received
- Contributor when their submission is approved/rejected/disputed
- Contributor when payout is confirmed
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.audit import audit_event
from app.models.notification import NotificationType, NotificationCreate

logger = logging.getLogger(__name__)


async def _send_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    bounty_id: Optional[str] = None,
    extra_data: Optional[dict] = None,
) -> None:
    """Persist a notification. Falls back to audit log if DB is unavailable."""
    try:
        from app.database import get_db_session
        from app.services.notification_service import NotificationService

        async with get_db_session() as session:
            svc = NotificationService(session)
            await svc.create_notification(
                NotificationCreate(
                    user_id=user_id,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    bounty_id=bounty_id,
                    extra_data=extra_data,
                )
            )
            await session.commit()
    except Exception as e:
        logger.warning("Failed to persist notification (non-fatal): %s", e)
        audit_event(
            "notification_fallback",
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            error=str(e),
        )


async def notify_submission_received(
    creator_id: str,
    bounty_id: str,
    bounty_title: str,
    pr_url: str,
    contributor: str,
) -> None:
    """Notify bounty creator that a new submission was received."""
    await _send_notification(
        user_id=creator_id,
        notification_type=NotificationType.SUBMISSION_RECEIVED.value,
        title="New Submission Received",
        message=f"A new PR was submitted for '{bounty_title}' by {contributor}.",
        bounty_id=bounty_id,
        extra_data={"pr_url": pr_url, "contributor": contributor},
    )


async def notify_submission_approved(
    contributor_id: str,
    bounty_id: str,
    bounty_title: str,
    reward_amount: float,
    approved_by: str,
) -> None:
    """Notify contributor that their submission was approved."""
    await _send_notification(
        user_id=contributor_id,
        notification_type=NotificationType.SUBMISSION_APPROVED.value,
        title="Submission Approved!",
        message=f"Your submission for '{bounty_title}' was approved! {reward_amount:,.0f} FNDRY payout incoming.",
        bounty_id=bounty_id,
        extra_data={"reward_amount": reward_amount, "approved_by": approved_by},
    )


async def notify_submission_disputed(
    contributor_id: str,
    bounty_id: str,
    bounty_title: str,
    reason: str,
) -> None:
    """Notify contributor that their submission was disputed."""
    await _send_notification(
        user_id=contributor_id,
        notification_type=NotificationType.SUBMISSION_DISPUTED.value,
        title="Submission Disputed",
        message=f"Your submission for '{bounty_title}' has been disputed: {reason}",
        bounty_id=bounty_id,
        extra_data={"reason": reason},
    )


async def notify_auto_approved(
    contributor_id: str,
    creator_id: str,
    bounty_id: str,
    bounty_title: str,
    reward_amount: float,
    ai_score: float,
) -> None:
    """Notify both parties when auto-approve fires."""
    await _send_notification(
        user_id=contributor_id,
        notification_type=NotificationType.AUTO_APPROVED.value,
        title="Auto-Approved!",
        message=(
            f"Your submission for '{bounty_title}' was auto-approved "
            f"(AI score: {ai_score:.1f}/10). {reward_amount:,.0f} FNDRY payout incoming."
        ),
        bounty_id=bounty_id,
        extra_data={"ai_score": ai_score, "reward_amount": reward_amount},
    )
    await _send_notification(
        user_id=creator_id,
        notification_type=NotificationType.AUTO_APPROVED.value,
        title="Bounty Auto-Approved",
        message=(
            f"A submission for '{bounty_title}' was auto-approved after 48h "
            f"with AI score {ai_score:.1f}/10."
        ),
        bounty_id=bounty_id,
        extra_data={"ai_score": ai_score},
    )


async def notify_payout_confirmed(
    contributor_id: str,
    bounty_id: str,
    bounty_title: str,
    amount: float,
    tx_hash: str,
) -> None:
    """Notify contributor that payout was confirmed on-chain."""
    await _send_notification(
        user_id=contributor_id,
        notification_type=NotificationType.PAYOUT_CONFIRMED.value,
        title="Payout Confirmed!",
        message=f"{amount:,.0f} FNDRY sent for '{bounty_title}'. Tx: {tx_hash[:16]}...",
        bounty_id=bounty_id,
        extra_data={"amount": amount, "tx_hash": tx_hash},
    )
