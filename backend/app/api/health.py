"""Health check endpoint for monitoring and load balancers.

Public endpoint that returns system status including database and Redis connectivity.
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.database import engine

logger = logging.getLogger(__name__)

# Track application start time for uptime calculation
_start_time: float = time.time()

# Redis URL from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str  # "healthy" or "degraded"
    version: str
    uptime_seconds: float
    timestamp: str
    services: Dict[str, str]  # service_name -> "connected" or "disconnected"


router = APIRouter(tags=["health"])


async def check_database() -> str:
    """Check database connectivity.
    
    Returns:
        "connected" if database is accessible, "disconnected" otherwise.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as e:
        logger.error("Health check DB failure: %s", e)
        return "disconnected"


async def check_redis() -> str:
    """Check Redis connectivity.
    
    Returns:
        "connected" if Redis is accessible, "disconnected" otherwise.
    """
    try:
        import redis.asyncio as aioredis
        
        client = aioredis.from_url(REDIS_URL, decode_responses=True)
        try:
            await client.ping()
            return "connected"
        finally:
            await client.close()
    except Exception as e:
        logger.warning("Health check Redis failure: %s", e)
        return "disconnected"


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Get system health status.
    
    Returns health status including:
    - Overall status (healthy/degraded)
    - Version
    - Uptime in seconds
    - Current timestamp
    - Service statuses (database, redis)
    
    No authentication required - public endpoint.
    """
    # Check services
    db_status = await check_database()
    redis_status = await check_redis()
    
    # Determine overall status
    all_healthy = db_status == "connected" and redis_status == "connected"
    overall_status = "healthy" if all_healthy else "degraded"
    
    # Calculate uptime
    uptime = time.time() - _start_time
    
    return HealthResponse(
        status=overall_status,
        version="1.0.0",
        uptime_seconds=round(uptime, 2),
        timestamp=datetime.now(timezone.utc).isoformat(),
        services={
            "database": db_status,
            "redis": redis_status,
        },
    )