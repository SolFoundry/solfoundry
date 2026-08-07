"""Notification orchestration — wires email sending into bounty flow events.

This is the entry point that the bounty create / update / complete flows
should call instead of constructing email payloads manually.  It handles:

- Looking up subscribers who opted into the relevant notification type.
- Respecting each user's notification frequency preference.
- Delegating to the EmailService for actual delivery.

Usage (from bounty create/update/complete flows):

    from app.services.notify import notify_bounty_event

    await notify_bounty_event(
        event_type="new_bounty",
        bounty_title="...",
        bounty_tier="T2",
        reward="100K FNDRY",
        skills=["Python", "FastAPI"],
        bounty_url="https://solfoundry.xyz/bounties/123",
    )
"""

from __future__ import annotations

import logging
from typing import Optional, Sequence

from app.email_service import email_service
from app.services.preference_store import preference_store

logger = logging.getLogger(__name__)


async def notify_bounty_event(
    event_type: str,
    bounty_title: str,
    bounty_tier: str = "T2",
    reward: str = "",
    skills: Optional[Sequence[str]] = None,
    bounty_url: str = "",
    status: str = "",
    details: str = "",
    tx_url: str = "",
    specific_user_id: Optional[str] = None,
    digest_type: str = "weekly",
    new_bounties: Optional[Sequence[dict]] = None,
    completed_bounties: Optional[Sequence[dict]] = None,
    bounties_url: str = "",
) -> int:
    """Send notifications for a bounty event to all relevant subscribers.

    Returns the number of notifications sent.
    """
    skills = skills or []
    new_bounties = new_bounties or []
    completed_bounties = completed_bounties or []

    # Determine who to notify
    if specific_user_id:
        recipients = [preference_store.get(specific_user_id)]
    else:
        recipients = preference_store.subscribers_for(event_type)

    sent = 0
    for pref in recipients:
        email = pref.get("email")
        if not email:
            continue

        user_id = pref.get("user_id", "?")
        username = pref.get("username", "there")
        frequency = pref.get("frequency", "instant")

        # Skip if user doesn't want instant notifications for non-digest events
        if event_type in ("new_bounty", "status_update", "payout") and frequency == "off":
            logger.debug("skipping %s for user %s (frequency=off)", event_type, user_id)
            continue

        tracking_id = f"{user_id}_{event_type}"

        if event_type == "new_bounty":
            ok = await email_service.send_new_bounty_notification(
                to=email,
                username=username,
                bounty_title=bounty_title,
                bounty_tier=bounty_tier,
                reward=reward,
                skills=skills,
                bounty_url=bounty_url,
                tracking_id=tracking_id,
            )
        elif event_type == "status_update":
            ok = await email_service.send_status_update(
                to=email,
                username=username,
                bounty_title=bounty_title,
                status=status,
                details=details,
                bounty_url=bounty_url,
                tracking_id=tracking_id,
            )
        elif event_type == "payout":
            ok = await email_service.send_payout_notification(
                to=email,
                username=username,
                bounty_title=bounty_title,
                amount=reward,
                tx_url=tx_url,
                tracking_id=tracking_id,
            )
        elif event_type == "digest":
            ok = await email_service.send_weekly_digest(
                to=email,
                username=username,
                new_bounties=new_bounties,
                completed_bounties=completed_bounties,
                bounties_url=bounties_url,
                digest_type=digest_type,
                tracking_id=tracking_id,
            )
        else:
            logger.warning("unknown event_type=%s for user %s", event_type, user_id)
            continue

        if ok:
            sent += 1

    logger.info("notify_bounty_event type=%s sent=%d", event_type, sent)
    return sent