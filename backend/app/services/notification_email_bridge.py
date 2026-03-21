"""Integration between notification service and email service.

This module bridges the existing notification system with the new
email notification service, allowing emails to be sent when
notifications are created.
"""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationCreate, NotificationType
from app.models.email_preferences import EmailPreferencesDB
from app.services.notification_service import NotificationService
from app.services.email.service import get_email_service

logger = logging.getLogger(__name__)


async def create_notification_with_email(
    db: AsyncSession,
    notification_data: NotificationCreate,
    user_email: Optional[str] = None,
    user_name: Optional[str] = None,
    template_context: Optional[dict] = None,
) -> dict:
    """Create a notification and optionally send an email.

    This function:
    1. Creates the in-app notification
    2. Checks user's email preferences
    3. Sends email if enabled

    Args:
        db: Database session
        notification_data: Notification creation data
        user_email: User's email address (required for email)
        user_name: User's display name (for email personalization)
        template_context: Additional context for email template

    Returns:
        Dict with notification and email results
    """
    # Create in-app notification
    notification_service = NotificationService(db)
    notification = await notification_service.create_notification(notification_data)

    result = {
        "notification": notification,
        "email_sent": False,
        "email_error": None,
    }

    # Check if user has email notifications enabled
    if not user_email:
        logger.debug(f"No email provided for user {notification_data.user_id}")
        return result

    # Get email preferences
    prefs_query = select(EmailPreferencesDB).where(
        EmailPreferencesDB.user_id == notification_data.user_id
    )
    prefs_result = await db.execute(prefs_query)
    prefs = prefs_result.scalar_one_or_none()

    if prefs:
        # Check master toggle
        if not prefs.email_enabled:
            logger.debug(f"Email disabled for user {notification_data.user_id}")
            return result

        # Check specific notification type preference
        notification_type = notification_data.notification_type
        if isinstance(notification_type, NotificationType):
            notification_type = notification_type.value

        if not prefs.is_enabled(notification_type):
            logger.debug(
                f"Email disabled for {notification_type} for user {notification_data.user_id}"
            )
            return result

    # Send email notification
    try:
        email_service = await get_email_service()

        # Build template context
        context = template_context or {}
        context.update({
            "notification_type": notification_data.notification_type,
            "title": notification_data.title,
            "message": notification_data.message,
        })

        if notification_data.bounty_id:
            context["bounty_id"] = str(notification_data.bounty_id)

        if notification_data.extra_data:
            context.update(notification_data.extra_data)

        email_result = await email_service.send_notification_email(
            user_id=notification_data.user_id,
            user_email=user_email,
            user_name=user_name or "Contributor",
            notification_type=notification_data.notification_type,
            template_context=context,
        )

        result["email_sent"] = email_result.success
        if not email_result.success:
            result["email_error"] = email_result.error

    except Exception as e:
        logger.exception(f"Failed to send email notification: {e}")
        result["email_error"] = str(e)

    return result


async def send_bounty_claimed_email(
    db: AsyncSession,
    creator_user_id: str,
    creator_email: str,
    creator_name: str,
    bounty_title: str,
    bounty_id: str,
    bounty_reward: str,
    claimer_name: str,
):
    """Send email when bounty is claimed.

    Args:
        db: Database session
        creator_user_id: Bounty creator's user ID
        creator_email: Bounty creator's email
        creator_name: Bounty creator's display name
        bounty_title: Title of the bounty
        bounty_id: UUID of the bounty
        bounty_reward: Reward amount
        claimer_name: Name of the claimer
    """
    notification_data = NotificationCreate(
        user_id=creator_user_id,
        notification_type=NotificationType.BOUNTY_CLAIMED,
        title=f"Bounty Claimed: {bounty_title}",
        message=f"{claimer_name} has claimed your bounty '{bounty_title}'.",
        bounty_id=bounty_id,
    )

    return await create_notification_with_email(
        db=db,
        notification_data=notification_data,
        user_email=creator_email,
        user_name=creator_name,
        template_context={
            "bounty_title": bounty_title,
            "bounty_id": bounty_id,
            "bounty_reward": bounty_reward,
            "claimer_name": claimer_name,
        },
    )


async def send_pr_submitted_email(
    db: AsyncSession,
    reviewer_user_id: str,
    reviewer_email: str,
    reviewer_name: str,
    bounty_title: str,
    bounty_id: str,
    pr_url: str,
    pr_number: str,
    contributor_name: str,
):
    """Send email when PR is submitted for review.

    Args:
        db: Database session
        reviewer_user_id: Reviewer's user ID
        reviewer_email: Reviewer's email
        reviewer_name: Reviewer's display name
        bounty_title: Title of the bounty
        bounty_id: UUID of the bounty
        pr_url: URL to the pull request
        pr_number: PR number
        contributor_name: Name of the contributor who submitted
    """
    notification_data = NotificationCreate(
        user_id=reviewer_user_id,
        notification_type=NotificationType.PR_SUBMITTED,
        title=f"PR Submitted: {bounty_title}",
        message=f"{contributor_name} submitted PR #{pr_number} for '{bounty_title}'.",
        bounty_id=bounty_id,
        extra_data={"pr_url": pr_url, "pr_number": pr_number},
    )

    return await create_notification_with_email(
        db=db,
        notification_data=notification_data,
        user_email=reviewer_email,
        user_name=reviewer_name,
        template_context={
            "bounty_title": bounty_title,
            "bounty_id": bounty_id,
            "pr_url": pr_url,
            "pr_number": pr_number,
            "contributor_name": contributor_name,
        },
    )


async def send_review_complete_email(
    db: AsyncSession,
    contributor_user_id: str,
    contributor_email: str,
    contributor_name: str,
    bounty_title: str,
    bounty_id: str,
    pr_url: str,
    review_status: str,
    review_score: str = "",
    reviewer_feedback: str = "",
):
    """Send email when review is complete.

    Args:
        db: Database session
        contributor_user_id: Contributor's user ID
        contributor_email: Contributor's email
        contributor_name: Contributor's display name
        bounty_title: Title of the bounty
        bounty_id: UUID of the bounty
        pr_url: URL to the pull request
        review_status: 'approved', 'changes_requested', etc.
        review_score: Review score (e.g., "8")
        reviewer_feedback: Feedback from reviewer
    """
    notification_data = NotificationCreate(
        user_id=contributor_user_id,
        notification_type=NotificationType.REVIEW_COMPLETE,
        title=f"Review Complete: {bounty_title}",
        message=f"Your PR for '{bounty_title}' has been reviewed: {review_status}",
        bounty_id=bounty_id,
        extra_data={"pr_url": pr_url, "review_status": review_status},
    )

    return await create_notification_with_email(
        db=db,
        notification_data=notification_data,
        user_email=contributor_email,
        user_name=contributor_name,
        template_context={
            "bounty_title": bounty_title,
            "bounty_id": bounty_id,
            "pr_url": pr_url,
            "review_status": review_status,
            "review_score": review_score,
            "reviewer_feedback": reviewer_feedback,
        },
    )


async def send_payout_sent_email(
    db: AsyncSession,
    contributor_user_id: str,
    contributor_email: str,
    contributor_name: str,
    bounty_title: str,
    bounty_id: str,
    amount: str,
    token: str,
    transaction_url: str,
):
    """Send email when payout is sent.

    Args:
        db: Database session
        contributor_user_id: Contributor's user ID
        contributor_email: Contributor's email
        contributor_name: Contributor's display name
        bounty_title: Title of the bounty
        bounty_id: UUID of the bounty
        amount: Payout amount
        token: Token symbol (e.g., "$FNDRY")
        transaction_url: URL to blockchain explorer
    """
    notification_data = NotificationCreate(
        user_id=contributor_user_id,
        notification_type=NotificationType.PAYOUT_SENT,
        title=f"Payout Sent: {amount} {token}",
        message=f"Your bounty payout of {amount} {token} for '{bounty_title}' has been sent.",
        bounty_id=bounty_id,
    )

    return await create_notification_with_email(
        db=db,
        notification_data=notification_data,
        user_email=contributor_email,
        user_name=contributor_name,
        template_context={
            "bounty_title": bounty_title,
            "bounty_id": bounty_id,
            "amount": amount,
            "token": token,
            "transaction_url": transaction_url,
        },
    )


async def send_new_bounty_matching_skills_email(
    db: AsyncSession,
    user_id: str,
    user_email: str,
    user_name: str,
    bounty_title: str,
    bounty_id: str,
    bounty_reward: str,
    matched_skills: list,
    bounty_tier: str = "",
):
    """Send email when new bounty matches user's skills.

    Args:
        db: Database session
        user_id: User's ID
        user_email: User's email
        user_name: User's display name
        bounty_title: Title of the bounty
        bounty_id: UUID of the bounty
        bounty_reward: Reward amount
        matched_skills: List of matched skill strings
        bounty_tier: Bounty tier (T1, T2, T3)
    """
    # Check email preferences for new_bounty_matching_skills
    prefs_query = select(EmailPreferencesDB).where(
        EmailPreferencesDB.user_id == user_id
    )
    prefs_result = await db.execute(prefs_query)
    prefs = prefs_result.scalar_one_or_none()

    if prefs:
        if not prefs.email_enabled:
            logger.debug(f"Email disabled for user {user_id}")
            return {"email_sent": False, "email_error": "Email disabled"}

        if not prefs.is_enabled("new_bounty_matching_skills"):
            logger.debug(f"Bounty match emails disabled for user {user_id}")
            return {"email_sent": False, "email_error": "Preference disabled"}

    try:
        email_service = await get_email_service()

        email_result = await email_service.send_new_bounty_email(
            user_id=user_id,
            user_email=user_email,
            user_name=user_name,
            bounty_title=bounty_title,
            bounty_id=bounty_id,
            bounty_reward=bounty_reward,
            matched_skills=matched_skills,
            bounty_tier=bounty_tier,
        )

        return {
            "email_sent": email_result.success,
            "email_error": email_result.error if not email_result.success else None,
        }

    except Exception as e:
        logger.exception(f"Failed to send bounty match email: {e}")
        return {"email_sent": False, "email_error": str(e)}