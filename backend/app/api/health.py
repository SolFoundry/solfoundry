"""Health check endpoint for uptime monitoring and load balancers."""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError, from_url

from app.database import engine
from app.constants import START_TIME

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"
GITHUB_API_URL = "https://api.github.com/rate_limit"

# Timeout for each external check in seconds
_CHECK_TIMEOUT = 5.0


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


async def _check_solana() -> str:
    """Check Solana mainnet-beta RPC reachability via getHealth JSON-RPC call."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": "getHealth"}
    try:
        async with httpx.AsyncClient(timeout=_CHECK_TIMEOUT) as client:
            resp = await client.post(SOLANA_RPC_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
            # Solana RPC returns {"result": "ok"} when node is healthy
            if data.get("result") == "ok":
                return "up"
            logger.warning("Solana RPC unhealthy response: %s", data)
            return "down"
    except Exception:
        logger.warning("Health check Solana RPC failure", exc_info=True)
        return "down"


async def _check_github() -> str:
    """Check GitHub API rate limit status. Returns 'rate_limit_ok' when remaining > 0."""
    github_token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    try:
        async with httpx.AsyncClient(timeout=_CHECK_TIMEOUT) as client:
            resp = await client.get(GITHUB_API_URL, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            remaining = data.get("rate", {}).get("remaining", 0)
            if remaining > 0:
                return "rate_limit_ok"
            logger.warning("GitHub API rate limit exhausted (remaining=0)")
            return "rate_limit_exhausted"
    except Exception:
        logger.warning("Health check GitHub API failure", exc_info=True)
        return "down"


@router.get("/health", summary="Service health check")
async def health_check():
    """Return service status including DB, Redis, Solana RPC, and GitHub API connectivity.

    All four checks run in parallel via asyncio.gather for sub-2-second response time.
    Returns HTTP 200 when all services are healthy, HTTP 503 when any service is down.
    """
    db_status, redis_status, solana_status, github_status = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_solana(),
        _check_github(),
    )

    is_healthy = (
        db_status == "up"
        and redis_status == "up"
        and solana_status == "up"
        and github_status in ("rate_limit_ok",)
    )

    uptime_seconds = round(time.monotonic() - START_TIME)
    # Format uptime as human-readable string (e.g. "3d 2h 15m 4s")
    days, remainder = divmod(uptime_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_parts = []
    if days:
        uptime_parts.append(f"{days}d")
    if hours or days:
        uptime_parts.append(f"{hours}h")
    if minutes or hours or days:
        uptime_parts.append(f"{minutes}m")
    uptime_parts.append(f"{seconds}s")
    uptime_str = " ".join(uptime_parts)

    body = {
        "status": "healthy" if is_healthy else "unhealthy",
        "services": {
            "db": db_status,
            "redis": redis_status,
            "solana": solana_status,
            "github": github_status,
        },
        "uptime": uptime_str,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    status_code = 200 if is_healthy else 503
    return JSONResponse(content=body, status_code=status_code)
