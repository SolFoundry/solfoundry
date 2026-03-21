"""Email notification API endpoints.

Provides endpoints for:
- Managing email preferences
- Unsubscribing from notifications
- Viewing notification types
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user_id, get_authenticated_user, AuthenticatedUser
from app.models.email_preferences import (
    EmailPreferencesDB,
    EmailPreferencesResponse,
    EmailPreferencesUpdate,
    UnsubscribeRequest,
    UnsubscribeResponse,
    NotificationTypeList,
)
from app.models.errors import ErrorResponse
from app.services.email.service import EmailPreferences

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email-notifications"])


@router.get(
    "/preferences",
    response_model=EmailPreferencesResponse,
    summary="Get email preferences",
    description="Get the current user's email notification preferences.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def get_email_preferences(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get email notification preferences for the authenticated user.

    Returns the user's current email preferences including:
    - Master email toggle
    - Per-notification-type preferences
    """
    query = select(EmailPreferencesDB).where(EmailPreferencesDB.user_id == user_id)
    result = await db.execute(query)
    prefs = result.scalar_one_or_none()

    if not prefs:
        # Create default preferences
        prefs = EmailPreferencesDB(user_id=user_id, preferences={})
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)

    return EmailPreferencesResponse.model_validate(prefs)


@router.patch(
    "/preferences",
    response_model=EmailPreferencesResponse,
    summary="Update email preferences",
    description="Update the current user's email notification preferences.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        400: {"model": ErrorResponse, "description": "Invalid preferences"},
    },
)
async def update_email_preferences(
    update: EmailPreferencesUpdate,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    """Update email notification preferences.

    Allows updating:
    - Master email toggle (email_enabled)
    - Individual notification type preferences (preferences)

    Only provided fields are updated.
    """
    query = select(EmailPreferencesDB).where(
        EmailPreferencesDB.user_id == str(user.user_id)
    )
    result = await db.execute(query)
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = EmailPreferencesDB(
            user_id=str(user.user_id),
            email_address=user.email,
        )
        db.add(prefs)

    # Update fields
    if update.email_enabled is not None:
        prefs.email_enabled = update.email_enabled

    if update.preferences is not None:
        # Merge with existing preferences
        if prefs.preferences is None:
            prefs.preferences = {}
        prefs.preferences.update(update.preferences)

    await db.commit()
    await db.refresh(prefs)

    logger.info(f"Updated email preferences for user {user.user_id}")

    return EmailPreferencesResponse.model_validate(prefs)


@router.post(
    "/unsubscribe",
    response_model=UnsubscribeResponse,
    summary="Unsubscribe from email notifications",
    description="Unsubscribe from a specific notification type using the token from an email.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid token"},
    },
)
async def unsubscribe_from_email(
    request: UnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Unsubscribe from a notification type.

    Uses the token from email to identify the user without authentication.
    This allows one-click unsubscribe from email clients.
    """
    import os
    from uuid import UUID

    # We need to find the user by verifying the token
    # Since tokens are user-specific, we need to check against all users
    # This is handled by the EmailPreferences verification

    secret = os.getenv("SECRET_KEY", "change-me-in-production")

    # Query all email preferences to find matching token
    # In production, you might want a more efficient approach
    query = select(EmailPreferencesDB)
    result = await db.execute(query)
    all_prefs = result.scalars().all()

    matching_user = None
    for prefs in all_prefs:
        if EmailPreferences.verify_unsubscribe_token(
            str(prefs.user_id),
            request.notification_type,
            request.token,
            secret,
        ):
            matching_user = prefs
            break

    if not matching_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired unsubscribe token",
        )

    # Update preference
    matching_user.set_preference(request.notification_type, False)
    await db.commit()

    logger.info(
        f"User {matching_user.user_id} unsubscribed from {request.notification_type}"
    )

    return UnsubscribeResponse(
        success=True,
        message=f"You have been unsubscribed from {request.notification_type} emails",
        notification_type=request.notification_type,
    )


@router.post(
    "/unsubscribe/all",
    response_model=UnsubscribeResponse,
    summary="Unsubscribe from all emails",
    description="Disable all email notifications for the current user.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def unsubscribe_all(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Disable all email notifications.

    Sets the master email_enabled toggle to False.
    """
    query = select(EmailPreferencesDB).where(EmailPreferencesDB.user_id == user_id)
    result = await db.execute(query)
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = EmailPreferencesDB(user_id=user_id, email_enabled=False)
        db.add(prefs)
    else:
        prefs.email_enabled = False

    await db.commit()

    logger.info(f"User {user_id} unsubscribed from all emails")

    return UnsubscribeResponse(
        success=True,
        message="You have been unsubscribed from all email notifications",
    )


@router.post(
    "/resubscribe",
    response_model=UnsubscribeResponse,
    summary="Re-enable email notifications",
    description="Re-enable all email notifications for the current user.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def resubscribe(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Re-enable all email notifications.

    Sets the master email_enabled toggle to True.
    """
    query = select(EmailPreferencesDB).where(EmailPreferencesDB.user_id == user_id)
    result = await db.execute(query)
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = EmailPreferencesDB(user_id=user_id, email_enabled=True)
        db.add(prefs)
    else:
        prefs.email_enabled = True

    await db.commit()

    logger.info(f"User {user_id} re-enabled email notifications")

    return UnsubscribeResponse(
        success=True,
        message="Email notifications have been re-enabled",
    )


@router.get(
    "/notification-types",
    response_model=NotificationTypeList,
    summary="List notification types",
    description="Get list of all notification types with descriptions for preferences UI.",
)
async def list_notification_types():
    """List all available notification types.

    Returns notification types with labels and descriptions
    for building a preferences UI.
    """
    return NotificationTypeList()


@router.get(
    "/rate-limit-status",
    summary="Get rate limit status",
    description="Get the number of remaining emails the user can send in the current hour.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def get_rate_limit_status(
    user_id: str = Depends(get_current_user_id),
):
    """Get remaining email quota for the current hour.

    Returns the number of emails the user can still send.
    """
    from app.services.email.service import get_email_service

    try:
        service = await get_email_service()
        remaining = await service.rate_limiter.get_remaining(user_id)
        return {
            "remaining": remaining,
            "limit": 10,  # EMAIL_RATE_LIMIT
            "reset_seconds": 3600,  # EMAIL_RATE_WINDOW
        }
    except Exception as e:
        logger.exception(f"Failed to get rate limit status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get rate limit status",
        )