"""Health check endpoint for uptime monitoring and load balancers.

Checks connectivity to all critical services:
- PostgreSQL database
- Redis cache
- Solana RPC node
- GitHub API

Returns degraded status if any non-critical service is down,
unhealthy if a critical service (database) is unreachable.
"""

import logging
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError, from_url

from app.database import engine
from app.constants import START_TIME

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# Timeout for external service checks (seconds)
_EXTERNAL_TIMEOUT = 5.0


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


async def _check_solana_rpc() -> dict:
    """Check Solana RPC node connectivity and get current slot."""
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    try:
        async with httpx.AsyncClient(timeout=_EXTERNAL_TIMEOUT) as client:
            response = await client.post(
                rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getSlot",
                    "params": [{"commitment": "confirmed"}],
                },
            )
            data = response.json()
            if "result" in data:
                return {
                    "status": "connected",
                    "slot": data["result"],
                    "rpc_url": rpc_url.split("//")[-1].split("/")[0],
                }
            return {"status": "error", "detail": data.get("error", {}).get("message", "Unknown RPC error")}
    except httpx.TimeoutException:
        logger.warning("Health check Solana RPC failure: timeout")
        return {"status": "timeout"}
    except Exception as exc:
        logger.warning("Health check Solana RPC failure: %s", exc)
        return {"status": "disconnected"}


async def _check_github_api() -> dict:
    """Check GitHub API availability and rate limit status."""
    github_token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    try:
        async with httpx.AsyncClient(timeout=_EXTERNAL_TIMEOUT) as client:
            response = await client.get(
                "https://api.github.com/rate_limit",
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                core = data.get("resources", {}).get("core", {})
                return {
                    "status": "connected",
                    "rate_limit_remaining": core.get("remaining", 0),
                    "rate_limit_total": core.get("limit", 0),
                    "authenticated": bool(github_token),
                }
            return {"status": "error", "http_status": response.status_code}
    except httpx.TimeoutException:
        logger.warning("Health check GitHub API failure: timeout")
        return {"status": "timeout"}
    except Exception as exc:
        logger.warning("Health check GitHub API failure: %s", exc)
        return {"status": "disconnected"}


@router.get("/health", summary="Service health check")
async def health_check() -> dict:
    """Return service status including database, Redis, Solana RPC, and GitHub API connectivity."""
    db_status = await _check_database()
    redis_status = await _check_redis()
    solana_status = await _check_solana_rpc()
    github_status = await _check_github_api()

    # Database is critical, others are degraded
    if db_status != "connected":
        overall = "unhealthy"
    elif any(
        s != "connected"
        for s in [redis_status, solana_status.get("status"), github_status.get("status")]
    ):
        overall = "degraded"
    else:
        overall = "healthy"

    return {
        "status": overall,
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status,
            "redis": redis_status,
            "solana_rpc": solana_status,
            "github_api": github_status,
        },
    }
