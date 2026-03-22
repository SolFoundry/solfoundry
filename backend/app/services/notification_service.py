"""Notification service for managing user notifications.

This module provides the business logic for notification operations.
All methods are designed to work with the Unit of Work pattern
implemented in the database layer.
"""

from typing import Optional
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
        """Initialize the instance."""
        self.db = db

    async def get_notification_by_id(
        self, notification_id: str
    ) -> Optional[NotificationDB]:
        """
        Get a single notification by ID.

        Args:
            notification_id: The notification ID to retrieve.

        Returns:
            The notification if found, None otherwise.
        """
        query = select(NotificationDB).where(NotificationDB.id == notification_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

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
            conditions.append(NotificationDB.read.is_(False))

        filter_condition = and_(*conditions)

        # Count query
        count_query = select(func.count(NotificationDB.id)).where(filter_condition)

        # Unread count query
        unread_query = select(func.count(NotificationDB.id)).where(
            and_(NotificationDB.user_id == user_id, NotificationDB.read.is_(False))
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
            and_(NotificationDB.user_id == user_id, NotificationDB.read.is_(False))
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
                NotificationDB.id == notification_id, NotificationDB.user_id == user_id
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
            and_(NotificationDB.user_id == user_id, NotificationDB.read.is_(False))
        )

        result = await self.db.execute(query)
        notifications = result.scalars().all()

        count = 0
        for notification in notifications:
            notification.read = True
            count += 1

        return count

    async def create_notification(
        self, 
        data: NotificationCreate,
        background_tasks: Optional["BackgroundTasks"] = None
    ) -> NotificationDB:
        """
        Create a new notification and optionally trigger an email.

        Args:
            data: Notification creation data.
            background_tasks: FastAPI background tasks to avoid blocking.

        Returns:
            The created notification.
        """
        from fastapi import BackgroundTasks
        from app.services import contributor_service
        from app.services.email_service import (
            can_send_email,
            increment_email_count,
            send_notification_email
        )

        ntype = data.notification_type
        if isinstance(ntype, NotificationType):
            ntype = ntype.value
        if ntype not in self.VALID_TYPES:
            raise ValueError(
                f"Invalid notification type: {ntype}. "
                f"Must be one of: {self.VALID_TYPES}"
            )

        notification = NotificationDB(
            user_id=data.user_id,
            notification_type=data.notification_type,
            title=data.title,
            message=data.message,
            bounty_id=data.bounty_id,
            extra_data=data.extra_data,
        )

        self.db.add(notification)
        
        # Trigger email notification in background if applicable
        if background_tasks:
            background_tasks.add_task(
                self._trigger_email_notification,
                user_id=data.user_id,
                notification_type=ntype,
                title=data.title,
                message=data.message,
                bounty_id=data.bounty_id,
                extra_data=data.extra_data
            )

        return notification

    async def _trigger_email_notification(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        bounty_id: Optional[str] = None,
        extra_data: Optional[dict] = None
    ) -> None:
        """Background task to send an email notification."""
        from app.services import contributor_service
        from app.services.email_service import (
            can_send_email,
            increment_email_count,
            send_notification_email
        )

        # 1. Fetch contributor to get email and preferences
        contributor = await contributor_service.get_contributor(user_id)
        if not contributor or not contributor.email:
            return

        # 2. Check preferences
        if not contributor.email_notifications_enabled:
            return

        # Check specific preference
        prefs = contributor.notification_preferences or {}
        if not prefs.get(notification_type, True):
            return

        # 3. Check rate limit
        if not await can_send_email(user_id):
            return

        # 4. Route to type-specific template
        TEMPLATE_MAP = {
            "bounty_claimed": "bounty_claimed",
            "pr_submitted": "pr_submitted",
            "review_complete": "review_complete",
            "payout_sent": "payout_sent",
            "payout_initiated": "payout_sent",
            "payout_confirmed": "payout_sent",
            "new_bounty_matching_skills": "new_bounty",
        }
        template_name = TEMPLATE_MAP.get(notification_type, "notification")

        # 5. Build context
        context = {
            "title": title,
            "message": message,
            "bounty_id": bounty_id,
            "extra_data": extra_data or {},
            "unsubscribe_token": contributor.unsubscribe_token,
            "username": contributor.username,
            # Per-type context helpers
            "bounty_title": extra_data.get("bounty_title") if extra_data else None,
            "reward_amount": extra_data.get("reward_amount") if extra_data else None,
            "tier": extra_data.get("tier") if extra_data else None,
            "skills": extra_data.get("skills", []) if extra_data else [],
            "bounty_url": extra_data.get("bounty_url") if extra_data else None,
            "pr_url": extra_data.get("pr_url") if extra_data else None,
            "pr_number": extra_data.get("pr_number") if extra_data else None,
            "review_status": extra_data.get("review_status") if extra_data else None,
            "ai_score": extra_data.get("ai_score") if extra_data else None,
            "feedback": extra_data.get("feedback") if extra_data else None,
            "approved": extra_data.get("approved", False) if extra_data else False,
            "payout_amount": extra_data.get("payout_amount") if extra_data else None,
            "tx_signature": extra_data.get("tx_signature") if extra_data else None,
            "wallet_address": extra_data.get("wallet_address") if extra_data else None,
        }

        success = await send_notification_email(
            to=contributor.email,
            subject=f"[SolFoundry] {title}",
            template_name=template_name,
            context=context
        )

        # 6. Increment count on success
        if success:
            await increment_email_count(user_id)

    async def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """
        Delete a notification.

        Args:
            notification_id: The notification to delete.
            user_id: The user who owns the notification.

        Returns:
            True if deleted, False if not found.
        """
        query = select(NotificationDB).where(
            and_(
                NotificationDB.id == notification_id, NotificationDB.user_id == user_id
            )
        )

        result = await self.db.execute(query)
        notification = result.scalar_one_or_none()

        if not notification:
            return False

        await self.db.delete(notification)
        return True
