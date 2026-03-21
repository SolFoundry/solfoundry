"""Redis utility for connection management."""

import os
import logging
from redis.asyncio import Redis, from_url

logger = logging.getLogger(__name__)

# Redis configuration from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_redis_client: Redis = None


async def get_redis() -> Redis:
    """Return an async Redis client. Initializes on first call."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = from_url(REDIS_URL, decode_responses=True)
            await _redis_client.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    return _redis_client


async def close_redis() -> None:
    """Close the Redis client connection."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")
