"""FastAPI routes for the email notification service."""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from .config import settings
from .email_service import email_service
from .models import (
    BountyEvent,
    DeliveryStatus,
    DigestFrequency,
    EventType,
    UserPreference,
    UserPreferenceUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# In-memory stores (replace with Redis/DB in production)
_user_preferences: dict[str, UserPreference] = {}
_delivery_log: list[DeliveryStatus] = []


def _get_user_pref(user_id: str) -> Optional[UserPreference]:
    """Get user preferences from in-memory store."""
    return _user_preferences.get(user_id)


def _save_user_pref(pref: UserPreference) -> None:
    """Save user preferences to in-memory store."""
    pref.updated_at = datetime.utcnow()
    _user_preferences[pref.user_id] = pref


# ── User Preference Endpoints ──


@router.get("/preferences/{user_id}", response_model=UserPreference)
async def get_preferences(user_id: str):
    """Get email notification preferences for a user."""
    pref = _get_user_pref(user_id)
    if not pref:
        # Return empty prefs — user hasn't set any yet
        return UserPreference(user_id=user_id, email="placeholder@example.com", subscribed_events=[])
    return pref


@router.put("/preferences/{user_id}", response_model=UserPreference)
async def update_preferences(
    user_id: str,
    update: UserPreferenceUpdate,
):
    """Create or update email notification preferences."""
    existing = _get_user_pref(user_id)

    if existing:
        # Update existing
        update_data = update.model_dump(exclude_unset=True) if hasattr(update, 'model_dump') else update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)
        _save_user_pref(existing)
        return existing

    # Create new
    if not update.email:
        raise HTTPException(status_code=400, detail="Email is required for new preferences")

    pref = UserPreference(
        user_id=user_id,
        email=update.email,
        digest_frequency=update.digest_frequency or DigestFrequency.INSTANT,
        subscribed_events=update.subscribed_events or list(EventType),
        max_daily_emails=update.max_daily_emails or 20,
    )
    _save_user_pref(pref)
    return pref


@router.delete("/preferences/{user_id}", status_code=204)
async def delete_preferences(user_id: str):
    """Delete email notification preferences (opt-out)."""
    _user_preferences.pop(user_id, None)
    return None


# ── Notification Endpoints ──


@router.post("/send", response_model=DeliveryStatus)
async def send_notification(event: BountyEvent):
    """Send a notification for a bounty event.

    This endpoint is called by the SolFoundry backend when a bounty event occurs.
    """
    # Find users who subscribed to this event type
    recipients = [
        pref
        for pref in _user_preferences.values()
        if pref.active and event.event_type in pref.subscribed_events
    ]

    if not recipients:
        logger.info("No recipients for event %s on bounty %s", event.event_type, event.bounty_id)
        return DeliveryStatus(
            notification_id=str(uuid.uuid4()),
            status="sent",
            sent_at=datetime.utcnow(),
            error="No recipients",
        )

    template_vars = {
        "bounty_title": event.bounty_title,
        "bounty_url": event.bounty_url,
        "reward": event.reward or "TBD",
        "tier": event.tier or "T1",
        "bounty_description": f"Bounty #{event.bounty_id}",
        "changed_by": event.changed_by,
    }

    last_status = None
    for recipient in recipients:
        status = email_service.send_bounty_notification(
            to_email=recipient.email,
            event_type=event.event_type.value,
            template_vars=template_vars,
        )
        _delivery_log.append(status)
        last_status = status

    return last_status or DeliveryStatus(
        notification_id=str(uuid.uuid4()),
        status="failed",
        error="No recipients processed",
    )


@router.post("/send-digest", response_model=DeliveryStatus)
async def send_digest(
    frequency: DigestFrequency = Query(DigestFrequency.DAILY, description="Digest frequency"),
    force: bool = Query(False, description="Force send even if user has digest disabled"),
):
    """Send digest emails to all users with matching preferences.

    This endpoint should be called by a cron job on a schedule.
    """
    digest_date = datetime.utcnow().strftime("%Y-%m-%d")

    recipients = [
        pref
        for pref in _user_preferences.values()
        if pref.active
        and (force or pref.digest_frequency == frequency)
        and pref.digest_frequency != DigestFrequency.INSTANT
    ]

    if not recipients:
        logger.info("No recipients for %s digest", frequency.value)
        return DeliveryStatus(
            notification_id=str(uuid.uuid4()),
            status="sent",
            sent_at=datetime.utcnow(),
            error="No recipients",
        )

    last_status = None
    for recipient in recipients:
        # In production, fetch real events from the API
        sample_events = [
            {
                "event_type": "bounty_posted",
                "bounty_title": "Sample Bounty",
                "bounty_url": "https://solfoundry.org/bounties/1",
                "reward": "100K $FNDRY",
                "tier": "T1",
            }
        ]

        status = email_service.send_digest(
            to_email=recipient.email,
            events=sample_events,
            frequency=frequency.value,
            digest_date=digest_date,
        )
        _delivery_log.append(status)
        last_status = status

    return last_status or DeliveryStatus(
        notification_id=str(uuid.uuid4()),
        status="failed",
        error="No recipients processed",
    )


# ── Health & Admin Endpoints ──


@router.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.service_name,
        "smtp_configured": bool(settings.smtp_host and settings.smtp_user),
    }


@router.get("/stats")
async def stats():
    """Get notification service statistics."""
    total_sent = sum(1 for d in _delivery_log if d.status == "sent")
    total_failed = sum(1 for d in _delivery_log if d.status == "failed")
    total_bounced = sum(1 for d in _delivery_log if d.status == "bounced")
    active_users = sum(1 for p in _user_preferences.values() if p.active)

    return {
        "total_sent": total_sent,
        "total_failed": total_failed,
        "total_bounced": total_bounced,
        "active_users": active_users,
        "total_users": len(_user_preferences),
    }


@router.get("/delivery-log", response_model=list[DeliveryStatus])
async def get_delivery_log(limit: int = Query(50, ge=1, le=200)):
    """Get recent delivery log entries."""
    return _delivery_log[-limit:]