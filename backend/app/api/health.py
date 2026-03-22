"""Health check endpoint for uptime monitoring and load balancers.

Reports the status of all backend services (database, Redis, Solana RPC,
GitHub API) with parallel health checks for fast response times (<2s).
Returns 200 if all services are healthy, 503 if any service is down.
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Literal

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

ServiceStatus = Literal["up", "down"]


async def _check_database() -> dict:
    """Check PostgreSQL database connectivity by executing a simple query."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "up"}
    except SQLAlchemyError as exc:
        logger.warning("Health check DB failure: %s", exc)
        return {"status": "down", "error": "connection_error"}
    except Exception as exc:
        logger.warning("Health check DB failure (unexpected): %s", exc)
        return {"status": "down", "error": "unexpected_error"}


async def _check_redis() -> dict:
    """Check Redis connectivity by sending a PING command."""
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = from_url(redis_url, decode_responses=True)
        async with client:
            await client.ping()
        return {"status": "up"}
    except RedisError as exc:
        logger.warning("Health check Redis failure: %s", exc)
        return {"status": "down", "error": "connection_error"}
    except Exception as exc:
        logger.warning("Health check Redis failure (unexpected): %s", exc)
        return {"status": "down", "error": "unexpected_error"}


async def _check_solana_rpc() -> dict:
    """Check Solana RPC reachability by calling getHealth."""
    solana_rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                solana_rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
            )
            data = response.json()
            if data.get("result") == "ok":
                return {"status": "up"}
            return {"status": "down", "error": data.get("error", {}).get("message", "unhealthy")}
    except httpx.TimeoutException:
        logger.warning("Health check Solana RPC failure: timeout")
        return {"status": "down", "error": "timeout"}
    except Exception as exc:
        logger.warning("Health check Solana RPC failure: %s", exc)
        return {"status": "down", "error": "unreachable"}


async def _check_github_api() -> dict:
    """Check GitHub API availability and report remaining rate limit."""
    github_token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://api.github.com/rate_limit",
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                core_limit = data.get("resources", {}).get("core", {})
                remaining = core_limit.get("remaining", 0)
                limit = core_limit.get("limit", 0)
                return {
                    "status": "up",
                    "rate_limit_remaining": remaining,
                    "rate_limit_total": limit,
                }
            return {"status": "down", "error": f"http_{response.status_code}"}
    except httpx.TimeoutException:
        logger.warning("Health check GitHub API failure: timeout")
        return {"status": "down", "error": "timeout"}
    except Exception as exc:
        logger.warning("Health check GitHub API failure: %s", exc)
        return {"status": "down", "error": "unreachable"}


def _format_uptime(seconds: int) -> str:
    """Format uptime seconds into a human-readable string."""
    days, remainder = divmod(seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, secs = divmod(remainder, 60)
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)


@router.get(
    "/api/health",
    summary="Service health check",
    description="Returns the status of all backend services. No authentication required.",
    response_description="Service health status with individual service checks",
)
async def health_check():
    """Return service status including database, Redis, Solana RPC, and GitHub API.

    All service checks run in parallel for fast response times (<2 seconds).
    Returns HTTP 200 if all services are healthy, HTTP 503 if any service is down.
    """
    start = time.monotonic()

    # Run all health checks in parallel for fast response
    db_result, redis_result, solana_result, github_result = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_solana_rpc(),
        _check_github_api(),
    )

    uptime_seconds = round(time.monotonic() - START_TIME)
    response_time_ms = round((time.monotonic() - start) * 1000)

    services = {
        "database": db_result,
        "redis": redis_result,
        "solana_rpc": solana_result,
        "github_api": github_result,
    }

    all_healthy = all(svc["status"] == "up" for svc in services.values())
    overall_status = "healthy" if all_healthy else "degraded"
    http_status = 200 if all_healthy else 503

    body = {
        "status": overall_status,
        "version": "1.0.0",
        "uptime": _format_uptime(uptime_seconds),
        "uptime_seconds": uptime_seconds,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "response_time_ms": response_time_ms,
        "services": services,
    }

    return JSONResponse(content=body, status_code=http_status)
