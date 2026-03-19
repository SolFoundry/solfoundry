"""Notification API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.services.notifications import notification_service
from app.middleware.auth import get_current_user
from app.schemas.notification import (
    NotificationResponse,
    NotificationsResponse,
    NotificationCreate,
)
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationsResponse)
async def get_notifications(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated notifications for current user."""
    notifications, unread_count, total = await notification_service.get_notifications(
        current_user.id, page, page_size, db
    )
    
    return NotificationsResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        unread_count=unread_count,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unread notification count."""
    from sqlalchemy import select, func
    from app.models.notification import Notification
    
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.read == False
    )
    result = await db.execute(stmt)
    count = result.scalar()
    
    return {"unread_count": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark notification as read."""
    notification = await notification_service.mark_as_read(
        notification_id, current_user.id, db
    )
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return NotificationResponse.model_validate(notification)


@router.post("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    count = await notification_service.mark_all_as_read(current_user.id, db)
    
    return {"message": f"Marked {count} notifications as read"}


@router.post("", response_model=NotificationResponse)
async def create_notification(
    notification_data: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new notification (admin only in production)."""
    notification = await notification_service.create_notification(
        current_user.id,
        notification_data.type,
        notification_data.message,
        notification_data.bounty_id,
        notification_data.metadata,
        db,
    )
    
    return NotificationResponse.model_validate(notification)
