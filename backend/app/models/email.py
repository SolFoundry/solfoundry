"""Pydantic models for the email notification domain."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr


class NotificationFrequency(str, Enum):
    instant = "instant"
    daily = "daily"
    weekly = "weekly"
    off = "off"


class NotificationType(str, Enum):
    new_bounty = "new_bounty"
    status_update = "status_update"
    payout = "payout"


class PreferenceUpdate(BaseModel):
    """Payload for updating a user's notification preferences."""

    email: EmailStr | None = None
    frequency: NotificationFrequency = NotificationFrequency.instant
    notify_new_bounty: bool = True
    notify_status_update: bool = True
    notify_payout: bool = True
    digest_day: str | None = None  # e.g. "mon"


class PreferenceResponse(BaseModel):
    email: EmailStr | None
    frequency: NotificationFrequency
    notify_new_bounty: bool
    notify_status_update: bool
    notify_payout: bool
    digest_day: str | None
    updated_at: datetime | None


class SendNotificationRequest(BaseModel):
    """Payload for the admin/test endpoint that triggers a notification."""

    to: EmailStr
    username: str = "there"
    notification_type: NotificationType = NotificationType.new_bounty
    bounty_title: str = "Test Bounty"
    bounty_tier: str = "T2"
    reward: str = "100K FNDRY"
    status: str = "approved"
    details: str = ""
    bounty_url: str = "https://solfoundry.xyz"
    tx_url: str = "https://explorer.solana.com"
    skills: list[str] = []
    new_bounties: list[dict] = []
    completed_bounties: list[dict] = []


class DeliveryEvent(BaseModel):
    """Inbound event from the SendGrid event webhook."""

    event: str
    email: str | None = None
    sg_message_id: str | None = None
    timestamp: int | None = None
    response: str | None = None
    reason: str | None = None
    url: str | None = None
    bounce_class: int | None = None
    status: str | None = None
    custom_args: dict | None = None