"""On-chain webhook dispatch service.

Handles:
- CRUD for on-chain webhook subscriptions (max 10 per user)
- Batch delivery with HMAC-SHA256 signing
- Retry logic with exponential backoff (3 attempts)
- Delivery logging per attempt
- Dashboard stats aggregation
- Test event delivery
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import aiohttp
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.onchain_webhook import (
    ON_CHAIN_EVENT_TYPES,
    DeliveryLogEntry,
    OnChainDeliveryLogDB,
    OnChainEventBatch,
    OnChainEventPayload,
    OnChainWebhookRegisterRequest,
    OnChainWebhookResponse,
    OnChainWebhookSubscriptionDB,
    TestEventResponse,
    WebhookDashboardResponse,
)

logger = logging.getLogger(__name__)

MAX_SUBSCRIPTIONS_PER_USER = 10
DISPATCH_TIMEOUT_SECONDS = 10
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 2  # delays: 2s, 4s, 8s
DASHBOARD_LOG_LIMIT = 50


class SubscriptionLimitExceededError(Exception):
    """Raised when a user exceeds MAX_SUBSCRIPTIONS_PER_USER."""


class SubscriptionNotFoundError(Exception):
    """Raised when a subscription is not found or doesn't belong to the user."""


class UnsupportedEventTypeError(Exception):
    """Raised when an unsupported event type is requested."""


# ── helpers ────────────────────────────────────────────────────────────────────


def _sign_batch(payload_bytes: bytes, secret: str) -> str:
    """Return ``sha256=<hex>`` HMAC-SHA256 signature for a batch payload."""
    sig = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def _build_batch_payload(
    events: list[OnChainEventPayload],
    window_start: datetime,
    window_end: datetime,
) -> bytes:
    """Serialise a list of events into a signed batch JSON envelope."""
    batch = OnChainEventBatch(
        events=events,
        batch_size=len(events),
        window_start=window_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        window_end=window_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    return batch.model_dump_json().encode()


def _subscription_matches_event(sub: OnChainWebhookSubscriptionDB, event_type: str) -> bool:
    """Return True if the subscription should receive this event type."""
    if not sub.event_filter:
        return True  # subscribed to all events
    subscribed = {e.strip() for e in sub.event_filter.split(",")}
    return event_type in subscribed


# ── service ────────────────────────────────────────────────────────────────────


class OnChainWebhookService:
    """CRUD, dispatch, and dashboard for on-chain outbound webhooks."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with a database session."""
        self._db = db

    # ── registration ──────────────────────────────────────────────────────────

    async def register(
        self, user_id: str, req: OnChainWebhookRegisterRequest
    ) -> OnChainWebhookResponse:
        """Register a new on-chain webhook subscription for the user."""
        req.validate_event_types()

        count_result = await self._db.execute(
            select(func.count())
            .select_from(OnChainWebhookSubscriptionDB)
            .where(
                OnChainWebhookSubscriptionDB.user_id == UUID(user_id),
                OnChainWebhookSubscriptionDB.active.is_(True),
            )
        )
        count = count_result.scalar_one()
        if count >= MAX_SUBSCRIPTIONS_PER_USER:
            raise SubscriptionLimitExceededError(
                f"Maximum {MAX_SUBSCRIPTIONS_PER_USER} active subscriptions per user"
            )

        event_filter = (
            ",".join(sorted(set(req.event_types))) if req.event_types else None
        )

        record = OnChainWebhookSubscriptionDB(
            user_id=UUID(user_id),
            url=req.url,
            secret=req.secret,
            event_filter=event_filter,
        )
        self._db.add(record)
        await self._db.commit()
        await self._db.refresh(record)
        logger.info(
            "On-chain webhook registered: id=%s user=%s events=%s",
            record.id,
            user_id,
            event_filter or "all",
        )
        return self._to_response(record)

    # ── unregister ────────────────────────────────────────────────────────────

    async def unregister(self, user_id: str, subscription_id: str) -> None:
        """Soft-delete an on-chain webhook subscription."""
        result = await self._db.execute(
            select(OnChainWebhookSubscriptionDB).where(
                OnChainWebhookSubscriptionDB.id == UUID(subscription_id),
                OnChainWebhookSubscriptionDB.user_id == UUID(user_id),
                OnChainWebhookSubscriptionDB.active.is_(True),
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            raise SubscriptionNotFoundError(subscription_id)
        record.active = False
        await self._db.commit()
        logger.info(
            "On-chain webhook unregistered: id=%s user=%s", subscription_id, user_id
        )

    # ── list ──────────────────────────────────────────────────────────────────

    async def list_for_user(self, user_id: str) -> list[OnChainWebhookResponse]:
        """Return all active subscriptions for the user."""
        result = await self._db.execute(
            select(OnChainWebhookSubscriptionDB)
            .where(
                OnChainWebhookSubscriptionDB.user_id == UUID(user_id),
                OnChainWebhookSubscriptionDB.active.is_(True),
            )
            .order_by(OnChainWebhookSubscriptionDB.created_at.desc())
        )
        return [self._to_response(r) for r in result.scalars().all()]

    # ── batch dispatch ────────────────────────────────────────────────────────

    async def dispatch_batch(
        self,
        events: list[OnChainEventPayload],
        user_id: Optional[str] = None,
    ) -> None:
        """Dispatch a batch of on-chain events to matching active subscriptions.

        Events are grouped per-subscription and delivered in one HTTP call.
        If *user_id* is given, only that user's subscriptions are notified.
        """
        if not events:
            return

        query = select(OnChainWebhookSubscriptionDB).where(
            OnChainWebhookSubscriptionDB.active.is_(True)
        )
        if user_id:
            query = query.where(
                OnChainWebhookSubscriptionDB.user_id == UUID(user_id)
            )

        result = await self._db.execute(query)
        subscriptions = result.scalars().all()

        window_start = datetime.now(timezone.utc)
        window_end = datetime.now(timezone.utc)

        tasks = []
        for sub in subscriptions:
            # Filter events to those this subscription cares about
            matching = [
                e for e in events if _subscription_matches_event(sub, e.event)
            ]
            if matching:
                payload_bytes = _build_batch_payload(matching, window_start, window_end)
                tasks.append(
                    self._deliver_batch_with_retry(sub, matching, payload_bytes)
                )

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_batch_with_retry(
        self,
        sub: OnChainWebhookSubscriptionDB,
        events: list[OnChainEventPayload],
        payload_bytes: bytes,
    ) -> None:
        """Attempt batch delivery with exponential backoff, log each attempt."""
        signature = _sign_batch(payload_bytes, sub.secret)
        headers = {
            "Content-Type": "application/json",
            "X-SolFoundry-Event": "batch",
            "X-SolFoundry-Signature": signature,
            "X-SolFoundry-Event-Types": ",".join(sorted({e.event for e in events})),
            "User-Agent": "SolFoundry-OnChainWebhooks/1.0",
        }

        batch_id = str(uuid.uuid4())
        last_exc: Exception | None = None

        for attempt in range(1, MAX_ATTEMPTS + 1):
            t_start = time.monotonic()
            status_code: Optional[int] = None
            error_message: Optional[str] = None
            success = False

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        sub.url,
                        data=payload_bytes,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=DISPATCH_TIMEOUT_SECONDS),
                    ) as resp:
                        status_code = resp.status
                        latency_ms = int((time.monotonic() - t_start) * 1000)
                        if 200 <= resp.status < 300:
                            success = True
                            logger.info(
                                "On-chain batch delivered: sub=%s attempt=%d status=%d "
                                "events=%d latency=%dms",
                                sub.id,
                                attempt,
                                resp.status,
                                len(events),
                                latency_ms,
                            )
                        else:
                            last_exc = RuntimeError(f"HTTP {resp.status}")
                            error_message = f"HTTP {resp.status}"
                            logger.warning(
                                "On-chain batch non-2xx: sub=%s attempt=%d status=%d",
                                sub.id,
                                attempt,
                                resp.status,
                            )

            except Exception as exc:
                last_exc = exc
                latency_ms = int((time.monotonic() - t_start) * 1000)
                error_message = str(exc)[:500]
                logger.warning(
                    "On-chain batch error: sub=%s attempt=%d error=%s",
                    sub.id,
                    attempt,
                    exc,
                )

            # Log each attempt
            for event in events:
                await self._log_delivery_attempt(
                    subscription_id=sub.id,
                    batch_id=batch_id,
                    event=event,
                    attempt=attempt,
                    status_code=status_code,
                    success=success,
                    error_message=error_message,
                    latency_ms=latency_ms,
                )

            if success:
                await self._record_delivery(sub.id, success=True, count=len(events))
                return

            if attempt < MAX_ATTEMPTS:
                delay = BACKOFF_BASE_SECONDS ** attempt
                await asyncio.sleep(delay)

        # All attempts exhausted
        await self._record_delivery(sub.id, success=False, count=len(events))
        logger.error(
            "On-chain batch delivery failed after %d attempts: sub=%s error=%s",
            MAX_ATTEMPTS,
            sub.id,
            last_exc,
        )

    async def _log_delivery_attempt(
        self,
        subscription_id: UUID,
        batch_id: str,
        event: OnChainEventPayload,
        attempt: int,
        status_code: Optional[int],
        success: bool,
        error_message: Optional[str],
        latency_ms: int,
    ) -> None:
        """Insert a delivery log row for one event in the batch."""
        log_entry = OnChainDeliveryLogDB(
            subscription_id=subscription_id,
            batch_id=batch_id,
            event_type=event.event,
            tx_signature=event.tx_signature,
            attempt=attempt,
            status_code=status_code,
            success=success,
            error_message=error_message,
            latency_ms=latency_ms,
        )
        self._db.add(log_entry)
        try:
            await self._db.commit()
        except Exception as exc:
            logger.warning("Failed to log delivery attempt: %s", exc)
            await self._db.rollback()

    async def _record_delivery(
        self, subscription_id: UUID, *, success: bool, count: int = 1
    ) -> None:
        """Update delivery stats on the subscription record."""
        values: dict[str, Any] = {
            "last_delivery_at": datetime.now(timezone.utc),
            "last_delivery_status": "success" if success else "failed",
            "total_deliveries": OnChainWebhookSubscriptionDB.total_deliveries + count,
        }
        if success:
            values["success_deliveries"] = (
                OnChainWebhookSubscriptionDB.success_deliveries + count
            )
        else:
            values["failure_count"] = (
                OnChainWebhookSubscriptionDB.failure_count + 1
            )

        await self._db.execute(
            update(OnChainWebhookSubscriptionDB)
            .where(OnChainWebhookSubscriptionDB.id == subscription_id)
            .values(**values)
        )
        try:
            await self._db.commit()
        except Exception as exc:
            logger.warning("Failed to update delivery stats: %s", exc)
            await self._db.rollback()

    # ── dashboard ─────────────────────────────────────────────────────────────

    async def get_dashboard(
        self, user_id: str, subscription_id: str
    ) -> WebhookDashboardResponse:
        """Return delivery statistics and recent logs for a subscription."""
        sub_result = await self._db.execute(
            select(OnChainWebhookSubscriptionDB).where(
                OnChainWebhookSubscriptionDB.id == UUID(subscription_id),
                OnChainWebhookSubscriptionDB.user_id == UUID(user_id),
            )
        )
        sub = sub_result.scalar_one_or_none()
        if sub is None:
            raise SubscriptionNotFoundError(subscription_id)

        # Fetch recent delivery logs
        logs_result = await self._db.execute(
            select(OnChainDeliveryLogDB)
            .where(OnChainDeliveryLogDB.subscription_id == UUID(subscription_id))
            .order_by(OnChainDeliveryLogDB.attempted_at.desc())
            .limit(DASHBOARD_LOG_LIMIT)
        )
        raw_logs = logs_result.scalars().all()

        success_rate = (
            sub.success_deliveries / sub.total_deliveries
            if sub.total_deliveries > 0
            else 0.0
        )

        return WebhookDashboardResponse(
            subscription_id=subscription_id,
            total_deliveries=sub.total_deliveries,
            success_deliveries=sub.success_deliveries,
            failure_count=sub.failure_count,
            success_rate=round(success_rate, 4),
            last_delivery_at=sub.last_delivery_at,
            last_delivery_status=sub.last_delivery_status,
            recent_logs=[self._to_log_entry(log) for log in raw_logs],
        )

    # ── test event ────────────────────────────────────────────────────────────

    async def send_test_event(
        self, user_id: str, subscription_id: str, event_type: str
    ) -> TestEventResponse:
        """Deliver a synthetic test event to verify webhook integration."""
        if event_type not in ON_CHAIN_EVENT_TYPES:
            raise UnsupportedEventTypeError(
                f"Unsupported event type: {event_type!r}. "
                f"Supported: {list(ON_CHAIN_EVENT_TYPES)}"
            )

        sub_result = await self._db.execute(
            select(OnChainWebhookSubscriptionDB).where(
                OnChainWebhookSubscriptionDB.id == UUID(subscription_id),
                OnChainWebhookSubscriptionDB.user_id == UUID(user_id),
                OnChainWebhookSubscriptionDB.active.is_(True),
            )
        )
        sub = sub_result.scalar_one_or_none()
        if sub is None:
            raise SubscriptionNotFoundError(subscription_id)

        test_event = OnChainEventPayload(
            event=event_type,
            tx_signature="TestSignature111111111111111111111111111111111111111111",
            slot=999999999,
            block_time=int(datetime.now(timezone.utc).timestamp()),
            timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            data={"test": True, "message": "This is a test event from SolFoundry"},
        )

        now = datetime.now(timezone.utc)
        payload_bytes = _build_batch_payload([test_event], now, now)
        signature = _sign_batch(payload_bytes, sub.secret)

        headers = {
            "Content-Type": "application/json",
            "X-SolFoundry-Event": "batch",
            "X-SolFoundry-Signature": signature,
            "X-SolFoundry-Event-Types": event_type,
            "X-SolFoundry-Test": "true",
            "User-Agent": "SolFoundry-OnChainWebhooks/1.0",
        }

        t_start = time.monotonic()
        status_code: Optional[int] = None
        error: Optional[str] = None
        delivered = False

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    sub.url,
                    data=payload_bytes,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=DISPATCH_TIMEOUT_SECONDS),
                ) as resp:
                    status_code = resp.status
                    delivered = 200 <= resp.status < 300
        except Exception as exc:
            error = str(exc)
            logger.warning("Test event delivery failed: sub=%s error=%s", sub.id, exc)

        latency_ms = int((time.monotonic() - t_start) * 1000)
        return TestEventResponse(
            delivered=delivered,
            status_code=status_code,
            latency_ms=latency_ms,
            error=error,
        )

    # ── internal ──────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(record: OnChainWebhookSubscriptionDB) -> OnChainWebhookResponse:
        """Map an ORM row to the response schema."""
        return OnChainWebhookResponse(
            id=str(record.id),
            url=record.url,
            active=record.active,
            event_filter=record.event_filter,
            created_at=record.created_at,
            last_delivery_at=record.last_delivery_at,
            last_delivery_status=record.last_delivery_status,
            failure_count=record.failure_count,
            total_deliveries=record.total_deliveries,
            success_deliveries=record.success_deliveries,
        )

    @staticmethod
    def _to_log_entry(record: OnChainDeliveryLogDB) -> DeliveryLogEntry:
        """Map a delivery log ORM row to the response schema."""
        return DeliveryLogEntry(
            id=str(record.id),
            batch_id=record.batch_id,
            event_type=record.event_type,
            tx_signature=record.tx_signature,
            attempt=record.attempt,
            status_code=record.status_code,
            success=record.success,
            error_message=record.error_message,
            attempted_at=record.attempted_at,
            latency_ms=record.latency_ms,
        )
