"""Health check endpoint for uptime monitoring and load balancers.

Checks four services:
- PostgreSQL database connectivity
- Redis connectivity
- Solana RPC endpoint responsiveness
- GitHub API rate limit availability
"""

import asyncio
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

# Timeout for external service checks (Solana RPC, GitHub API)
_EXTERNAL_TIMEOUT_MS = 200
_EXTERNAL_TIMEOUT_S = _EXTERNAL_TIMEOUT_MS / 1000


# ---------------------------------------------------------------------------
# Service check helpers
# ---------------------------------------------------------------------------


async def _check_database() -> dict:
    """Check PostgreSQL connectivity via a simple query."""
    start = time.monotonic()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - start) * 1000)
        return {"status": "healthy", "latency_ms": latency_ms}
    except SQLAlchemyError as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("Health check DB failure: %s", exc)
        return {
            "status": "unavailable",
            "latency_ms": latency_ms,
            "error": "connection_error",
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("Health check DB failure: %s", exc)
        return {
            "status": "unavailable",
            "latency_ms": latency_ms,
            "error": "unexpected_error",
        }


async def _check_redis() -> dict:
    """Check Redis connectivity via PING."""
    start = time.monotonic()
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        client = from_url(redis_url, decode_responses=True)
        async with client:
            await client.ping()
        latency_ms = round((time.monotonic() - start) * 1000)
        return {"status": "healthy", "latency_ms": latency_ms}
    except RedisError as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("Health check Redis failure: %s", exc)
        return {
            "status": "unavailable",
            "latency_ms": latency_ms,
            "error": "connection_error",
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("Health check Redis failure: %s", exc)
        return {
            "status": "unavailable",
            "latency_ms": latency_ms,
            "error": "unexpected_error",
        }


async def _check_solana_rpc() -> dict:
    """Check Solana RPC by requesting the latest slot.

    Uses the configured SOLANA_RPC_URL or defaults to mainnet-beta.
    Enforces a strict 200ms timeout to avoid blocking the health response.
    """
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=_EXTERNAL_TIMEOUT_S) as client:
            resp = await client.post(
                rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "getSlot"},
            )
            resp.raise_for_status()
            try:
                data = resp.json()
                if not isinstance(data, dict):
                    raise ValueError(f"unexpected response type: {type(data)}")
                slot = data.get("result")
            except Exception as exc:
                logger.warning("Solana RPC malformed response: %s", exc)
                latency_ms = round((time.monotonic() - start) * 1000)
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": "malformed_response",
                }
        latency_ms = round((time.monotonic() - start) * 1000)
        if slot is not None:
            return {"status": "healthy", "latency_ms": latency_ms, "slot": slot}
        return {
            "status": "degraded",
            "latency_ms": latency_ms,
            "error": "no_slot_in_response",
        }
    except httpx.TimeoutException:
        latency_ms = round((time.monotonic() - start) * 1000)
        return {"status": "degraded", "latency_ms": latency_ms, "error": "timeout"}
    except httpx.HTTPStatusError as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("Solana RPC HTTP error: %s", exc.response.status_code)
        return {
            "status": "degraded",
            "latency_ms": latency_ms,
            "error": f"http_{exc.response.status_code}",
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("Solana RPC check failed: %s", exc)
        return {
            "status": "unavailable",
            "latency_ms": latency_ms,
            "error": "connection_error",
        }


async def _check_github_api() -> dict:
    """Check GitHub API availability via the rate_limit endpoint.

    Uses GITHUB_TOKEN if available for authenticated rate limits.
    Reports remaining calls and reset time.
    """
    start = time.monotonic()
    headers: dict[str, str] = {"Accept": "application/vnd.github+json"}
    token = os.getenv("GITHUB_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=_EXTERNAL_TIMEOUT_S) as client:
            resp = await client.get(
                "https://api.github.com/rate_limit",
                headers=headers,
            )
            resp.raise_for_status()
            try:
                data = resp.json()
                if not isinstance(data, dict):
                    raise ValueError(f"unexpected response type: {type(data)}")
                # Validate expected shape; missing keys return empty dicts
                _ = data.get("resources", {}).get("core", {})
            except Exception as exc:
                logger.warning("GitHub API malformed response: %s", exc)
                latency_ms = round((time.monotonic() - start) * 1000)
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": "malformed_response",
                }
        latency_ms = round((time.monotonic() - start) * 1000)
        core = data.get("resources", {}).get("core", {})
        remaining = core.get("remaining", 0)
        limit = core.get("limit", 0)
        reset_at = core.get("reset", 0)

        # Consider degraded if less than 10% of rate limit remaining.
        # When limit is 0 (unexpected), treat as degraded.
        if limit > 0:
            status = "healthy" if remaining >= limit * 0.1 else "degraded"
        else:
            status = "degraded"

        return {
            "status": status,
            "latency_ms": latency_ms,
            "rate_limit": {
                "remaining": remaining,
                "limit": limit,
                "reset_at": datetime.fromtimestamp(reset_at, tz=timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
                if reset_at
                else None,
            },
        }
    except httpx.TimeoutException:
        latency_ms = round((time.monotonic() - start) * 1000)
        return {"status": "degraded", "latency_ms": latency_ms, "error": "timeout"}
    except httpx.HTTPStatusError as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("GitHub API HTTP error: %s", exc.response.status_code)
        return {
            "status": "degraded",
            "latency_ms": latency_ms,
            "error": f"http_{exc.response.status_code}",
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - start) * 1000)
        logger.warning("GitHub API check failed: %s", exc)
        return {
            "status": "unavailable",
            "latency_ms": latency_ms,
            "error": "connection_error",
        }


def _overall_status(services: dict) -> str:
    """Compute overall health from individual service statuses.

    Returns:
        "healthy"     — all services healthy
        "degraded"    — at least one degraded but core (db+redis) healthy
        "unavailable" — any core service unavailable
    """
    statuses = [s.get("status", "unavailable") for s in services.values()]
    core_statuses = [
        services.get("database", {}).get("status", "unavailable"),
        services.get("redis", {}).get("status", "unavailable"),
    ]

    if "unavailable" in core_statuses:
        return "unavailable"
    if "unavailable" in statuses or "degraded" in statuses:
        return "degraded"
    return "healthy"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/health", summary="Service health check")
async def health_check() -> dict:
    """Return service status including database, Redis, Solana RPC,
    and GitHub API connectivity.

    Status vocabulary:
        - ``healthy``: service is fully operational
        - ``degraded``: service is reachable but impaired (slow, rate-limited)
        - ``unavailable``: service cannot be reached
    """
    db, redis, solana, github = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_solana_rpc(),
        _check_github_api(),
    )

    services = {
        "database": db,
        "redis": redis,
        "solana_rpc": solana,
        "github_api": github,
    }

    return {
        "status": _overall_status(services),
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": services,
    }
