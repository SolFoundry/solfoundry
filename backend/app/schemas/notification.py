"""Notification schemas."""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class NotificationCreate(BaseModel):
    """Create notification."""
    type: str
    message: str
    bounty_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationResponse(BaseModel):
    """Notification response."""
    id: int
    type: str
    message: str
    read: bool
    bounty_id: Optional[int]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationsResponse(BaseModel):
    """Paginated notifications response."""
    notifications: list[NotificationResponse]
    unread_count: int
    total: int
    page: int
    page_size: int
