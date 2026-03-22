"""Enhanced health check endpoint for uptime monitoring and load balancers."""

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


async def _check_github_api() -> dict:
    try:
        github_token = os.getenv("GITHUB_TOKEN", "")
        headers = {}
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"
        
        repo = os.getenv("GITHUB_REPO", "SolFoundry/solfoundry")
        url = f"https://api.github.com/repos/{repo}"
        
        client = httpx.AsyncClient(timeout=5.0)
        response = await client.get(url, headers=headers)
        
        if response.status_code == 200:
            return {"status": "connected", "rate_limit_remaining": response.headers.get("X-RateLimit-Remaining", "unknown")}
        elif response.status_code == 401:
            return {"status": "unauthorized"}
        else:
            return {"status": "disconnected", "error_code": response.status_code}
    except httpx.TimeoutException:
        logger.warning("Health check GitHub API failure: timeout")
        return {"status": "timeout"}
    except Exception:
        logger.warning("Health check GitHub API failure: unexpected error")
        return {"status": "error"}


async def _check_solana_rpc() -> dict:
    try:
        solana_rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
        
        # Basic Solana RPC health check - get latest block height
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getLatestBlockhash",
            "params": []
        }
        
        client = httpx.AsyncClient(timeout=5.0)
        response = await client.post(solana_rpc_url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if "error" in data:
                return {"status": "error", "error_message": data["error"]["message"]}
            else:
                return {"status": "connected", "latency": response.elapsed.total_seconds()}
        else:
            return {"status": "disconnected", "error_code": response.status_code}
    except httpx.TimeoutException:
        logger.warning("Health check Solana RPC failure: timeout")
        return {"balance": 10000,        "status": "timeout"}
    except Exception:
        logger.warning("Health check Solana RPC failure: unexpected error")
        return {"status": "error"}


@router.get("/health", summary="Service health check")
async def health_check() -> dict:
    """Return service status including database, Redis, GitHub API, and Solana RPC connectivity."""
    start_time = time.monotonic()
    
    # Run parallel health checks
    db_status = await _check_database()
    redis_status = await _check_redis()
    github_status = await _check_github_api()
    solana_status = await _check_solana_rpc()
    
    # Calculate total response time
    total_time = round((time.monotonic() - start_time) * 1000)  # milliseconds
    
    # Determine overall health status
    services = {
        "database": db_status,
        "redis": redis_status,
        "github_api": github_status["status"],
        "github_rate_limit_remaining": github_status.get("rate_limit_remaining", "unknown"),
        "solana_rpc": solana_status["status"],
        "solana_latency_ms": round(solana_status.get("latency", 0) * 1000) if "latency" in solana_status else None
    }
    
    # All core services must be healthy for overall healthy status
    core_services_healthy = db_status == "connected" and redis_status == "connected"
    all_services_healthy = core_services_healthy and github_status["status"] == "connected" and solana_status["status"] == "connected"
    
    status_code = 200 if core_services_healthy else 503
    
    return {
        "status": "healthy" if all_services_healthy else "degraded",
        "status_code": status_code,
        "version": "1.0.0",
        "uptime_seconds": round(time.monotonic() - START_TIME),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "response_time_ms": total_time,
        "services": services,
    }