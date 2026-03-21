"""Health check endpoint for uptime monitoring and load balancers."""

import logging
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# Module-level start time for uptime calculation
_start_time: float = time.monotonic()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


async def _check_database() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as e:
        logger.warning("Health check: database unreachable: %s", e)
        return "disconnected"


async def _check_redis() -> str:
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(REDIS_URL, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        return "connected"
    except Exception as e:
        logger.warning("Health check: redis unreachable: %s", e)
        return "disconnected"


@router.get("/health", summary="Service health check")
async def health_check() -> dict:
    """Return service status including database and Redis connectivity.

    No authentication required. Designed to be fast (< 500ms).
    Returns 200 in both healthy and degraded states so load balancers
    can distinguish a live-but-degraded service from a hard failure.
    """
    db_status, redis_status = await _check_database(), await _check_redis()

    overall = (
        "healthy" if db_status == "connected" and redis_status == "connected" else "degraded"
    )

    return {
        "status": overall,
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - _start_time),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status,
            "redis": redis_status,
        },
    }
