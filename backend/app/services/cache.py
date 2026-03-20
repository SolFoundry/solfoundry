"""Small async TTL cache for read-heavy query services."""

from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, Generic, TypeVar

T = TypeVar("T")


class AsyncTTLCache(Generic[T]):
    """In-memory TTL cache with a coarse async lock.

    This is intentionally minimal for MVP query endpoints. It keeps the cache
    semantics explicit and avoids introducing a hard Redis dependency.
    """

    def __init__(self, ttl_seconds: int = 60):
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[float, T]] = {}
        self._lock = asyncio.Lock()

    async def get_or_set(self, key: str, factory: Callable[[], Awaitable[T]]) -> T:
        """Return the cached value if fresh; otherwise compute and store it."""
        now = time.time()
        cached = self._entries.get(key)
        if cached and now - cached[0] < self.ttl_seconds:
            return cached[1]

        async with self._lock:
            cached = self._entries.get(key)
            now = time.time()
            if cached and now - cached[0] < self.ttl_seconds:
                return cached[1]

            value = await factory()
            self._entries[key] = (now, value)
            return value

    def invalidate(self) -> None:
        """Clear all cached entries."""
        self._entries.clear()
