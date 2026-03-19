import asyncio
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.core.config import settings
import resend
from app.core.websocket_manager import websocket_manager
import logging

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.resend_client = resend
        resend.api_key = settings.RESEND_API_KEY
    
    async def create_notification(
        self,
        user_id: int,
        title: str,
        message: str,
        notification_type: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
        send_email: bool = False,
        send_push: bool = True,
        db: Optional[AsyncSession] = None
    ) -> Notification:
        """Create a new notification"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            metadata=metadata or {},
            created_at=datetime.utcnow()
        )
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        # Send notifications based on preferences
        if send_email:
            asyncio.create_task(self._send_email_notification(notification, db))
        
        if send_push:
            asyncio.create_task(self._send_push_notification(notification))
        
        return notification
    
    async def get_user_notifications(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        db: Optional[AsyncSession] = None
    ) -> List[Notification]:
        """Get notifications for a user"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.read_at.is_(None))
        
        query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def mark_as_read(
        self,
        notification_id: int,
        user_id: int,
        db: Optional[AsyncSession] = None
    ) -> bool:
        """Mark a notification as read"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalar_one_or_none()
        
        if notification and not notification.read_at:
            notification.read_at = datetime.utcnow()
            await db.commit()
            return True
        
        return False
    
    async def mark_all_as_read(
        self,
        user_id: int,
        db: Optional[AsyncSession] = None
    ) -> int:
        """Mark all notifications as read for a user"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        result = await db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None)
            )
        )
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            notification.read_at = datetime.utcnow()
            count += 1
        
        await db.commit()
        return count
    
    async def get_unread_count(
        self,
        user_id: int,
        db: Optional[AsyncSession] = None
    ) -> int:
        """Get count of unread notifications for a user"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        result = await db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None)
            )
        )
        return len(result.scalars().all())
    
    async def delete_notification(
        self,
        notification_id: int,
        user_id: int,
        db: Optional[AsyncSession] = None
    ) -> bool:
        """Delete a notification"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalar_one_or_none()
        
        if notification:
            await db.delete(notification)
            await db.commit()
            return True
        
        return False
    
    async def _send_email_notification(
        self,
        notification: Notification,
        db: AsyncSession
    ):
        """Send email notification using Resend"""
        try:
            # Get user email
            result = await db.execute(
                select(User).where(User.id == notification.user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user or not user.email:
                logger.warning(f"No email found for user {notification.user_id}")
                return
            
            # Prepare email content
            html_content = f"""
            <html>
                <body>
                    <h2>{notification.title}</h2>
                    <p>{notification.message}</p>
                    <hr>
                    <p><small>This is an automated notification from {settings.APP_NAME}</small></p>
                </body>
            </html>
            """
            
            # Send email via Resend
            params = {
                "from": f"{settings.APP_NAME} <{settings.FROM_EMAIL}>",
                "to": [user.email],
                "subject": notification.title,
                "html": html_content,
            }
            
            email = self.resend_client.Emails.send(params)
            logger.info(f"Email sent successfully: {email}")
            
        except Exception as e:
            logger.error(f"Failed to send email notification: {str(e)}")
    
    async def _send_push_notification(self, notification: Notification):
        """Send push notification via WebSocket"""
        try:
            notification_data = {
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "type": notification.type,
                "metadata": notification.metadata,
                "created_at": notification.created_at.isoformat(),
                "read_at": notification.read_at.isoformat() if notification.read_at else None
            }
            
            await websocket_manager.send_personal_message(
                json.dumps({
                    "type": "notification",
                    "data": notification_data
                }),
                notification.user_id
            )
            
        except Exception as e:
            logger.error(f"Failed to send push notification: {str(e)}")
    
    async def send_bulk_notification(
        self,
        user_ids: List[int],
        title: str,
        message: str,
        notification_type: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
        send_email: bool = False,
        send_push: bool = True,
        db: Optional[AsyncSession] = None
    ) -> List[Notification]:
        """Send notification to multiple users"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        notifications = []
        
        for user_id in user_ids:
            notification = await self.create_notification(
                user_id=user_id,
                title=title,
                message=message,
                notification_type=notification_type,
                metadata=metadata,
                send_email=send_email,
                send_push=send_push,
                db=db
            )
            notifications.append(notification)
        
        return notifications
    
    async def send_system_notification(
        self,
        title: str,
        message: str,
        notification_type: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
        send_email: bool = False,
        db: Optional[AsyncSession] = None
    ):
        """Send notification to all active users"""
        if db is None:
            async for session in get_db():
                db = session
                break
        
        # Get all active users
        result = await db.execute(
            select(User).where(User.is_active == True)
        )
        users = result.scalars().all()
        user_ids = [user.id for user in users]
        
        return await self.send_bulk_notification(
            user_ids=user_ids,
            title=title,
            message=message,
            notification_type=notification_type,
            metadata=metadata,
            send_email=send_email,
            db=db
        )

# Global instance
notification_service = NotificationService()