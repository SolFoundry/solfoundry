"""Webhook dispatch service for contributor event notifications.

Delivers HMAC-SHA256 signed JSON payloads to registered webhook endpoints
with exponential back-off retry logic.

Retry policy:
    Attempt 1: immediate
    Attempt 2: +2 seconds
    Attempt 3: +4 seconds

Failure handling:
    - Network errors and non-2xx responses trigger retries.
    - All failures are logged; dispatch never raises to callers.
    - The dispatcher creates its own database session so it can safely
      be invoked fire-and-forget via asyncio.create_task() — it does
      NOT inherit the request session, preventing use-after-close bugs.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.models.contributor_webhook import WebhookEventType

logger = logging.getLogger(__name__)

_RETRY_DELAYS: tuple[int, ...] = (0, 2, 4)
_REQUEST_TIMEOUT: float = 10.0


def _build_payload(
    event: WebhookEventType,
    bounty_id: str,
    data: dict[str, Any],
) -> bytes:
    """Serialise an event payload to canonical JSON bytes (sorted keys)."""
    body = {
        "event": event.value,
        "bounty_id": bounty_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    return json.dumps(body, sort_keys=True, ensure_ascii=True).encode()


def sign_payload(raw_secret: str, payload_bytes: bytes) -> str:
    """Compute HMAC-SHA256 hex signature over the payload.

    Args:
        raw_secret: The decrypted webhook signing secret.
        payload_bytes: The canonical JSON payload bytes.

    Returns:
        Hex-encoded HMAC-SHA256 digest.
    """
    return hmac.new(
        raw_secret.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()


async def _attempt_delivery(
    client: httpx.AsyncClient,
    url: str,
    webhook_id: str,
    payload_bytes: bytes,
    signature: str,
) -> bool:
    """Send one HTTP POST attempt.

    Returns True on 2xx, False otherwise.
    """
    try:
        response = await client.post(
            url,
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Signature": signature,
                "X-Webhook-Event": "webhook",
                "User-Agent": "SolFoundry-Webhooks/1.0",
            },
            timeout=_REQUEST_TIMEOUT,
        )
        if 200 <= response.status_code < 300:
            return True
        logger.warning(
            "Webhook delivery non-2xx: id=%s url=%s status=%d",
            webhook_id,
            url,
            response.status_code,
        )
        return False
    except httpx.TransportError as exc:
        logger.warning(
            "Webhook delivery network error: id=%s url=%s error=%s",
            webhook_id,
            url,
            exc,
        )
        return False
    except Exception as exc:
        logger.error(
            "Webhook delivery unexpected error: id=%s url=%s error=%s",
            webhook_id,
            url,
            exc,
        )
        return False


async def _deliver_with_retry(
    webhook_id: str,
    url: str,
    secret_encrypted: str,
    payload_bytes: bytes,
) -> None:
    """Deliver payload to a single webhook with exponential back-off."""
    from app.services.contributor_webhook_service import decrypt_secret

    raw_secret = decrypt_secret(secret_encrypted)
    signature = sign_payload(raw_secret, payload_bytes)

    async with httpx.AsyncClient() as client:
        for attempt, delay in enumerate(_RETRY_DELAYS, start=1):
            if delay > 0:
                await asyncio.sleep(delay)

            success = await _attempt_delivery(
                client, url, webhook_id, payload_bytes, signature
            )
            if success:
                logger.info(
                    "Webhook delivered: id=%s url=%s attempt=%d",
                    webhook_id,
                    url,
                    attempt,
                )
                return

            if attempt < len(_RETRY_DELAYS):
                logger.info(
                    "Webhook retry scheduled: id=%s attempt=%d next_delay=%ds",
                    webhook_id,
                    attempt,
                    _RETRY_DELAYS[attempt],
                )

    logger.error(
        "Webhook delivery failed after %d attempts: id=%s url=%s",
        len(_RETRY_DELAYS),
        webhook_id,
        url,
    )


async def dispatch_event(
    event: WebhookEventType,
    bounty_id: str,
    user_id: str,
    data: dict[str, Any],
) -> None:
    """Entry point for fire-and-forget dispatch via asyncio.create_task().

    Creates its own database session to avoid request-session lifecycle
    conflicts. Fetches active webhooks for `user_id` and delivers
    concurrently with per-webhook exponential-backoff retry.

    Args:
        event: The lifecycle event type.
        bounty_id: The affected bounty UUID string.
        user_id: The user whose webhooks should be notified.
        data: Contextual event data included in the payload body.
    """
    from app.database import get_db_session
    from app.services.contributor_webhook_service import ContributorWebhookService

    try:
        async with get_db_session() as db:
            svc = ContributorWebhookService(db)
            webhooks = await svc.get_active_webhooks_for_user(user_id)
            # Extract all needed attributes before closing session
            webhook_specs = [
                (str(wh.id), wh.url, wh.secret_encrypted) for wh in webhooks
            ]
    except Exception as exc:
        logger.error(
            "Failed to fetch webhooks for dispatch: user=%s event=%s error=%s",
            user_id,
            event.value,
            exc,
        )
        return

    if not webhook_specs:
        return

    payload_bytes = _build_payload(event, bounty_id, data)

    await asyncio.gather(
        *(
            _deliver_with_retry(wh_id, url, secret_enc, payload_bytes)
            for wh_id, url, secret_enc in webhook_specs
        ),
        return_exceptions=True,
    )
