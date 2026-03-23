"""
Health check endpoint for uptime monitoring and load balancers.

Mission #80: SolFoundry API Health Check Upgrade (Elite Suite)
Provides real-time status of internal dependencies, external infrastructure,
and core system telemetry. Returns 200 on healthy, 503 on degraded/unavailable.
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import psutil
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.asyncio import Redis, RedisError, from_url
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.constants import START_TIME, VERSION
from app.database import engine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

# ── Configuration ────────────────────────────────────────────────────────────

REDIS_URL       = os.getenv("REDIS_URL",       "redis://localhost:6379/0")
SOLANA_RPC_URL  = os.getenv("SOLANA_RPC_URL",  "https://api.mainnet-beta.solana.com")
GITHUB_API_URL  = os.getenv("GITHUB_API_URL",  "https://api.github.com")
GITHUB_TOKEN    = os.getenv("GITHUB_TOKEN",    "")  # optional; raises rate-limit ceiling

# Per-check timeout in seconds. Keep tight to ensure fast failover detection.
CHECK_TIMEOUT   = 0.20   # 200 ms

# Disk partition to monitor (logging / data volume).
DISK_PARTITION  = os.getenv("HEALTH_DISK_PARTITION", "/")

# ── Shared Redis client (prevents connection leakage) ────────────────────────

_redis_client: Optional[Redis] = None


async def _get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = from_url(REDIS_URL, decode_responses=True)
    return _redis_client


# ── Status helpers ───────────────────────────────────────────────────────────

def _status(ok: bool, soft_fail: bool = False) -> str:
    """
    Map a boolean result to the unified status vocabulary.

    ok=True              → "healthy"
    ok=False, critical   → "unavailable"
    ok=False, soft_fail  → "degraded"
    """
    if ok:
        return "healthy"
    return "degraded" if soft_fail else "unavailable"


# ── Internal service checks ──────────────────────────────────────────────────

async def _check_database() -> dict:
    """Verify PostgreSQL reachability via a lightweight SELECT 1."""
    try:
        async with asyncio.timeout(CHECK_TIMEOUT):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        return {"status": "healthy"}
    except asyncio.TimeoutError:
        logger.warning("Database health check timed out.")
        return {"status": "unavailable", "error": "timeout"}
    except SQLAlchemyError as exc:
        logger.warning("Database health check failed: %s", exc)
        return {"status": "unavailable", "error": str(exc)}
    except Exception as exc:
        logger.exception("Unexpected error in database check.")
        return {"status": "unavailable", "error": str(exc)}


async def _check_redis() -> dict:
    """Verify Redis reachability via PING."""
    try:
        client = await _get_redis_client()
        async with asyncio.timeout(CHECK_TIMEOUT):
            await client.ping()
        return {"status": "healthy"}
    except asyncio.TimeoutError:
        logger.warning("Redis health check timed out.")
        return {"status": "unavailable", "error": "timeout"}
    except RedisError as exc:
        logger.warning("Redis health check failed: %s", exc)
        return {"status": "unavailable", "error": str(exc)}
    except Exception as exc:
        logger.exception("Unexpected error in Redis check.")
        return {"status": "unavailable", "error": str(exc)}


# ── External infrastructure checks ──────────────────────────────────────────

async def _check_solana_rpc() -> dict:
    """
    Call the Solana JSON-RPC `getHealth` method.

    A healthy node responds with {"result": "ok"}.
    A node that is behind responds with a -32005 error code; we surface
    this as "degraded" so dashboards can distinguish it from a hard failure.
    """
    payload = {"jsonrpc": "2.0", "id": 1, "method": "getHealth"}
    try:
        async with httpx.AsyncClient(timeout=CHECK_TIMEOUT) as client:
            response = await client.post(SOLANA_RPC_URL, json=payload)
        response.raise_for_status()
        body = response.json()

        if body.get("result") == "ok":
            return {"status": "healthy", "cluster": SOLANA_RPC_URL}

        # Node is behind or returning a non-ok result
        rpc_error = body.get("error", {})
        return {
            "status": "degraded",
            "cluster": SOLANA_RPC_URL,
            "error": rpc_error.get("message", "non-ok response"),
            "code": rpc_error.get("code"),
        }

    except asyncio.TimeoutError:
        logger.warning("Solana RPC health check timed out.")
        return {"status": "unavailable", "cluster": SOLANA_RPC_URL, "error": "timeout"}
    except httpx.HTTPStatusError as exc:
        logger.warning("Solana RPC returned HTTP %s.", exc.response.status_code)
        return {
            "status": "unavailable",
            "cluster": SOLANA_RPC_URL,
            "error": f"HTTP {exc.response.status_code}",
        }
    except Exception as exc:
        logger.exception("Unexpected error in Solana RPC check.")
        return {"status": "unavailable", "cluster": SOLANA_RPC_URL, "error": str(exc)}


async def _check_github_api() -> dict:
    """
    Query GitHub's rate-limit endpoint to surface current API quota.

    Marked "degraded" when remaining requests fall below 10 % of the limit,
    which signals imminent integration downtime for bounty sync jobs.
    """
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=CHECK_TIMEOUT, headers=headers) as client:
            response = await client.get(f"{GITHUB_API_URL}/rate_limit")
        response.raise_for_status()

        core = response.json().get("resources", {}).get("core", {})
        limit     = core.get("limit",     0)
        remaining = core.get("remaining", 0)
        reset_at  = core.get("reset",     0)

        low_quota = limit > 0 and (remaining / limit) < 0.10

        return {
            "status": "degraded" if low_quota else "healthy",
            "rate_limit": {
                "limit":     limit,
                "remaining": remaining,
                "reset_utc": datetime.fromtimestamp(reset_at, tz=timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
            },
        }

    except asyncio.TimeoutError:
        logger.warning("GitHub API health check timed out.")
        return {"status": "unavailable", "error": "timeout"}
    except httpx.HTTPStatusError as exc:
        logger.warning("GitHub API returned HTTP %s.", exc.response.status_code)
        return {"status": "unavailable", "error": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        logger.exception("Unexpected error in GitHub API check.")
        return {"status": "unavailable", "error": str(exc)}


# ── System telemetry (sync, wrapped for gather) ──────────────────────────────

def _collect_system_telemetry() -> dict:
    """
    Collect CPU, memory, and disk telemetry via psutil.

    All calls are non-blocking after the initial 0.1 s CPU interval sample,
    which is acceptable given the endpoint's overall budget.
    """
    # CPU — average across all logical cores over a short sample window.
    cpu_percent = psutil.cpu_percent(interval=0.10)

    # Memory
    mem = psutil.virtual_memory()
    memory = {
        "total_mb":     round(mem.total     / 1_048_576, 1),
        "available_mb": round(mem.available / 1_048_576, 1),
        "used_percent": mem.percent,
    }

    # Disk — target partition only.
    try:
        disk = psutil.disk_usage(DISK_PARTITION)
        disk_info = {
            "partition":    DISK_PARTITION,
            "total_gb":     round(disk.total / 1_073_741_824, 2),
            "free_gb":      round(disk.free  / 1_073_741_824, 2),
            "used_percent": disk.percent,
        }
    except (PermissionError, FileNotFoundError) as exc:
        disk_info = {"error": str(exc)}

    return {
        "cpu_percent":  cpu_percent,
        "memory":       memory,
        "disk":         disk_info,
    }


async def _check_system() -> dict:
    """Run synchronous psutil collection in a thread pool to keep the event loop free."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _collect_system_telemetry)


# ── Route ────────────────────────────────────────────────────────────────────

@router.get("/health", summary="Comprehensive service health check")
async def health_check() -> JSONResponse:
    """
    Return a structured health report covering:
    - Internal services: PostgreSQL, Redis
    - External infrastructure: Solana RPC, GitHub API
    - System telemetry: CPU, memory, disk

    HTTP 200 → all core services healthy.
    HTTP 503 → one or more core services unavailable or degraded.
    """
    db_result, redis_result, solana_result, github_result, system_telemetry = (
        await asyncio.gather(
            _check_database(),
            _check_redis(),
            _check_solana_rpc(),
            _check_github_api(),
            _check_system(),
            return_exceptions=False,
        )
    )

    # Core services (PostgreSQL + Redis) determine the top-level status code.
    core_healthy = (
        db_result["status"]    == "healthy"
        and redis_result["status"] == "healthy"
    )

    # Overall status reflects the worst state across ALL services.
    all_statuses = {
        db_result["status"],
        redis_result["status"],
        solana_result["status"],
        github_result["status"],
    }
    if "unavailable" in all_statuses:
        overall_status = "unavailable"
    elif "degraded" in all_statuses:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    body = {
        "status":         overall_status,
        "version":        VERSION,
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp":      datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "services": {
            "database":   db_result,
            "redis":      redis_result,
            "solana_rpc": solana_result,
            "github_api": github_result,
        },
        "system": system_telemetry,
    }

    http_status = 200 if core_healthy else 503
    return JSONResponse(content=body, status_code=http_status)
