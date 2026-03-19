"""Notification service."""
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import redis.asyncio as redis
import json
from app.models.notification import Notification
from app.models.user import User
from app.config import settings


class NotificationService:
    """Notification service."""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
    
    async def get_redis(self) -> redis.Redis:
        """Get Redis connection."""
        if not self.redis_client:
            self.redis_client = redis.from_url(settings.REDIS_URL)
        return self.redis_client
    
    async def create_notification(
        self,
        user_id: int,
        notification_type: str,
        message: str,
        bounty_id: Optional[int] = None,
        metadata: Optional[dict] = None,
        session: AsyncSession = None,
    ) -> Notification:
        """Create a new notification."""
        notification = Notification(
            type=notification_type,
            message=message,
            user_id=user_id,
            bounty_id=bounty_id,
            metadata=metadata,
        )
        
        if session:
            session.add(notification)
            await session.flush()
            await session.refresh(notification)
        
        # Push via WebSocket
        await self.push_notification(user_id, notification)
        
        return notification
    
    async def push_notification(self, user_id: int, notification: Notification):
        """Push notification via WebSocket (Redis pub/sub)."""
        try:
            r = await self.get_redis()
            await r.publish(
                f"user:{user_id}:notifications",
                json.dumps({
                    "id": notification.id,
                    "type": notification.type,
                    "message": notification.message,
                    "read": notification.read,
                    "created_at": notification.created_at.isoformat(),
                })
            )
        except Exception as e:
            # Redis not available, skip real-time push
            pass
    
    async def send_email_notification(
        self,
        user: User,
        notification_type: str,
        message: str,
    ):
        """Send email notification via Resend."""
        if not settings.RESEND_API_KEY or not user.email:
            return
        
        try:
            import resend
            
            resend.api_key = settings.RESEND_API_KEY
            
            await resend.Emails.send_async({
                "from": settings.EMAIL_FROM,
                "to": user.email,
                "subject": f"SolFoundry: {notification_type.replace('_', ').title()}",
                "html": f"<p>{message}</p>",
            })
        except Exception as e:
            # Email failed, but don't raise
            pass
    
    async def get_notifications(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        session: AsyncSession = None,
    ) -> tuple[List[Notification], int, int]:
        """Get paginated notifications for user."""
        offset = (page - 1) * page_size
        
        # Get total count
        count_stmt = select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
        total = (await session.execute(count_stmt)).scalar()
        
        # Get unread count
        unread_stmt = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.read == False
        )
        unread_count = (await session.execute(unread_stmt)).scalar()
        
        # Get notifications
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        notifications = result.scalars().all()
        
        return notifications, unread_count, total
    
    async def mark_as_read(self, notification_id: int, user_id: int, session: AsyncSession) -> Optional[Notification]:
        """Mark notification as read."""
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id
        )
        result = await session.execute(stmt)
        notification = result.scalar_one_or_none()
        
        if notification:
            notification.read = True
            await session.flush()
        
        return notification
    
    async def mark_all_as_read(self, user_id: int, session: AsyncSession) -> int:
        """Mark all notifications as read for user."""
        from sqlalchemy import update
        
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read == False)
            .values(read=True)
        )
        result = await session.execute(stmt)
        return result.rowcount


notification_service = NotificationService()
