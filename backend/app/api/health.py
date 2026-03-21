"""Health check endpoint for uptime monitoring and load balancers."""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import asyncio
from redis.asyncio import Redis, RedisError, from_url

from app.database import engine
from app.constants import START_TIME, VERSION

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# Global Redis Client for Health Checks (Prevent Connection Leakage - Gemini 3.1 Fix)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client: Optional[Redis] = None

async def get_redis_client() -> Redis:
    global redis_client
    if redis_client is None:
        redis_client = from_url(REDIS_URL, decode_responses=True)
    return redis_client

async def _check_database() -> str:
    try:
        async with asyncio.timeout(0.25):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        return "connected"
    except (SQLAlchemyError, asyncio.TimeoutError):
        return "disconnected"
    except Exception:
        return "disconnected"

async def _check_redis() -> str:
    try:
        client = await get_redis_client()
        async with asyncio.timeout(0.25):
            await client.ping()
        return "connected"
    except (RedisError, asyncio.TimeoutError):
        return "disconnected"
    except Exception:
        return "disconnected"

@router.get("/health", summary="Service health check")
async def health_check() -> dict:
    """Return service status including database and Redis connectivity."""
    db_status, redis_status = await asyncio.gather(_check_database(), _check_redis())
    is_healthy = db_status == "connected" and redis_status == "connected"

    return {
        "status": "healthy" if is_healthy else "degraded",
        "version": VERSION,
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status,
            "redis": redis_status,
        },
    }
