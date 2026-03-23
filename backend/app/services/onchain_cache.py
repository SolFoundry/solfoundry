"""Redis-backed cache for on-chain data with 30-second TTL.

Provides a thin wrapper around the shared Redis client with graceful
degradation: on any Redis error the cache functions log a warning and
return ``None`` so callers can fall back to a live RPC query.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

CACHE_TTL: int = 30  # seconds
KEY_PREFIX = "onchain:"


def _key(namespace: str, identifier: str) -> str:
    return f"{KEY_PREFIX}{namespace}:{identifier}"


async def cache_get(namespace: str, identifier: str) -> Any | None:
    """Return a cached value or ``None`` on miss / Redis error."""
    try:
        redis = await get_redis()
        raw = await redis.get(_key(namespace, identifier))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning(
            "onchain_cache get failed (%s/%s): %s", namespace, identifier, exc
        )
        return None


async def cache_set(namespace: str, identifier: str, value: Any) -> None:
    """Persist *value* with a 30-second TTL. Silently ignores Redis errors."""
    try:
        redis = await get_redis()
        await redis.setex(_key(namespace, identifier), CACHE_TTL, json.dumps(value))
    except Exception as exc:
        logger.warning(
            "onchain_cache set failed (%s/%s): %s", namespace, identifier, exc
        )


async def cache_invalidate(namespace: str, identifier: str) -> None:
    """Delete a single cache entry. Silently ignores Redis errors."""
    try:
        redis = await get_redis()
        await redis.delete(_key(namespace, identifier))
    except Exception as exc:
        logger.warning(
            "onchain_cache invalidate failed (%s/%s): %s", namespace, identifier, exc
        )


async def cache_invalidate_prefix(namespace: str) -> int:
    """Delete all keys under *namespace*. Returns the number of keys removed."""
    try:
        redis = await get_redis()
        pattern = _key(namespace, "*")
        keys = await redis.keys(pattern)
        if keys:
            return await redis.delete(*keys)
        return 0
    except Exception as exc:
        logger.warning(
            "onchain_cache invalidate_prefix failed (%s): %s", namespace, exc
        )
        return 0
