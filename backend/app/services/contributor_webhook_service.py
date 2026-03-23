"""Outbound contributor webhook dispatch service.

Handles:
- CRUD for webhook subscriptions (max 10 per user)
- Signing payloads with HMAC-SHA256
- Dispatching events with 3-attempt exponential backoff
- Updating delivery stats on each attempt
- Batched on-chain deliveries (5s window via ChainWebhookBatcher)
- Per-attempt delivery logging for dashboard / retry visibility
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import aiohttp
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contributor_webhook import (
    ContributorWebhookDB,
    WebhookBatchPayload,
    WebhookPayload,
    WebhookRegisterRequest,
    WebhookResponse,
)
from app.models.webhook_delivery import WebhookDeliveryAttemptDB

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


def _build_payload(
    event: str,
    bounty_id: str,
    data: dict[str, Any],
    *,
    transaction_signature: str | None = None,
    slot: int | None = None,
) -> bytes:
    """Serialise a single-event WebhookPayload to JSON bytes."""
    body = WebhookPayload(
        event=event,
        bounty_id=bounty_id,
        timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        data=data,
        transaction_signature=transaction_signature,
        slot=slot,
    )
    return body.model_dump_json(exclude_none=True).encode()


# ── service ──────────────────────────────────────────────────────────────────


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
        Delivery runs sequentially per endpoint; failures do not propagate.

        Raises ValueError if *event* is not a supported webhook event type.
        """
        from app.models.contributor_webhook import WEBHOOK_EVENTS

        if event not in WEBHOOK_EVENTS:
            raise ValueError(
                f"Unsupported webhook event: {event!r}. "
                f"Must be one of: {', '.join(WEBHOOK_EVENTS)}"
            )
        query = select(ContributorWebhookDB).where(
            ContributorWebhookDB.active.is_(True)
        )
        if user_id:
            query = query.where(ContributorWebhookDB.user_id == UUID(user_id))

        result = await self._db.execute(query)
        webhooks = result.scalars().all()

        payload_bytes = _build_payload(event, bounty_id, data)

        for wh in webhooks:
            await self._deliver_with_retry(
                wh,
                event,
                payload_bytes,
                event_types=[event],
            )

    async def dispatch_test_event(self, user_id: str) -> int:
        """POST a synthetic ``webhook.test`` event to the user's endpoints only."""
        from app.models.contributor_webhook import WEBHOOK_EVENTS

        event = "webhook.test"
        if event not in WEBHOOK_EVENTS:
            raise ValueError("webhook.test is not configured")
        result = await self._db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.user_id == UUID(user_id),
                ContributorWebhookDB.active.is_(True),
            )
        )
        webhooks = result.scalars().all()
        payload_bytes = _build_payload(
            event,
            "",
            {"message": "SolFoundry webhook connectivity test"},
        )
        for wh in webhooks:
            await self._deliver_with_retry(
                wh, event, payload_bytes, event_types=[event]
            )
        return len(webhooks)

    async def deliver_chain_batch(
        self,
        raw_events: list[dict[str, Any]],
        notify_user_id: str | None = None,
    ) -> None:
        """Deliver a batch of on-chain events (same JSON body to each subscriber)."""
        if not raw_events:
            return
        payloads = [WebhookPayload.model_validate(e) for e in raw_events]
        batch_uuid = uuid.uuid4()
        body = WebhookBatchPayload(
            batch_id=str(batch_uuid),
            timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            events=payloads,
        )
        payload_bytes = body.model_dump_json(exclude_none=True).encode()
        event_names = [p.event for p in payloads]

        query = select(ContributorWebhookDB).where(
            ContributorWebhookDB.active.is_(True)
        )
        if notify_user_id:
            query = query.where(
                ContributorWebhookDB.user_id == UUID(notify_user_id)
            )

        result = await self._db.execute(query)
        webhooks = result.scalars().all()

        for wh in webhooks:
            await self._deliver_batch_with_retry(
                wh, batch_uuid, event_names, payload_bytes
            )

    async def _deliver_batch_with_retry(
        self,
        webhook: ContributorWebhookDB,
        batch_id: UUID,
        event_types: list[str],
        payload_bytes: bytes,
    ) -> None:
        signature = _sign_payload(payload_bytes, webhook.secret)
        headers = {
            "Content-Type": "application/json",
            "X-SolFoundry-Event": "batch",
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
                            await self._log_attempt(
                                webhook.id,
                                batch_id,
                                "batch",
                                event_types,
                                attempt,
                                True,
                                resp.status,
                                None,
                            )
                            await self._record_delivery(webhook.id, success=True)
                            logger.info(
                                "Webhook batch delivered: id=%s attempt=%d status=%d",
                                webhook.id,
                                attempt,
                                resp.status,
                            )
                            return
                        last_exc = RuntimeError(
                            f"HTTP {resp.status} from {webhook.url}"
                        )
                        await self._log_attempt(
                            webhook.id,
                            batch_id,
                            "batch",
                            event_types,
                            attempt,
                            False,
                            resp.status,
                            str(last_exc),
                        )
                        logger.warning(
                            "Webhook batch non-2xx: id=%s attempt=%d status=%d",
                            webhook.id,
                            attempt,
                            resp.status,
                        )
            except Exception as exc:
                last_exc = exc
                await self._log_attempt(
                    webhook.id,
                    batch_id,
                    "batch",
                    event_types,
                    attempt,
                    False,
                    None,
                    str(exc),
                )
                logger.warning(
                    "Webhook batch error: id=%s attempt=%d error=%s",
                    webhook.id,
                    attempt,
                    exc,
                )

            if attempt < MAX_ATTEMPTS:
                delay = BACKOFF_BASE_SECONDS**attempt
                await asyncio.sleep(delay)

        await self._record_delivery(webhook.id, success=False)
        logger.error(
            "Webhook batch failed after %d attempts: id=%s error=%s",
            MAX_ATTEMPTS,
            webhook.id,
            last_exc,
        )

    async def _deliver_with_retry(
        self,
        webhook: ContributorWebhookDB,
        event: str,
        payload_bytes: bytes,
        *,
        event_types: list[str],
        delivery_mode: str = "single",
        batch_id: UUID | None = None,
    ) -> None:
        """Attempt delivery up to MAX_ATTEMPTS with exponential backoff."""
        signature = _sign_payload(payload_bytes, webhook.secret)
        headers = {
            "Content-Type": "application/json",
            "X-SolFoundry-Event": event,
            "X-SolFoundry-Signature": signature,
            "User-Agent": "SolFoundry-Webhooks/1.0",
        }

        logical_batch_id = batch_id or uuid.uuid4()
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
                            await self._log_attempt(
                                webhook.id,
                                logical_batch_id,
                                delivery_mode,
                                event_types,
                                attempt,
                                True,
                                resp.status,
                                None,
                            )
                            await self._record_delivery(webhook.id, success=True)
                            logger.info(
                                "Webhook delivered: id=%s event=%s attempt=%d status=%d",
                                webhook.id,
                                event,
                                attempt,
                                resp.status,
                            )
                            return
                        last_exc = RuntimeError(
                            f"HTTP {resp.status} from {webhook.url}"
                        )
                        await self._log_attempt(
                            webhook.id,
                            logical_batch_id,
                            delivery_mode,
                            event_types,
                            attempt,
                            False,
                            resp.status,
                            str(last_exc),
                        )
                        logger.warning(
                            "Webhook delivery non-2xx: id=%s event=%s attempt=%d status=%d",
                            webhook.id,
                            event,
                            attempt,
                            resp.status,
                        )
            except Exception as exc:
                last_exc = exc
                await self._log_attempt(
                    webhook.id,
                    logical_batch_id,
                    delivery_mode,
                    event_types,
                    attempt,
                    False,
                    None,
                    str(exc),
                )
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

        await self._record_delivery(webhook.id, success=False)
        logger.error(
            "Webhook delivery failed after %d attempts: id=%s event=%s error=%s",
            MAX_ATTEMPTS,
            webhook.id,
            event,
            last_exc,
        )

    async def _log_attempt(
        self,
        webhook_id: UUID,
        batch_id: UUID | None,
        delivery_mode: str,
        event_types: list[str],
        attempt_number: int,
        success: bool,
        http_status: int | None,
        error_message: str | None,
    ) -> None:
        row = WebhookDeliveryAttemptDB(
            webhook_id=webhook_id,
            batch_id=batch_id,
            delivery_mode=delivery_mode,
            event_types=event_types,
            attempt_number=attempt_number,
            success=success,
            http_status=http_status,
            error_message=error_message,
        )
        self._db.add(row)
        await self._db.commit()

    async def _record_delivery(self, webhook_id: UUID, *, success: bool) -> None:
        """Update last_delivery stats; increment failure_count on failure."""
        values: dict[str, Any] = {
            "last_delivery_at": datetime.now(timezone.utc),
            "last_delivery_status": "success" if success else "failed",
        }
        if not success:
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

    async def delivery_dashboard(self, user_id: str, *, period_days: int = 7) -> dict:
        """Aggregate delivery stats and recent attempts for dashboard UI."""
        uid = UUID(user_id)
        cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)

        wh_result = await self._db.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.user_id == uid,
                ContributorWebhookDB.active.is_(True),
            )
        )
        active_webhooks = wh_result.scalars().all()

        if not active_webhooks:
            return {
                "period_days": period_days,
                "total_attempts": 0,
                "successful_attempts": 0,
                "failure_rate": 0.0,
                "active_webhooks": 0,
                "last_webhook_status": None,
                "recent_attempts": [],
            }

        wh_ids = [w.id for w in active_webhooks]
        url_by_id = {w.id: w.url for w in active_webhooks}
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        sorted_by_delivery = sorted(
            active_webhooks,
            key=lambda w: w.last_delivery_at or epoch,
            reverse=True,
        )
        last_webhook_status = (
            sorted_by_delivery[0].last_delivery_status if sorted_by_delivery else None
        )

        cnt_result = await self._db.execute(
            select(func.count())
            .select_from(WebhookDeliveryAttemptDB)
            .where(
                WebhookDeliveryAttemptDB.webhook_id.in_(wh_ids),
                WebhookDeliveryAttemptDB.created_at >= cutoff,
            )
        )
        total_attempts = int(cnt_result.scalar_one() or 0)

        ok_result = await self._db.execute(
            select(func.count())
            .select_from(WebhookDeliveryAttemptDB)
            .where(
                WebhookDeliveryAttemptDB.webhook_id.in_(wh_ids),
                WebhookDeliveryAttemptDB.created_at >= cutoff,
                WebhookDeliveryAttemptDB.success.is_(True),
            )
        )
        successful_attempts = int(ok_result.scalar_one() or 0)

        failure_rate = (
            1.0 - (successful_attempts / total_attempts)
            if total_attempts
            else 0.0
        )

        recent_result = await self._db.execute(
            select(WebhookDeliveryAttemptDB)
            .where(WebhookDeliveryAttemptDB.webhook_id.in_(wh_ids))
            .order_by(WebhookDeliveryAttemptDB.created_at.desc())
            .limit(30)
        )
        recent_rows = recent_result.scalars().all()
        recent_attempts = []
        for r in recent_rows:
            evts = r.event_types if isinstance(r.event_types, list) else []
            recent_attempts.append(
                {
                    "id": str(r.id),
                    "webhook_id": str(r.webhook_id),
                    "webhook_url": url_by_id.get(r.webhook_id, ""),
                    "batch_id": str(r.batch_id) if r.batch_id else None,
                    "delivery_mode": r.delivery_mode,
                    "event_types": evts,
                    "attempt_number": r.attempt_number,
                    "success": r.success,
                    "http_status": r.http_status,
                    "error_message": r.error_message,
                    "created_at": r.created_at,
                }
            )

        return {
            "period_days": period_days,
            "total_attempts": total_attempts,
            "successful_attempts": successful_attempts,
            "failure_rate": round(failure_rate, 4),
            "active_webhooks": len(active_webhooks),
            "last_webhook_status": last_webhook_status,
            "recent_attempts": recent_attempts,
        }

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
