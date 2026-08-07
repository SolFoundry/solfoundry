"""Notification endpoints.

GET    /api/notifications/preferences         -> preferences for a user
PUT    /api/notifications/preferences         -> update preferences
POST   /api/notifications/send                -> trigger a notification (test/admin)

The user is identified via the ``X-User-Id`` header (or the OAuth ``sub`` claim
when running behind the full auth stack).  This keeps the notification module
self-contained so it can be dropped into the backend without a hard dependency
on the auth router.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, Response

from app.email_service import email_service
from app.models.email import (
    PreferenceResponse,
    PreferenceUpdate,
    SendNotificationRequest,
)
from app.services.preference_store import preference_store

router = APIRouter()


def _user_id(x_user_id: str | None) -> str:
    return x_user_id or "anonymous"


@router.get("/preferences", response_model=PreferenceResponse)
async def get_preferences(x_user_id: str | None = Header(default=None)):
    user_id = _user_id(x_user_id)
    pref = preference_store.get(user_id)
    return PreferenceResponse(
        email=pref.get("email"),
        frequency=pref.get("frequency", "instant"),
        notify_new_bounty=pref.get("notify_new_bounty", True),
        notify_status_update=pref.get("notify_status_update", True),
        notify_payout=pref.get("notify_payout", True),
        digest_day=pref.get("digest_day"),
        updated_at=None,
    )


@router.put("/preferences", response_model=PreferenceResponse)
async def update_preferences(
    body: PreferenceUpdate, x_user_id: str | None = Header(default=None)
):
    user_id = _user_id(x_user_id)
    pref = preference_store.upsert(user_id, body)
    return PreferenceResponse(
        email=pref.get("email"),
        frequency=pref.get("frequency", "instant"),
        notify_new_bounty=pref.get("notify_new_bounty", True),
        notify_status_update=pref.get("notify_status_update", True),
        notify_payout=pref.get("notify_payout", True),
        digest_day=pref.get("digest_day"),
        updated_at=None,
    )


@router.post("/send")
async def send_notification(body: SendNotificationRequest):
    """Trigger a notification (used by the admin panel / test harness).

    In production the bounty create/update/complete flows call
    :func:`app.services.notify.notify_bounty_event` directly; this endpoint
    exists for manual testing and observability.
    """
    if body.notification_type.value == "new_bounty":
        await email_service.send_new_bounty_notification(
            to=str(body.to),
            username=body.username,
            bounty_title=body.bounty_title,
            bounty_tier=body.bounty_tier,
            reward=body.reward,
            skills=body.skills,
            bounty_url=body.bounty_url,
        )
    elif body.notification_type.value == "status_update":
        await email_service.send_status_update(
            to=str(body.to),
            username=body.username,
            bounty_title=body.bounty_title,
            status=body.status,
            details=body.details,
            bounty_url=body.bounty_url,
        )
    elif body.notification_type.value == "payout":
        await email_service.send_payout_notification(
            to=str(body.to),
            username=body.username,
            bounty_title=body.bounty_title,
            amount=body.reward,
            tx_url=body.tx_url,
        )
    else:
        await email_service.send_weekly_digest(
            to=str(body.to),
            username=body.username,
            new_bounties=body.new_bounties,
            completed_bounties=body.completed_bounties,
            bounties_url=body.bounty_url,
        )
    return Response(status_code=202)