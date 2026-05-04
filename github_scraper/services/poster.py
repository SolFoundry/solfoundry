"""SolFoundry API poster service with retry and circuit breaker."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

from github_scraper.models.issue import BountyMapping
from github_scraper.utils.tier_classifier import TierClassifier

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"    # Normal operation
    OPEN = "open"        # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreaker:
    """Circuit breaker for SolFoundry API protection."""
    failure_threshold: int = 3
    recovery_timeout_seconds: float = 30.0
    _failures: int = 0
    _state: CircuitState = CircuitState.CLOSED
    _last_failure_time: Optional[float] = None

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            import time
            if self._last_failure_time and (
                time.monotonic() - self._last_failure_time > self.recovery_timeout_seconds
            ):
                self._state = CircuitState.HALF_OPEN
        return self._state

    def record_success(self) -> None:
        self._failures = 0
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        import time
        self._failures += 1
        self._last_failure_time = time.monotonic()
        if self._failures >= self.failure_threshold:
            self._state = CircuitState.OPEN

    @property
    def is_open(self) -> bool:
        return self.state == CircuitState.OPEN


@dataclass
class SolFoundryPoster:
    """Post scraped issues as SolFoundry bounties.

    Features:
    - Circuit breaker for API protection
    - Exponential backoff retry
    - Batch posting support
    - Idempotent posting (skip already-posted issues)
    """
    api_url: str = "https://solfoundry.org/api"
    api_key: str = ""
    max_retries: int = 3
    batch_size: int = 10

    _circuit: CircuitBreaker = field(default_factory=CircuitBreaker)
    _client: Optional[httpx.AsyncClient] = None
    _posted_ids: set[str] = field(default_factory=set)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "SolFoundry-GitHub-Scraper/1.0",
            }
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            self._client = httpx.AsyncClient(
                base_url=self.api_url,
                headers=headers,
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def post_bounty(self, mapping: BountyMapping) -> Optional[str]:
        """Post a single bounty to SolFoundry. Returns the bounty ID or None."""
        if mapping.issue.unique_key in self._posted_ids:
            logger.debug(f"Skipping already posted: {mapping.issue.unique_key}")
            return mapping.solfoundry_id

        if self._circuit.is_open:
            logger.warning("Circuit breaker open, skipping post")
            return None

        payload = mapping.to_post_payload()
        client = await self._get_client()

        for attempt in range(self.max_retries):
            try:
                resp = await client.post("/bounties", json=payload)
                if resp.status_code in (200, 201):
                    self._circuit.record_success()
                    bounty_id = resp.json().get("id", "")
                    mapping.auto_posted = True
                    mapping.solfoundry_id = bounty_id
                    self._posted_ids.add(mapping.issue.unique_key)
                    logger.info(f"Posted bounty: {mapping.title} → {bounty_id}")
                    return bounty_id

                if resp.status_code == 409:
                    # Already exists (idempotent)
                    self._circuit.record_success()
                    bounty_id = resp.json().get("id", "")
                    mapping.solfoundry_id = bounty_id
                    mapping.auto_posted = True
                    self._posted_ids.add(mapping.issue.unique_key)
                    return bounty_id

                if resp.status_code >= 500:
                    self._circuit.record_failure()
                    backoff = 2 ** attempt
                    logger.warning(f"Server error {resp.status_code}, retrying in {backoff}s")
                    await asyncio.sleep(backoff)
                    continue

                logger.error(f"API error: {resp.status_code} {resp.text[:200]}")
                return None

            except httpx.HTTPError as e:
                self._circuit.record_failure()
                backoff = 2 ** attempt
                logger.warning(f"HTTP error, retrying in {backoff}s: {e}")
                await asyncio.sleep(backoff)

        logger.error(f"Failed to post bounty after {self.max_retries} retries: {mapping.title}")
        return None

    async def post_batch(self, mappings: list[BountyMapping]) -> list[Optional[str]]:
        """Post a batch of bounties with concurrency control."""
        semaphore = asyncio.Semaphore(self.batch_size)

        async def _limited_post(mapping: BountyMapping) -> Optional[str]:
            async with semaphore:
                return await self.post_bounty(mapping)

        results = await asyncio.gather(
            *[_limited_post(m) for m in mappings],
            return_exceptions=True,
        )
        return [r if not isinstance(r, Exception) else None for r in results]
