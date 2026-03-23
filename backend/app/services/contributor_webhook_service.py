"""Service layer for contributor webhook management and dispatch.

Handles registration, listing, deletion, and event dispatch for
contributor webhooks. Outbound payloads are signed with HMAC-SHA256
so recipients can verify authenticity.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contributor_webhook import (
    ContributorWebhookCreate,
    ContributorWebhookDB,
    ContributorWebhookList,
    ContributorWebhookRegistrationResponse,
    ContributorWebhookResponse,
)

logger = logging.getLogger(__name__)

# Supported event types
VALID_EVENTS = frozenset(
    {
        "bounty.claimed",
        "review.started",
        "review.passed",
        "review.failed",
        "bounty.paid",
    }
)

# Maximum webhooks a single user may register
MAX_WEBHOOKS_PER_USER = 10

# Retry schedule in seconds — only applied for transient (5xx / network) errors
RETRY_DELAYS = (1, 2, 4)


class ContributorWebhookService:
    """Provides all business logic for contributor webhooks.

    Args:
        db: An async SQLAlchemy session bound to the current request.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialise the service with a database session.

        Args:
            db: Async SQLAlchemy session.
        """
        self._db = db

    # ------------------------------------------------------------------
    # Public CRUD methods
    # ------------------------------------------------------------------

    async def register_webhook(
        self,
        user_id: str,
        payload: ContributorWebhookCreate,
    ) -> ContributorWebhookRegistrationResponse:
        """Register a new webhook for the given user.

        Generates a cryptographically random 32-byte secret (64 hex chars)
        that the caller can use to verify HMAC-SHA256 signatures. The
        secret is returned **only once** in this response and is never
        surfaced again.

        Args:
            user_id: The authenticated user's identifier.
            payload: Validated registration data (HTTPS URL + optional event filter).

        Returns:
            ContributorWebhookRegistrationResponse: The newly created webhook
                including the one-time HMAC secret.

        Raises:
            HTTPException 400: If any supplied event name is invalid.
            HTTPException 429: If the user already has 10 webhooks.
        """
        # Validate event names when an explicit list is provided
        if payload.events is not None:
            invalid = set(payload.events) - VALID_EVENTS
            if invalid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown event type(s): {', '.join(sorted(invalid))}. "
                    f"Valid events: {', '.join(sorted(VALID_EVENTS))}",
                )

        # Enforce per-user quota
        existing = await self._db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.user_id == user_id,
                ContributorWebhookDB.active == True,  # noqa: E712
            )
        )
        count = len(existing.scalars().all())
        if count >= MAX_WEBHOOKS_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Webhook limit reached ({MAX_WEBHOOKS_PER_USER} max per user). "
                "Delete an existing webhook before registering a new one.",
            )

        secret = secrets.token_hex(32)  # 32 bytes → 64 hex chars

        webhook = ContributorWebhookDB(
            user_id=user_id,
            url=str(payload.url),
            secret=secret,
            events=payload.events,
            active=True,
            created_at=datetime.now(timezone.utc),
        )
        self._db.add(webhook)
        await self._db.commit()
        await self._db.refresh(webhook)

        return ContributorWebhookRegistrationResponse(
            id=str(webhook.id),
            url=webhook.url,
            events=webhook.events,
            active=webhook.active,
            created_at=webhook.created_at,
            secret=secret,
        )

    async def list_webhooks(self, user_id: str) -> ContributorWebhookList:
        """Return all active webhooks belonging to the given user.

        Args:
            user_id: The authenticated user's identifier.

        Returns:
            ContributorWebhookList: Wrapper with webhook list and total count.
        """
        result = await self._db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.user_id == user_id,
                ContributorWebhookDB.active == True,  # noqa: E712
            )
        )
        rows = result.scalars().all()
        responses = [self._to_response(r) for r in rows]
        return ContributorWebhookList(webhooks=responses, total=len(responses))

    async def delete_webhook(self, user_id: str, webhook_id: str) -> None:
        """Deactivate a webhook owned by the given user.

        Args:
            user_id: The authenticated user's identifier.
            webhook_id: UUID string of the webhook to remove.

        Raises:
            HTTPException 404: If the webhook does not exist or is owned by
                another user (ownership info is intentionally not disclosed).
        """
        result = await self._db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.id == webhook_id,
            )
        )
        webhook = result.scalar_one_or_none()

        if webhook is None or webhook.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook not found",
            )

        webhook.active = False
        await self._db.commit()

    # ------------------------------------------------------------------
    # Event dispatch
    # ------------------------------------------------------------------

    @staticmethod
    async def dispatch_event(
        event_type: str,
        bounty_id: str,
        data: Dict[str, Any],
        db: AsyncSession,
    ) -> None:
        """Find all active webhooks subscribed to *event_type* and deliver.

        Delivery to all matching endpoints is performed concurrently via
        ``asyncio.gather``. Each individual delivery is attempted up to
        three times with exponential back-off (1 s, 2 s, 4 s) **only for
        transient 5xx or network errors**. Client errors (4xx) are treated
        as permanent failures and are not retried. Failures after all retries
        are logged as warnings and do not propagate to the caller.

        Args:
            event_type: One of the VALID_EVENTS strings (e.g. "bounty.claimed").
            bounty_id: UUID string of the associated bounty.
            data: Arbitrary extra data included in the payload.
            db: Async SQLAlchemy session used only for the SELECT query.
        """
        result = await db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.active == True  # noqa: E712
            )
        )
        all_webhooks = result.scalars().all()

        # Filter to webhooks that care about this event
        targets = [
            wh
            for wh in all_webhooks
            if wh.events is None or event_type in wh.events
        ]

        if not targets:
            return

        timestamp = datetime.now(timezone.utc).isoformat()
        raw_payload: Dict[str, Any] = {
            "event": event_type,
            "bounty_id": str(bounty_id),
            "timestamp": timestamp,
            "data": data,
        }
        payload_bytes = json.dumps(raw_payload, separators=(",", ":")).encode("utf-8")

        async with httpx.AsyncClient(timeout=10.0) as client:
            tasks = []
            for webhook in targets:
                signature = ContributorWebhookService._sign_payload(
                    payload_bytes, webhook.secret
                )
                headers = {
                    "Content-Type": "application/json",
                    "X-SolFoundry-Signature": signature,
                    "X-SolFoundry-Event": event_type,
                }
                tasks.append(
                    ContributorWebhookService._deliver_with_retry(
                        client=client,
                        url=webhook.url,
                        payload_bytes=payload_bytes,
                        headers=headers,
                        webhook_id=str(webhook.id),
                    )
                )

            # Deliver to all endpoints concurrently; errors are caught per-task
            await asyncio.gather(*tasks, return_exceptions=True)

    @staticmethod
    async def _deliver_with_retry(
        client: httpx.AsyncClient,
        url: str,
        payload_bytes: bytes,
        headers: Dict[str, str],
        webhook_id: str,
    ) -> None:
        """Attempt delivery with retries and exponential back-off.

        Retry policy:
        - **5xx responses and network errors**: retried up to 3 times with
          delays of 1 s, 2 s, and 4 s.
        - **4xx responses**: treated as permanent client errors; no retries.
        - **2xx / 3xx responses**: treated as successful delivery.

        Args:
            client: Shared httpx async client.
            url: Destination URL.
            payload_bytes: JSON-encoded payload to POST.
            headers: HTTP headers including the HMAC signature.
            webhook_id: Identifier used in log messages.
        """
        last_error: Optional[Exception] = None

        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                response = await client.post(url, content=payload_bytes, headers=headers)

                if response.status_code < 400:
                    # 2xx / 3xx — successful delivery
                    return

                if 400 <= response.status_code < 500:
                    # 4xx — permanent client error; do not retry
                    logger.warning(
                        "Webhook delivery for %s got permanent client error %d; "
                        "aborting retries",
                        webhook_id,
                        response.status_code,
                    )
                    return

                # 5xx — transient server error; eligible for retry
                last_error = Exception(
                    f"HTTP {response.status_code} from {url}"
                )

            except Exception as exc:
                # Network-level failure (timeout, connection refused, etc.)
                last_error = exc

            if attempt < len(RETRY_DELAYS):
                await asyncio.sleep(delay)

        logger.warning(
            "Webhook delivery failed after %d attempts for webhook %s: %s",
            len(RETRY_DELAYS),
            webhook_id,
            last_error,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _sign_payload(payload_bytes: bytes, secret: str) -> str:
        """Compute HMAC-SHA256 signature for a payload.

        The returned value is suitable for use in the
        ``X-SolFoundry-Signature`` HTTP header.

        Args:
            payload_bytes: Raw JSON bytes to sign.
            secret: The per-webhook hex secret.

        Returns:
            str: Signature in the form ``sha256=<hexdigest>``.
        """
        digest = hmac.new(
            secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()
        return f"sha256={digest}"

    @staticmethod
    def _to_response(webhook: ContributorWebhookDB) -> ContributorWebhookResponse:
        """Convert a DB row to the public response schema (no secret).

        Args:
            webhook: SQLAlchemy model instance.

        Returns:
            ContributorWebhookResponse: Serialisable response without the secret.
        """
        return ContributorWebhookResponse(
            id=str(webhook.id),
            url=webhook.url,
            events=webhook.events,
            active=webhook.active,
            created_at=webhook.created_at,
        )
