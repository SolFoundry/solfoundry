"""Tests for the RateLimiter."""

import asyncio
import time

from github_scraper.utils.rate_limiter import RateLimiter


class TestRateLimiter:
    def test_try_acquire_within_burst(self):
        limiter = RateLimiter(requests_per_minute=60, burst=10)
        results = [limiter.try_acquire() for _ in range(10)]
        assert all(results)

    def test_try_acquire_exhausted(self):
        limiter = RateLimiter(requests_per_minute=60, burst=5)
        for _ in range(5):
            limiter.try_acquire()
        assert not limiter.try_acquire()

    def test_async_acquire(self):
        async def _test():
            limiter = RateLimiter(requests_per_minute=600, burst=10)
            start = time.monotonic()
            for _ in range(5):
                await limiter.acquire()
            elapsed = time.monotonic() - start
            assert elapsed < 1.0

        asyncio.run(_test())

    def test_refill_over_time(self):
        limiter = RateLimiter(requests_per_minute=60, burst=1)
        limiter.try_acquire()
        assert not limiter.try_acquire()
        # Wait for refill (60 rpm = 1 per second)
        time.sleep(1.1)
        assert limiter.try_acquire()

    def test_burst_default(self):
        limiter = RateLimiter(requests_per_minute=30)
        assert limiter.burst == 30

    def test_custom_burst(self):
        limiter = RateLimiter(requests_per_minute=60, burst=5)
        assert limiter.burst == 5
