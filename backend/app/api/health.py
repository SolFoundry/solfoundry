import time
import os
from datetime import datetime, timezone
from fastapi import APIRouter
from sqlalchemy import text
from app.database import engine
from app.constants import START_TIME

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Status endpoint for uptime monitoring and service health diagnostics.
    Checks connectivity to PostgreSQL and Redis.
    """
    db_status = "connected"
    redis_status = "connected"
    
    # 1. Database Connectivity Check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        import logging
        logger = logging.getLogger("app.api.health")
        logger.error(f"Health check DB failure: {e}")
        db_status = "disconnected"
        
    # 2. Redis Connectivity Check
    try:
        import redis.asyncio as aioredis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        # Direct connection check for the health probe
        r = aioredis.from_url(redis_url, decode_responses=True)
        async with r:
            await r.ping()
    except Exception as e:
        import logging
        logger = logging.getLogger("app.api.health")
        logger.error(f"Health check Redis failure: {e}")
        redis_status = "disconnected"
        
    # Fetch legacy fields for bot compatibility
    from app.services.github_sync import get_last_sync
    from app.services.bounty_service import _bounty_store
    from app.services.contributor_service import _store
    last_sync = get_last_sync()

    # Aggregate status
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
        # Legacy fields for bot/compatibility
        "database_legacy": "ok" if db_status == "connected" else "error",
        "last_sync": last_sync.isoformat() if last_sync else None,
        "bounties": len(_bounty_store),
        "contributors": len(_store),
    }
