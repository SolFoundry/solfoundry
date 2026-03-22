"""Outbound contributor webhook dispatch service.

Handles:
- CRUD for webhook subscriptions (max 10 per user)
- Signing payloads with HMAC-SHA256
- Dispatching events with 3-attempt exponential backoff
- Updating delivery stats on each attempt
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import aiohttp
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contributor_webhook import (
    ContributorWebhookDB,
    WebhookPayload,
    WebhookRegisterRequest,
    WebhookResponse,
)

logger = logging.getLogger(__name__)

MAX_WEBHOOKS_PER_USER = 10
DISPATCH_TIMEOUT_SECONDS = 10
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 2  # delays: 2s, 4s, 8s


class WebhookLimitExceededError(Exception):
    """Raised when a user exceeds MAX_WEBHOOKS_PER_USER."""


class WebhookNotFoundError(Exception):
    """Raised when a webhook is not found or doesn't belong to the user."""


# ── helpers ────────────────────────────────────────────────────────────────────


def _sign_payload(payload_bytes: bytes, secret: str) -> str:
    """Return ``sha256=<hex>`` HMAC-SHA256 signature."""
    sig = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def _build_payload(event: str, bounty_id: str, data: dict[str, Any]) -> bytes:
    """Serialise a WebhookPayload to JSON bytes."""
    body = WebhookPayload(
        event=event,
        bounty_id=bounty_id,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data=data,
    )
    return body.model_dump_json().encode()


# ── service ────────────────────────────────────────────────────────────────────


class ContributorWebhookService:
    """CRUD and dispatch for outbound contributor webhooks."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ── registration ──────────────────────────────────────────────────────────

    async def register(
        self, user_id: str, req: WebhookRegisterRequest
    ) -> WebhookResponse:
        """Register a new webhook URL for the authenticated user."""
        count_result = await self._db.execute(
            select(func.count())
            .select_from(ContributorWebhookDB)
            .where(
                ContributorWebhookDB.user_id == UUID(user_id),
                ContributorWebhookDB.active.is_(True),
            )
        )
        count = count_result.scalar_one()
        if count >= MAX_WEBHOOKS_PER_USER:
            raise WebhookLimitExceededError(
                f"Maximum {MAX_WEBHOOKS_PER_USER} active webhooks per user"
            )

        record = ContributorWebhookDB(
            user_id=UUID(user_id),
            url=str(req.url),
            secret=req.secret,
        )
        self._db.add(record)
        await self._db.commit()
        await self._db.refresh(record)
        logger.info("Webhook registered: id=%s user=%s", record.id, user_id)
        return self._to_response(record)

    # ── unregister ────────────────────────────────────────────────────────────

    async def unregister(self, user_id: str, webhook_id: str) -> None:
        """Soft-delete a webhook (set active=False)."""
        result = await self._db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.id == UUID(webhook_id),
                ContributorWebhookDB.user_id == UUID(user_id),
                ContributorWebhookDB.active.is_(True),
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            raise WebhookNotFoundError(webhook_id)
        record.active = False
        await self._db.commit()
        logger.info("Webhook unregistered: id=%s user=%s", webhook_id, user_id)

    # ── list ──────────────────────────────────────────────────────────────────

    async def list_for_user(self, user_id: str) -> list[WebhookResponse]:
        """Return all active webhooks owned by the user."""
        result = await self._db.execute(
            select(ContributorWebhookDB)
            .where(
                ContributorWebhookDB.user_id == UUID(user_id),
                ContributorWebhookDB.active.is_(True),
            )
            .order_by(ContributorWebhookDB.created_at.desc())
        )
        return [self._to_response(r) for r in result.scalars().all()]

    # ── dispatch ──────────────────────────────────────────────────────────────

    async def dispatch_event(
        self,
        event: str,
        bounty_id: str,
        data: dict[str, Any],
        user_id: str | None = None,
    ) -> None:
        """Dispatch an event to all matching active webhooks.

        If *user_id* is given, only that user's webhooks are notified.
        Delivery runs in the background and failures do not propagate.
        """
        query = select(ContributorWebhookDB).where(
            ContributorWebhookDB.active.is_(True)
        )
        if user_id:
            query = query.where(ContributorWebhookDB.user_id == UUID(user_id))

        result = await self._db.execute(query)
        webhooks = result.scalars().all()

        payload_bytes = _build_payload(event, bounty_id, data)

        tasks = [self._deliver_with_retry(wh, event, payload_bytes) for wh in webhooks]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_with_retry(
        self,
        webhook: ContributorWebhookDB,
        event: str,
        payload_bytes: bytes,
    ) -> None:
        """Attempt delivery up to MAX_ATTEMPTS with exponential backoff."""
        signature = _sign_payload(payload_bytes, webhook.secret)
        headers = {
            "Content-Type": "application/json",
            "X-SolFoundry-Event": event,
            "X-SolFoundry-Signature": signature,
            "User-Agent": "SolFoundry-Webhooks/1.0",
        }

        last_exc: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        webhook.url,
                        data=payload_bytes,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=DISPATCH_TIMEOUT_SECONDS),
                    ) as resp:
                        if 200 <= resp.status < 300:
                            await self._record_delivery(webhook.id, success=True)
                            logger.info(
                                "Webhook delivered: id=%s event=%s attempt=%d status=%d",
                                webhook.id,
                                event,
                                attempt,
                                resp.status,
                            )
                            return
                        # Non-2xx is a retriable failure
                        last_exc = RuntimeError(
                            f"HTTP {resp.status} from {webhook.url}"
                        )
                        logger.warning(
                            "Webhook delivery non-2xx: id=%s event=%s attempt=%d status=%d",
                            webhook.id,
                            event,
                            attempt,
                            resp.status,
                        )
            except Exception as exc:  # network errors, timeouts, etc.
                last_exc = exc
                logger.warning(
                    "Webhook delivery error: id=%s event=%s attempt=%d error=%s",
                    webhook.id,
                    event,
                    attempt,
                    exc,
                )

            if attempt < MAX_ATTEMPTS:
                delay = BACKOFF_BASE_SECONDS**attempt
                await asyncio.sleep(delay)

        # All attempts exhausted
        await self._record_delivery(webhook.id, success=False)
        logger.error(
            "Webhook delivery failed after %d attempts: id=%s event=%s error=%s",
            MAX_ATTEMPTS,
            webhook.id,
            event,
            last_exc,
        )

    async def _record_delivery(self, webhook_id: UUID, *, success: bool) -> None:
        """Update last_delivery stats; increment failure_count on failure."""
        values: dict[str, Any] = {
            "last_delivery_at": datetime.now(timezone.utc),
            "last_delivery_status": "success" if success else "failed",
        }
        if not success:
            # Increment via SQL expression to avoid race conditions

            await self._db.execute(
                update(ContributorWebhookDB)
                .where(ContributorWebhookDB.id == webhook_id)
                .values(
                    last_delivery_at=values["last_delivery_at"],
                    last_delivery_status=values["last_delivery_status"],
                    failure_count=ContributorWebhookDB.failure_count + 1,
                )
            )
        else:
            await self._db.execute(
                update(ContributorWebhookDB)
                .where(ContributorWebhookDB.id == webhook_id)
                .values(**values)
            )
        await self._db.commit()

    # ── internal ──────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(record: ContributorWebhookDB) -> WebhookResponse:
        return WebhookResponse(
            id=str(record.id),
            url=record.url,
            active=record.active,
            created_at=record.created_at,
            last_delivery_at=record.last_delivery_at,
            last_delivery_status=record.last_delivery_status,
            failure_count=record.failure_count,
        )
