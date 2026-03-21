"""Email preferences database model.

Stores per-user email notification preferences and unsubscribe status.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import JSON, Boolean, Column, DateTime, Index, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.models.notification import NotificationType


class EmailPreferencesDB(Base):
    """Database model for email notification preferences.

    Stores per-user preferences for each notification type.
    Allows users to opt-out of specific notification types.
    """

    __tablename__ = "email_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    email_enabled = Column(Boolean, default=True, nullable=False)
    # JSON dict of notification_type -> enabled (bool)
    preferences = Column(JSON, default=dict, nullable=False)
    # Store email address for convenience
    email_address = Column(String(255), nullable=True)
    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_email_preferences_user_id", user_id),
    )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"<EmailPreferencesDB(user_id={self.user_id!r})>"

    def is_enabled(self, notification_type: str) -> bool:
        """Check if a notification type is enabled for this user.

        Args:
            notification_type: The notification type to check.

        Returns:
            True if enabled, False if opted out.
        """
        if not self.email_enabled:
            return False

        # Default to enabled if not explicitly set
        return self.preferences.get(notification_type, True)

    def set_preference(self, notification_type: str, enabled: bool):
        """Set preference for a notification type.

        Args:
            notification_type: The notification type.
            enabled: Whether to enable or disable.
        """
        if self.preferences is None:
            self.preferences = {}
        self.preferences[notification_type] = enabled
        # Mark the JSON field as modified so SQLAlchemy detects the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(self, "preferences")


class EmailPreferencesBase(BaseModel):
    """Base model for email preferences."""

    email_enabled: bool = Field(
        default=True,
        description="Master toggle for all email notifications",
    )
    preferences: Dict[str, bool] = Field(
        default_factory=dict,
        description="Per-notification-type preferences",
    )


class EmailPreferencesUpdate(BaseModel):
    """Model for updating email preferences."""

    email_enabled: Optional[bool] = Field(
        None,
        description="Master toggle for all email notifications",
    )
    preferences: Optional[Dict[str, bool]] = Field(
        None,
        description="Per-notification-type preferences to update",
    )


class EmailPreferencesResponse(EmailPreferencesBase):
    """Response model for email preferences."""

    id: str
    user_id: str
    email_address: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UnsubscribeRequest(BaseModel):
    """Model for unsubscribe request."""

    token: str = Field(..., description="Unsubscribe token from email")
    notification_type: str = Field(..., description="Notification type to unsubscribe from")


class UnsubscribeResponse(BaseModel):
    """Response model for unsubscribe action."""

    success: bool
    message: str
    notification_type: Optional[str] = None


# Default notification types for preferences UI
DEFAULT_NOTIFICATION_TYPES = [
    {
        "type": NotificationType.BOUNTY_CLAIMED.value,
        "label": "Bounty Claimed",
        "description": "When someone claims your bounty",
        "default_enabled": True,
    },
    {
        "type": NotificationType.PR_SUBMITTED.value,
        "label": "PR Submitted",
        "description": "When a PR is submitted for your bounty",
        "default_enabled": True,
    },
    {
        "type": NotificationType.REVIEW_COMPLETE.value,
        "label": "Review Complete",
        "description": "When your PR review is complete",
        "default_enabled": True,
    },
    {
        "type": NotificationType.PAYOUT_SENT.value,
        "label": "Payout Sent",
        "description": "When your bounty payout is sent",
        "default_enabled": True,
    },
    {
        "type": "new_bounty_matching_skills",
        "label": "New Bounty Matches",
        "description": "When a new bounty matches your skills",
        "default_enabled": True,
    },
    {
        "type": NotificationType.SUBMISSION_APPROVED.value,
        "label": "Submission Approved",
        "description": "When your submission is approved",
        "default_enabled": True,
    },
    {
        "type": NotificationType.SUBMISSION_REJECTED.value,
        "label": "Submission Rejected",
        "description": "When your submission is rejected",
        "default_enabled": True,
    },
    {
        "type": NotificationType.PAYOUT_FAILED.value,
        "label": "Payout Failed",
        "description": "When a payout fails",
        "default_enabled": True,
    },
]


class NotificationTypeList(BaseModel):
    """List of available notification types."""

    types: List[Dict[str, Any]] = Field(
        default_factory=lambda: DEFAULT_NOTIFICATION_TYPES,
        description="Available notification types with descriptions",
    )