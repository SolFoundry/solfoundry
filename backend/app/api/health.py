"""Health check endpoint for uptime monitoring and load balancers."""

import logging
import os
import time
import httpx
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse
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
        return "up"
    except SQLAlchemyError:
        logger.warning("Health check DB failure: connection error")
        return "down"
    except Exception:
        logger.warning("Health check DB failure: unexpected error")
        return "down"


async def _check_redis() -> str:
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = from_url(redis_url, decode_responses=True)
        async with client:
            await client.ping()
        return "up"
    except RedisError:
        logger.warning("Health check Redis failure: connection error")
        return "down"
    except Exception:
        logger.warning("Health check Redis failure: unexpected error")
        return "down"


async def _check_solana_rpc() -> str:
    try:
        solana_rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
        async with httpx.AsyncClient(timeout=1.5) as client:
            response = await client.post(
                solana_rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"}
            )
            data = response.json()
            if data.get("result") == "ok":
                return "up"
            return "down"
    except Exception:
        logger.warning("Health check Solana RPC failure")
        return "down"


async def _check_github_api() -> str:
    try:
        token = os.getenv("GITHUB_TOKEN", "")
        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        async with httpx.AsyncClient(timeout=1.5) as client:
            response = await client.get("https://api.github.com/rate_limit", headers=headers)
            if response.status_code == 200:
                data = response.json()
                remaining = data.get("resources", {}).get("core", {}).get("remaining", 0)
                if remaining > 0:
                    return "up"
            return "down"
    except Exception:
        logger.warning("Health check GitHub API failure")
        return "down"


@router.get("/health", summary="Service health check")
async def health_check() -> JSONResponse:
    """Return service status including database, Redis, Solana RPC, and GitHub API connectivity."""
    
    # Run checks in parallel
    results = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_solana_rpc(),
        _check_github_api(),
        return_exceptions=True
    )
    
    db_status = results[0] if not isinstance(results[0], Exception) else "down"
    redis_status = results[1] if not isinstance(results[1], Exception) else "down"
    solana_status = results[2] if not isinstance(results[2], Exception) else "down"
    github_status = results[3] if not isinstance(results[3], Exception) else "down"

    is_healthy = all(status == "up" for status in (db_status, redis_status, solana_status, github_status))
    status_code = 200 if is_healthy else 503

    content = {
        "status": "healthy" if is_healthy else "degraded",
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status,
            "redis": redis_status,
            "solana": solana_status,
            "github": github_status,
        },
    }
    
    return JSONResponse(status_code=status_code, content=content)
