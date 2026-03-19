"""Notification API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    NotificationCreate,
)
from app.services.notification_service import NotificationService
from app.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    user_id: str = Query(..., description="User ID (temporarily required)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated notifications for a user.
    
    - **unread_only**: If true, only return unread notifications
    - **skip**: Pagination offset
    - **limit**: Number of results per page
    - **user_id**: User ID to get notifications for
    
    Returns notifications sorted by creation date (newest first).
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
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get unread notification count for a user.
    
    - **user_id**: User ID to get count for
    
    Returns the number of unread notifications.
    """
    service = NotificationService(db)
    return await service.get_unread_count(user_id)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a notification as read.
    
    - **notification_id**: ID of the notification to mark
    - **user_id**: User ID who owns the notification
    
    Returns the updated notification.
    
    Raises 404 if notification not found.
    """
    service = NotificationService(db)
    
    # Get notification to return
    from sqlalchemy import select
    from app.models.notification import NotificationDB
    
    query = select(NotificationDB).where(NotificationDB.id == notification_id)
    result = await db.execute(query)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    success = await service.mark_as_read(notification_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Notification not found or not owned by user"
        )
    
    return NotificationResponse.model_validate(notification)


@router.post("/read-all")
async def mark_all_notifications_read(
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark all notifications as read for a user.
    
    - **user_id**: User ID to mark notifications for
    
    Returns the number of notifications marked as read.
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
    
    - **user_id**: User to notify
    - **notification_type**: Type of notification (bounty_claimed, pr_submitted, etc.)
    - **title**: Short title
    - **message**: Detailed message
    - **bounty_id**: Related bounty ID (optional)
    - **metadata**: Additional context (optional)
    """
    service = NotificationService(db)
    
    try:
        notification_db = await service.create_notification(notification)
        
        # Refresh to get generated fields
        await db.refresh(notification_db)
        
        return NotificationResponse.model_validate(notification_db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))