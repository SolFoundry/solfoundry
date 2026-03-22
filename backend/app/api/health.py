"""Health check endpoint for uptime monitoring and load balancers."""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import aiohttp
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError, from_url

from app.database import engine
from app.constants import START_TIME

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# ── individual service checks ─────────────────────────────────────────────────


async def _check_database() -> str:
    """Verify database connectivity by running a trivial query."""
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
    """Verify Redis connectivity with a PING command."""
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


async def _check_solana() -> str:
    """Verify Solana RPC node is reachable and reports healthy."""
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                data = await resp.json(content_type=None)
                if data.get("result") == "ok":
                    return "healthy"
                # Node may return an error object when it's behind
                error = data.get("error", {})
                logger.warning("Solana RPC degraded: %s", error)
                return "degraded"
    except asyncio.TimeoutError:
        logger.warning("Health check Solana failure: timeout")
        return "unreachable"
    except Exception as exc:
        logger.warning("Health check Solana failure: %s", exc)
        return "unreachable"


async def _check_github() -> dict[str, Any]:
    """Check GitHub API availability and remaining rate-limit budget."""
    token = os.getenv("GITHUB_TOKEN", "")
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.github.com/rate_limit",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                data = await resp.json(content_type=None)
                remaining: int = data.get("rate", {}).get("remaining", 0)
                status = "ok" if remaining > 10 else "limited"
                return {"status": status, "remaining": remaining}
    except asyncio.TimeoutError:
        logger.warning("Health check GitHub failure: timeout")
        return {"status": "unreachable", "remaining": 0}
    except Exception as exc:
        logger.warning("Health check GitHub failure: %s", exc)
        return {"status": "unreachable", "remaining": 0}


# ── endpoint ──────────────────────────────────────────────────────────────────


@router.get("/health", summary="Service health check")
async def health_check() -> JSONResponse:
    """Return the status of all backend services.

    All four checks run in parallel so the total response time stays well
    under the 2-second SLA even when one service is slow to respond.

    Returns HTTP 200 when everything is healthy, HTTP 503 if any service is
    unreachable or disconnected.
    """
    db_status, redis_status, solana_status, github_info = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_solana(),
        _check_github(),
    )

    unhealthy_states = {"disconnected", "unreachable"}

    is_healthy = (
        db_status not in unhealthy_states
        and redis_status not in unhealthy_states
        and solana_status not in unhealthy_states
        and github_info["status"] not in unhealthy_states
    )

    payload: dict[str, Any] = {
        "status": "healthy" if is_healthy else "degraded",
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database": db_status,
            "redis": redis_status,
            "solana": solana_status,
            "github": github_info,
        },
    }

    http_status = 200 if is_healthy else 503
    return JSONResponse(content=payload, status_code=http_status)
