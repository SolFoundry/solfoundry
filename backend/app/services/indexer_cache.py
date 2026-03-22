"""Redis caching layer for the event indexer.

Provides TTL-based caching for hot queries (leaderboard, recent activity,
analytics) to reduce PostgreSQL load.  Cache invalidation is triggered
on event ingestion.

Architecture:
    Query → Redis GET → hit? return cached → miss? PostgreSQL → Redis SET

Cache keys follow the pattern: ``indexer:{resource}:{qualifier}``
TTL defaults:
    - Leaderboard: 60 seconds
    - Analytics: 120 seconds
    - Recent events: 30 seconds
    - Contributor profile: 60 seconds
    - Bounty stats: 60 seconds

References:
    - Redis async: https://redis-py.readthedocs.io/en/stable/examples/asyncio_examples.html
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Cache TTL configuration (seconds)
CACHE_TTL_LEADERBOARD = int(os.getenv("CACHE_TTL_LEADERBOARD", "60"))
CACHE_TTL_ANALYTICS = int(os.getenv("CACHE_TTL_ANALYTICS", "120"))
CACHE_TTL_RECENT_EVENTS = int(os.getenv("CACHE_TTL_RECENT_EVENTS", "30"))
CACHE_TTL_CONTRIBUTOR = int(os.getenv("CACHE_TTL_CONTRIBUTOR", "60"))
CACHE_TTL_BOUNTY_STATS = int(os.getenv("CACHE_TTL_BOUNTY_STATS", "60"))

# Cache key prefixes
KEY_PREFIX = "indexer"
KEY_LEADERBOARD = f"{KEY_PREFIX}:leaderboard"
KEY_ANALYTICS = f"{KEY_PREFIX}:analytics"
KEY_RECENT_EVENTS = f"{KEY_PREFIX}:recent"
KEY_CONTRIBUTOR = f"{KEY_PREFIX}:contributor"
KEY_BOUNTY_STATS = f"{KEY_PREFIX}:bounty_stats"


async def _get_redis():
    """Get the async Redis client instance.

    Returns:
        The Redis client from the core module.

    Raises:
        Exception: If Redis is not available.
    """
    from app.core.redis import get_redis

    return await get_redis()


async def get_cached(key: str) -> Optional[str]:
    """Retrieve a value from the Redis cache.

    Args:
        key: The full cache key to look up.

    Returns:
        The cached value as a string, or None if not found or on error.
    """
    try:
        redis_client = await _get_redis()
        value = await redis_client.get(key)
        if value:
            logger.debug("Cache HIT: %s", key)
        return value
    except Exception as error:
        logger.warning("Redis GET failed for %s: %s", key, error)
        return None


async def set_cached(key: str, value: str, ttl_seconds: int) -> bool:
    """Store a value in the Redis cache with a TTL.

    Args:
        key: The full cache key.
        value: The value to cache (must be a string).
        ttl_seconds: Time-to-live in seconds.

    Returns:
        True if the value was cached successfully, False on error.
    """
    try:
        redis_client = await _get_redis()
        await redis_client.setex(key, ttl_seconds, value)
        logger.debug("Cache SET: %s (TTL=%ds)", key, ttl_seconds)
        return True
    except Exception as error:
        logger.warning("Redis SET failed for %s: %s", key, error)
        return False


async def delete_cached(key: str) -> bool:
    """Delete a specific key from the Redis cache.

    Args:
        key: The full cache key to delete.

    Returns:
        True if the key was deleted, False on error.
    """
    try:
        redis_client = await _get_redis()
        await redis_client.delete(key)
        logger.debug("Cache DELETE: %s", key)
        return True
    except Exception as error:
        logger.warning("Redis DELETE failed for %s: %s", key, error)
        return False


async def invalidate_event_caches(
    contributor: Optional[str] = None,
    bounty_id: Optional[str] = None,
) -> None:
    """Invalidate caches affected by a new event ingestion.

    Called after each event is ingested to ensure stale data is not
    served.  Invalidates analytics, leaderboard, and any contributor
    or bounty-specific caches.

    Args:
        contributor: Optional contributor username whose cache to invalidate.
        bounty_id: Optional bounty ID whose cache to invalidate.
    """
    # Always invalidate global caches
    await delete_cached(KEY_ANALYTICS)
    await delete_cached(KEY_RECENT_EVENTS)

    # Invalidate leaderboard variants
    try:
        redis_client = await _get_redis()
        keys = []
        async for key in redis_client.scan_iter(match=f"{KEY_LEADERBOARD}:*"):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
            logger.debug("Invalidated %d leaderboard cache keys", len(keys))
    except Exception as error:
        logger.warning("Leaderboard cache invalidation failed: %s", error)

    # Invalidate contributor-specific cache
    if contributor:
        await delete_cached(f"{KEY_CONTRIBUTOR}:{contributor}")

    # Invalidate bounty-specific cache
    if bounty_id:
        await delete_cached(f"{KEY_BOUNTY_STATS}:{bounty_id}")


async def get_cached_leaderboard(
    sort_by: str = "earnings",
    tier: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
) -> Optional[Dict[str, Any]]:
    """Retrieve cached leaderboard data.

    Args:
        sort_by: Sort criterion used as part of the cache key.
        tier: Optional tier filter.
        page: Page number.
        page_size: Page size.

    Returns:
        Cached leaderboard data as a dictionary, or None on miss.
    """
    cache_key = f"{KEY_LEADERBOARD}:{sort_by}:{tier}:{page}:{page_size}"
    cached = await get_cached(cache_key)
    if cached:
        return json.loads(cached)
    return None


async def set_cached_leaderboard(
    data: Dict[str, Any],
    sort_by: str = "earnings",
    tier: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
) -> None:
    """Cache leaderboard data.

    Args:
        data: The leaderboard data to cache.
        sort_by: Sort criterion used as part of the cache key.
        tier: Optional tier filter.
        page: Page number.
        page_size: Page size.
    """
    cache_key = f"{KEY_LEADERBOARD}:{sort_by}:{tier}:{page}:{page_size}"
    await set_cached(cache_key, json.dumps(data, default=str), CACHE_TTL_LEADERBOARD)


async def get_cached_analytics() -> Optional[Dict[str, Any]]:
    """Retrieve cached platform analytics.

    Returns:
        Cached analytics data as a dictionary, or None on miss.
    """
    cached = await get_cached(KEY_ANALYTICS)
    if cached:
        return json.loads(cached)
    return None


async def set_cached_analytics(data: Dict[str, Any]) -> None:
    """Cache platform analytics data.

    Args:
        data: The analytics data to cache.
    """
    await set_cached(KEY_ANALYTICS, json.dumps(data, default=str), CACHE_TTL_ANALYTICS)


async def get_cached_contributor_profile(
    username: str,
) -> Optional[Dict[str, Any]]:
    """Retrieve cached contributor profile.

    Args:
        username: The contributor's GitHub username.

    Returns:
        Cached profile data as a dictionary, or None on miss.
    """
    cache_key = f"{KEY_CONTRIBUTOR}:{username}"
    cached = await get_cached(cache_key)
    if cached:
        return json.loads(cached)
    return None


async def set_cached_contributor_profile(
    username: str,
    data: Dict[str, Any],
) -> None:
    """Cache a contributor profile.

    Args:
        username: The contributor's GitHub username.
        data: The profile data to cache.
    """
    cache_key = f"{KEY_CONTRIBUTOR}:{username}"
    await set_cached(cache_key, json.dumps(data, default=str), CACHE_TTL_CONTRIBUTOR)
