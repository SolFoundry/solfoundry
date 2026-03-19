"""Notification service for managing user notifications."""

from typing import List, Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    NotificationDB,
    NotificationCreate,
    NotificationListResponse,
    NotificationListItem,
    UnreadCountResponse,
    NotificationType,
)


class NotificationService:
    """Service for notification operations."""
    
    VALID_TYPES = {t.value for t in NotificationType}
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 20,
    ) -> NotificationListResponse:
        """
        Get paginated notifications for a user.
        
        Args:
            user_id: The user to get notifications for.
            unread_only: If True, only return unread notifications.
            skip: Pagination offset.
            limit: Number of results per page.
            
        Returns:
            NotificationListResponse with notifications and counts.
        """
        # Build query conditions
        conditions = [NotificationDB.user_id == user_id]
        
        if unread_only:
            conditions.append(NotificationDB.read == False)
        
        filter_condition = and_(*conditions)
        
        # Count query
        count_query = select(func.count(NotificationDB.id)).where(filter_condition)
        
        # Unread count query
        unread_query = select(func.count(NotificationDB.id)).where(
            and_(
                NotificationDB.user_id == user_id,
                NotificationDB.read == False
            )
        )
        
        # Main query
        query = (
            select(NotificationDB)
            .where(filter_condition)
            .order_by(NotificationDB.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        
        # Execute queries
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        unread_result = await self.db.execute(unread_query)
        unread_count = unread_result.scalar() or 0
        
        return NotificationListResponse(
            items=[NotificationListItem.model_validate(n) for n in notifications],
            total=total,
            unread_count=unread_count,
            skip=skip,
            limit=limit,
        )
    
    async def get_unread_count(self, user_id: str) -> UnreadCountResponse:
        """
        Get unread notification count for a user.
        
        Args:
            user_id: The user to get count for.
            
        Returns:
            UnreadCountResponse with the count.
        """
        query = select(func.count(NotificationDB.id)).where(
            and_(
                NotificationDB.user_id == user_id,
                NotificationDB.read == False
            )
        )
        
        result = await self.db.execute(query)
        count = result.scalar() or 0
        
        return UnreadCountResponse(unread_count=count)
    
    async def mark_as_read(self, notification_id: str, user_id: str) -> bool:
        """
        Mark a notification as read.
        
        Args:
            notification_id: The notification to mark.
            user_id: The user who owns the notification.
            
        Returns:
            True if updated, False if not found.
        """
        query = select(NotificationDB).where(
            and_(
                NotificationDB.id == notification_id,
                NotificationDB.user_id == user_id
            )
        )
        
        result = await self.db.execute(query)
        notification = result.scalar_one_or_none()
        
        if not notification:
            return False
        
        notification.read = True
        # Session will auto-commit on exit
        return True
    
    async def mark_all_as_read(self, user_id: str) -> int:
        """
        Mark all notifications as read for a user.
        
        Args:
            user_id: The user to mark notifications for.
            
        Returns:
            Number of notifications marked.
        """
        query = select(NotificationDB).where(
            and_(
                NotificationDB.user_id == user_id,
                NotificationDB.read == False
            )
        )
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            notification.read = True
            count += 1
        
        return count
    
    async def create_notification(self, data: NotificationCreate) -> NotificationDB:
        """
        Create a new notification.
        
        Args:
            data: Notification creation data.
            
        Returns:
            The created notification.
            
        Raises:
            ValueError: If notification_type is invalid.
        """
        if data.notification_type not in self.VALID_TYPES:
            raise ValueError(
                f"Invalid notification type: {data.notification_type}. "
                f"Must be one of: {self.VALID_TYPES}"
            )
        
        notification = NotificationDB(
            user_id=data.user_id,
            notification_type=data.notification_type,
            title=data.title,
            message=data.message,
            bounty_id=data.bounty_id,
            metadata=data.metadata,
        )
        
        self.db.add(notification)
        # Session will auto-commit on exit
        
        return notification