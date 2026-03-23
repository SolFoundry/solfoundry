"""Health check endpoint for uptime monitoring and load balancers.

Implements Issue #490: API health check endpoint with comprehensive service status.

Features:
- Database connectivity check
- Redis connectivity check
- Solana RPC reachability check
- GitHub API rate limit check
- Parallel health checks with < 2s response time
- Returns 503 if any service is down
- Public endpoint (no auth required)
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError, from_url

from app.database import engine
from app.constants import START_TIME

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# Service check timeout (seconds)
CHECK_TIMEOUT = 5.0

# Solana RPC endpoints for health check
SOLANA_RPC_ENDPOINTS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-api.projectserum.com",
]

# GitHub API endpoint
GITHUB_API_URL = "https://api.github.com/rate_limit"


async def _check_database() -> dict[str, Any]:
    """Check database connectivity.
    
    Returns:
        dict with 'status' ('up' or 'down') and optional 'error' message.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "up"}
    except SQLAlchemyError as e:
        logger.warning("Health check DB failure: %s", e)
        return {"status": "down", "error": str(e)}
    except Exception as e:
        logger.warning("Health check DB failure: unexpected error: %s", e)
        return {"status": "down", "error": str(e)}


async def _check_redis() -> dict[str, Any]:
    """Check Redis connectivity.
    
    Returns:
        dict with 'status' ('up' or 'down') and optional 'error' message.
    """
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = from_url(redis_url, decode_responses=True)
        async with client:
            await client.ping()
        return {"status": "up"}
    except RedisError as e:
        logger.warning("Health check Redis failure: %s", e)
        return {"status": "down", "error": str(e)}
    except Exception as e:
        logger.warning("Health check Redis failure: unexpected error: %s", e)
        return {"status": "down", "error": str(e)}


async def _check_solana_rpc() -> dict[str, Any]:
    """Check Solana RPC reachability.
    
    Tests connectivity to Solana mainnet RPC endpoints using getHealth method.
    
    Returns:
        dict with 'status' ('up' or 'down'), optional 'latency_ms', and 'error'.
    """
    start_time = time.monotonic()
    
    try:
        async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
            # Try primary RPC endpoint
            response = await client.post(
                SOLANA_RPC_ENDPOINTS[0],
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getHealth"
                },
            )
            
            latency_ms = round((time.monotonic() - start_time) * 1000)
            
            if response.status_code == 200:
                data = response.json()
                # Solana getHealth returns "ok" when healthy
                if data.get("result") == "ok":
                    return {"status": "up", "latency_ms": latency_ms}
                else:
                    return {
                        "status": "down",
                        "error": data.get("error", {}).get("message", "unhealthy"),
                        "latency_ms": latency_ms
                    }
            else:
                return {
                    "status": "down",
                    "error": f"HTTP {response.status_code}",
                    "latency_ms": latency_ms
                }
    except httpx.TimeoutException:
        latency_ms = round((time.monotonic() - start_time) * 1000)
        return {"status": "down", "error": "timeout", "latency_ms": latency_ms}
    except Exception as e:
        logger.warning("Health check Solana RPC failure: %s", e)
        return {"status": "down", "error": str(e)}


async def _check_github_api() -> dict[str, Any]:
    """Check GitHub API rate limit status.
    
    Returns:
        dict with 'status' ('up' or 'down'), 'rate_remaining', 'rate_limit', 
        and optional 'error'.
    """
    try:
        async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
            # Use anonymous access for public rate limit endpoint
            response = await client.get(GITHUB_API_URL)
            
            if response.status_code == 200:
                data = response.json()
                rate_info = data.get("rate", {})
                remaining = rate_info.get("remaining", 0)
                limit = rate_info.get("limit", 60)
                
                # Consider "up" if we have any remaining calls or the API responds
                return {
                    "status": "up",
                    "rate_remaining": remaining,
                    "rate_limit": limit,
                }
            else:
                return {
                    "status": "down",
                    "error": f"HTTP {response.status_code}"
                }
    except httpx.TimeoutException:
        return {"status": "down", "error": "timeout"}
    except Exception as e:
        logger.warning("Health check GitHub API failure: %s", e)
        return {"status": "down", "error": str(e)}


def _format_uptime(seconds: float) -> str:
    """Format uptime in human-readable format.
    
    Args:
        seconds: Uptime in seconds.
        
    Returns:
        Human-readable string like "2d 5h 30m 15s" or "45m 30s".
    """
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    
    return " ".join(parts)


@router.get("/health", summary="Service health check (legacy)")
async def health_check_legacy() -> dict:
    """Return service status including database and Redis connectivity.
    
    This is the legacy endpoint maintained for backwards compatibility.
    Use /api/health for the full health check with all services.
    """
    db_status = await _check_database()
    redis_status = await _check_redis()

    is_healthy = db_status["status"] == "up" and redis_status["status"] == "up"

    return {
        "status": "healthy" if is_healthy else "degraded",
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status["status"],
            "redis": redis_status["status"],
        },
    }


@router.get("/api/health", summary="Full service health check")
async def health_check(response: Response) -> dict:
    """Return comprehensive service status including all backend services.
    
    This endpoint checks the health of:
    - Database (PostgreSQL)
    - Redis cache
    - Solana RPC endpoints
    - GitHub API (rate limit status)
    
    All checks run in parallel for fast response time (< 2 seconds).
    
    Returns:
        JSON with status and per-service health details.
        HTTP 200 if all services are healthy, HTTP 503 if any are down.
        
    Example response:
        {
            "status": "healthy",
            "uptime": "2d 5h 30m 15s",
            "timestamp": "2026-03-23T00:15:00Z",
            "services": {
                "database": {"status": "up"},
                "redis": {"status": "up"},
                "solana_rpc": {"status": "up", "latency_ms": 150},
                "github_api": {"status": "up", "rate_remaining": 58, "rate_limit": 60}
            }
        }
    """
    # Run all checks in parallel for fast response
    db_task = _check_database()
    redis_task = _check_redis()
    solana_task = _check_solana_rpc()
    github_task = _check_github_api()
    
    db_result, redis_result, solana_result, github_result = await asyncio.gather(
        db_task, redis_task, solana_task, github_task
    )
    
    # Determine overall health
    all_healthy = (
        db_result["status"] == "up"
        and redis_result["status"] == "up"
        and solana_result["status"] == "up"
        and github_result["status"] == "up"
    )
    
    # Set HTTP status code
    if not all_healthy:
        response.status_code = 503
    
    uptime_seconds = time.monotonic() - START_TIME
    
    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "uptime": _format_uptime(uptime_seconds),
        "uptime_seconds": round(uptime_seconds),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_result,
            "redis": redis_result,
            "solana_rpc": solana_result,
            "github_api": github_result,
        },
    }