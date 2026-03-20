"""Notification API endpoints.

This module provides REST endpoints for the notification system.
All endpoints require authentication to ensure users can only access
their own notifications.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    NotificationCreate,
)
from app.services.notification_service import NotificationService
from app.database import get_db
from app.auth import get_current_user_id, get_authenticated_user, AuthenticatedUser

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated notifications for the authenticated user.

    - **unread_only**: If true, only return unread notifications
    - **skip**: Pagination offset
    - **limit**: Number of results per page

    Returns notifications sorted by creation date (newest first).

    **Authentication**: Requires valid Bearer token or X-User-ID header.
    """
    service = NotificationService(db)
    return await service.get_notifications(
        user_id=user_id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get unread notification count for the authenticated user.

    Returns the number of unread notifications.

    **Authentication**: Requires valid Bearer token or X-User-ID header.
    """
    service = NotificationService(db)
    return await service.get_unread_count(user_id)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a notification as read.

    - **notification_id**: ID of the notification to mark

    Returns the updated notification.

    **Authentication**: Requires valid Bearer token or X-User-ID header.

    **Authorization**: Users can only mark their own notifications as read.

    Raises:
        404: If notification not found or not owned by user.
    """
    service = NotificationService(db)

    # Get notification to verify ownership
    notification = await service.get_notification_by_id(notification_id)

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    # Verify ownership
    if not user.owns_resource(str(notification.user_id)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    success = await service.mark_as_read(notification_id, str(notification.user_id))

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notification as read",
        )

    return NotificationResponse.model_validate(notification)


@router.post("/read-all")
async def mark_all_notifications_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark all notifications as read for the authenticated user.

    Returns the number of notifications marked as read.

    **Authentication**: Requires valid Bearer token or X-User-ID header.
    """
    service = NotificationService(db)
    count = await service.mark_all_as_read(user_id)

    return {"message": f"Marked {count} notifications as read", "count": count}


@router.post("", response_model=NotificationResponse, status_code=201)
async def create_notification(
    notification: NotificationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new notification.

    This endpoint is typically called by other services internally.
    It does not require authentication as it's used by backend services.

    - **user_id**: User to notify
    - **notification_type**: Type of notification (bounty_claimed, pr_submitted, etc.)
    - **title**: Short title
    - **message**: Detailed message
    - **bounty_id**: Related bounty ID (optional)
    - **metadata**: Additional context (optional)

    Note: This endpoint should be protected by API key or internal-only access
    in production.
    """
    service = NotificationService(db)

    try:
        notification_db = await service.create_notification(notification)

        # Refresh to get generated fields
        await db.refresh(notification_db)

        return NotificationResponse.model_validate(notification_db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
