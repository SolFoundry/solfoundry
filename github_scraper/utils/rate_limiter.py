"""Token bucket rate limiter for GitHub API calls."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field


@dataclass
class RateLimiter:
    """Token bucket rate limiter.

    Args:
        requests_per_minute: Maximum requests allowed per minute.
        burst: Maximum burst size (default = requests_per_minute).
    """
    requests_per_minute: float = 60.0
    burst: int = 0

    def __post_init__(self):
        if self.burst <= 0:
            self.burst = int(self.requests_per_minute)
        self._tokens: float = float(self.burst)
        self._last_refill: float = time.monotonic()
        self._lock: asyncio.Lock = None  # type: ignore

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(
            float(self.burst),
            self._tokens + elapsed * (self.requests_per_minute / 60.0),
        )
        self._last_refill = now

    async def acquire(self) -> None:
        lock = self._get_lock()
        async with lock:
            while True:
                self._refill()
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                wait_time = (1.0 - self._tokens) / (self.requests_per_minute / 60.0)
                await asyncio.sleep(wait_time)

    def try_acquire(self) -> bool:
        self._refill()
        if self._tokens >= 1.0:
            self._tokens -= 1.0
            return True
        return False
