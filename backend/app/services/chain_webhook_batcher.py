"""5-second batching window for on-chain webhook deliveries (indexer → subscribers)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.database import get_db_session
from app.services.contributor_webhook_service import ContributorWebhookService

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 5


class ChainWebhookBatcher:
    """Collects normalized chain events and flushes them on a fixed interval."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._queue: list[tuple[dict[str, Any], str | None]] = []
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self._flush_unlocked()

    async def enqueue(
        self, event_dict: dict[str, Any], notify_user_id: str | None
    ) -> None:
        async with self._lock:
            self._queue.append((event_dict, notify_user_id))

    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=WINDOW_SECONDS)
                break
            except asyncio.TimeoutError:
                await self._flush_unlocked()

    async def _flush_unlocked(self) -> None:
        async with self._lock:
            if not self._queue:
                return
            batch = self._queue[:]
            self._queue.clear()

        grouped: dict[str | None, list[dict[str, Any]]] = {}
        for event_dict, uid in batch:
            grouped.setdefault(uid, []).append(event_dict)

        for notify_user_id, events in grouped.items():
            try:
                async with get_db_session() as session:
                    service = ContributorWebhookService(session)
                    await service.deliver_chain_batch(
                        events, notify_user_id=notify_user_id
                    )
            except Exception:
                logger.exception(
                    "Chain webhook batch flush failed (notify_user_id=%r)",
                    notify_user_id,
                )


chain_webhook_batcher = ChainWebhookBatcher()
