from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationUpdate
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=dict)
def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    unread_only: Optional[bool] = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notifications for the current user with pagination"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "notifications": [NotificationResponse.from_orm(n) for n in notifications],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_next": skip + limit < total
    }

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a specific notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    
    return NotificationResponse.from_orm(notification)

@router.post("/read-all", response_model=dict)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for the current user"""
    updated_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"message": f"Marked {updated_count} notifications as read"}