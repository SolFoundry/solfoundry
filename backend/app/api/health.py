"""Health check endpoint for uptime monitoring and load balancers."""

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine
from app.constants import START_TIME
from app.services.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

async def _check_database() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as e:
        logger.warning("Health check DB failure: %s", e)
        return "disconnected"

async def _check_redis() -> str:
    try:
        if hasattr(ws_manager._adapter, "_redis") and ws_manager._adapter._redis is not None:
            await ws_manager._adapter._redis.ping()
            return "connected"
        return "disconnected"
    except Exception as e:
        logger.warning("Health check Redis failure: %s", e)
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
