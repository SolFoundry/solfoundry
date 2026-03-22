"""Health check endpoint for uptime monitoring and load balancers."""

import logging
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError, from_url

from app.database import engine
from app.constants import START_TIME

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


async def _check_database() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except SQLAlchemyError:
        logger.warning("Health check DB failure: connection error")
        return "disconnected"
    except Exception:
        logger.warning("Health check DB failure: unexpected error")
        return "disconnected"


async def _check_redis() -> str:
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = from_url(redis_url, decode_responses=True)
        async with client:
            await client.ping()
        return "connected"
    except RedisError:
        logger.warning("Health check Redis failure: connection error")
        return "disconnected"
    except Exception:
        logger.warning("Health check Redis failure: unexpected error")
        return "disconnected"


@router.get("/health", summary="Service health check")
async def health_check() -> dict:
    """Return service status including database and Redis connectivity."""
    db_status = await _check_database()
    redis_status = await _check_redis()

    is_healthy = db_status == "connected" and redis_status == "connected"

    return {
        "status": "healthy" if is_healthy else "degraded",
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status,
            "redis": redis_status,
        },
    }
