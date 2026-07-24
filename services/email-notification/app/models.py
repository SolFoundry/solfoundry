"""Pydantic models for the email notification service."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class EventType(str, Enum):
    """Types of events that trigger email notifications."""
    BOUNTY_POSTED = "bounty_posted"
    BOUNTY_UPDATED = "bounty_updated"
    BOUNTY_COMPLETED = "bounty_completed"
    SUBMISSION_RECEIVED = "submission_received"
    SUBMISSION_REVIEWED = "submission_reviewed"
    REWARD_PAID = "reward_paid"
    CONTRIBUTOR_MILESTONE = "contributor_milestone"


class DigestFrequency(str, Enum):
    """How often a user receives digest emails."""
    INSTANT = "instant"
    DAILY = "daily"
    WEEKLY = "weekly"
    NEVER = "never"


class UserPreference(BaseModel):
    """User's email notification preferences."""
    user_id: str
    email: EmailStr
    digest_frequency: DigestFrequency = DigestFrequency.INSTANT
    subscribed_events: list[EventType] = Field(default_factory=lambda: list(EventType))
    max_daily_emails: int = 20
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserPreferenceUpdate(BaseModel):
    """Partial update model for user preferences."""
    email: Optional[EmailStr] = None
    digest_frequency: Optional[DigestFrequency] = None
    subscribed_events: Optional[list[EventType]] = None
    max_daily_emails: Optional[int] = None
    active: Optional[bool] = None


class EmailNotification(BaseModel):
    """An email notification to be sent."""
    id: str
    user_id: str
    to_email: EmailStr
    event_type: EventType
    subject: str
    html_body: str
    plain_body: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    status: str = "pending"  # pending, sent, failed, bounced
    error_message: Optional[str] = None
    retry_count: int = 0
    bounce_count: int = 0


class DeliveryStatus(BaseModel):
    """Status of an email delivery attempt."""
    notification_id: str
    status: str  # sent, failed, bounced
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


class BountyEvent(BaseModel):
    """Event payload from the SolFoundry platform."""
    event_type: EventType
    bounty_id: str
    bounty_title: str
    bounty_url: str
    reward: Optional[str] = None
    tier: Optional[str] = None
    changed_by: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DigestEmail(BaseModel):
    """Daily/weekly digest containing multiple events."""
    user_id: str
    email: EmailStr
    events: list[BountyEvent]
    frequency: DigestFrequency
    digest_date: str  # ISO date string


class EmailTemplate(BaseModel):
    """An HTML email template configuration."""
    name: str
    subject_template: str
    html_template: str
    event_type: EventType