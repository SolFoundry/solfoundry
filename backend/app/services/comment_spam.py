"""Heuristic spam / abuse checks and per-user rate limiting."""

from __future__ import annotations

import re
import time
from collections import deque
from dataclasses import dataclass, field

# Obvious spam tokens (lowercase match)
_SPAM_PHRASES = frozenset(
    {
        "click here now",
        "buy cheap viagra",
        "crypto airdrop",
        "double your bitcoin",
        "free money now",
        "send 1 eth get 2",
        "whatsapp +",
        "telegram @",
        "earn $5000",
    }
)

# Repeated character run (e.g. "aaaaaaa")
_REPEAT_RUN = re.compile(r"(.)\1{12,}")

# Many URLs
_URL_PATTERN = re.compile(r"https?://[^\s]+", re.IGNORECASE)


@dataclass
class RateLimiter:
    """Sliding window: max `limit` events per `window_seconds` per key."""

    limit: int
    window_seconds: float
    _events: dict[str, deque[float]] = field(default_factory=dict, repr=False)

    def check(self, key: str) -> tuple[bool, str | None]:
        now = time.monotonic()
        q = self._events.setdefault(key, deque())
        while q and q[0] < now - self.window_seconds:
            q.popleft()
        if len(q) >= self.limit:
            return False, f"Rate limit: at most {self.limit} comments per {int(self.window_seconds)}s"
        q.append(now)
        return True, None


def assess_spam(body: str) -> tuple[bool, str | None]:
    """
    Returns (is_spam, reason_if_spam).
    """
    stripped = body.strip()
    lower = stripped.lower()

    if len(stripped) < 2:
        return True, "Comment too short"

    for phrase in _SPAM_PHRASES:
        if phrase in lower:
            return True, "Comment blocked by spam filter"

    if _REPEAT_RUN.search(stripped):
        return True, "Repeated characters look like spam"

    urls = _URL_PATTERN.findall(stripped)
    if len(urls) >= 5:
        return True, "Too many links in one comment"

    # Mostly non-text (e.g. emoji / symbols flood)
    letters = sum(1 for c in stripped if c.isalpha())
    if len(stripped) > 50 and letters < len(stripped) * 0.15:
        return True, "Low text content"

    return False, None
