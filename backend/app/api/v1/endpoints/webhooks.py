"""SendGrid inbound event webhook.

Receives delivery events (bounce, dropped, delivered, open, click) so the
system can track email delivery health.  The route is

  POST /api/webhooks/sendgrid/events

and is called by SendGrid's Event Webhook when the customer has configured
the webhook URL in the SendGrid dashboard to point to this endpoint.
"""

from __future__ import annotations

import logging
from typing import Sequence

from fastapi import APIRouter, BackgroundTasks, Request

from app.models.email import DeliveryEvent

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sendgrid/events")
async def sendgrid_event_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receive a batch of SendGrid delivery events."""
    try:
        events: Sequence[dict] = await request.json()
    except Exception:
        logger.warning("sendgrid webhook: invalid JSON body")
        return {"status": "accepted"}

    background_tasks.add_task(_process_events, events)
    return {"status": "accepted"}


def _process_events(events: Sequence[dict]) -> None:
    """Process delivery events in the background."""
    for raw in events:
        try:
            event = DeliveryEvent(**raw)
        except Exception:
            logger.debug("sendgrid webhook: skipping invalid event %s", raw)
            continue

        if event.event in ("bounce", "dropped"):
            logger.warning(
                "email %s event=%s email=%s reason=%s status=%s",
                event.sg_message_id,
                event.event,
                event.email,
                event.reason,
                event.status,
            )
        elif event.event in ("delivered", "open", "click"):
            logger.debug(
                "email %s event=%s email=%s",
                event.sg_message_id,
                event.event,
                event.email,
            )
        else:
            logger.debug("email event=%s email=%s", event.event, event.email)