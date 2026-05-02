"""Retry logic with exponential backoff for resilient API calls."""

import time
import logging
from typing import TypeVar, Callable, Optional
from dataclasses import dataclass

logger = logging.getLogger("bounty_agent.retry")

T = TypeVar("T")


@dataclass
class RetryPolicy:
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    backoff_factor: float = 2.0


def with_retry(fn: Callable[[], T], policy: Optional[RetryPolicy] = None) -> T:
    """Execute fn with exponential backoff retry."""
    policy = policy or RetryPolicy()
    last_exc: Optional[Exception] = None
    for attempt in range(policy.max_retries + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if attempt < policy.max_retries:
                delay = min(policy.base_delay * (policy.backoff_factor ** attempt), policy.max_delay)
                logger.warning("Retry %d/%d after %.1fs: %s", attempt + 1, policy.max_retries, delay, exc)
                time.sleep(delay)
    raise last_exc  # type: ignore[misc]
