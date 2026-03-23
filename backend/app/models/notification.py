"""Notification database and Pydantic models.

This module defines the data models for the notification system.
Notifications keep contributors informed about bounty events.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Boolean, JSON, Text, Index
from app.database import Base, GUID


class NotificationType(str, Enum):
    """Types of notifications in the system."""

    BOUNTY_CLAIMED = "bounty_claimed"
    PR_SUBMITTED = "pr_submitted"
    REVIEW_COMPLETE = "review_complete"
    PAYOUT_SENT = "payout_sent"
    BOUNTY_EXPIRED = "bounty_expired"
    RANK_CHANGED = "rank_changed"
    SUBMISSION_RECEIVED = "submission_received"
    SUBMISSION_APPROVED = "submission_approved"
    SUBMISSION_REJECTED = "submission_rejected"
    SUBMISSION_DISPUTED = "submission_disputed"
    AUTO_APPROVED = "auto_approved"
    PAYOUT_INITIATED = "payout_initiated"
    PAYOUT_CONFIRMED = "payout_confirmed"
    PAYOUT_FAILED = "payout_failed"


class NotificationDB(Base):
    """
    Notification database model.

    Stores notifications for users about bounty-related events.
    Supports both in-app and email notifications.
    """

    __tablename__ = "notifications"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, nullable=False, index=True)
    notification_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False, nullable=False, index=True)
    bounty_id = Column(GUID, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    extra_data = Column(JSON, nullable=True)  # Additional context

    __table_args__ = (
        Index("ix_notifications_user_read", user_id, read),
        Index("ix_notifications_user_created", user_id, created_at),
    )


# Pydantic models


class NotificationBase(BaseModel):
    """Base notification fields."""

    notification_type: NotificationType = Field(
        ...,
        description="The type of notification event",
        examples=[NotificationType.BOUNTY_CLAIMED],
    )
    title: str = Field(
        ...,
        max_length=255,
        description="Brief notification title",
        examples=["Bounty Claimed!"],
    )
    message: str = Field(
        ...,
        description="Detailed notification message (can contain markdown)",
        examples=["Your bounty 'Refactor Auth' has been claimed by @cryptodev."],
    )
    bounty_id: Optional[str] = Field(
        None,
        description="Associated bounty UUID if applicable",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
    extra_data: Optional[dict] = Field(
        None, description="Optional structured metadata for the event"
    )


class NotificationCreate(NotificationBase):
    """Schema for creating a notification."""

    user_id: str


class NotificationResponse(NotificationBase):
    """Full notification response."""

    id: str
    user_id: str
    read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class NotificationListItem(BaseModel):
    """Brief notification for list views."""

    id: str
    notification_type: str
    title: str
    message: str
    read: bool
    bounty_id: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Paginated notification list."""

    items: List[NotificationListItem]
    total: int
    unread_count: int
    skip: int
    limit: int


class UnreadCountResponse(BaseModel):
    """Response for unread count endpoint."""

    unread_count: int = Field(
        ..., description="Number of notifications marked as unread", examples=[5]
    )
