"""Prometheus metrics: DB pool, optional Redis queue depths, Solana RPC probe."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Sequence

import httpx
from prometheus_client import Gauge

from app.database import engine, is_sqlite

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_SEC = float(os.getenv("OBSERVABILITY_REFRESH_SECONDS", "15"))

_db_pool_checked_in = Gauge(
    "solfoundry_db_pool_checked_in",
    "SQLAlchemy pool connections idle (checked in)",
)
_db_pool_checked_out = Gauge(
    "solfoundry_db_pool_checked_out",
    "SQLAlchemy pool connections in use (checked out)",
)
_db_pool_overflow = Gauge(
    "solfoundry_db_pool_overflow",
    "SQLAlchemy pool overflow connections",
)
_solana_rpc_up = Gauge(
    "solfoundry_solana_rpc_up",
    "1 if Solana JSON-RPC getHealth succeeds, else 0",
)
_solana_rpc_latency_seconds = Gauge(
    "solfoundry_solana_rpc_latency_seconds",
    "Latency of last Solana getHealth RPC call",
)
_redis_queue_length = Gauge(
    "solfoundry_redis_queue_length",
    "Redis list length for pipeline / event queues",
    labelnames=("queue",),
)


def _queue_keys() -> Sequence[str]:
    raw = os.getenv("OBSERVABILITY_REDIS_QUEUE_KEYS", "").strip()
    if not raw:
        return ()
    return tuple(k.strip() for k in raw.split(",") if k.strip())


def update_db_pool_gauges() -> None:
    """Best-effort pool stats; no-op for SQLite / StaticPool in tests."""
    if is_sqlite:
        return
    try:
        pool = engine.sync_engine.pool
        if not hasattr(pool, "checked_in"):
            return
        _db_pool_checked_in.set(pool.checked_in())
        _db_pool_checked_out.set(pool.checked_out())
        _db_pool_overflow.set(pool.overflow())
    except Exception as exc:
        logger.debug("DB pool metrics update skipped: %s", exc)


async def update_solana_rpc_gauges() -> None:
    url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com").strip()
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getHealth",
    }
    try:
        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=payload)
            elapsed = time.perf_counter() - start
            _solana_rpc_latency_seconds.set(elapsed)
            if r.status_code == 200:
                body = r.json()
                if body.get("result") == "ok":
                    _solana_rpc_up.set(1)
                else:
                    _solana_rpc_up.set(0)
            else:
                _solana_rpc_up.set(0)
    except Exception as exc:
        logger.debug("Solana RPC probe failed: %s", exc)
        _solana_rpc_up.set(0)


async def update_redis_queue_gauges() -> None:
    keys = _queue_keys()
    if not keys:
        return
    try:
        from app.core.redis import get_redis

        redis = await get_redis()
        for key in keys:
            try:
                n = await redis.llen(key)
                _redis_queue_length.labels(queue=key).set(float(n))
            except Exception as exc:
                logger.debug("Redis queue length for %s: %s", key, exc)
    except Exception as exc:
        logger.debug("Redis queue metrics skipped: %s", exc)


async def refresh_all() -> None:
    update_db_pool_gauges()
    await asyncio.gather(
        update_solana_rpc_gauges(),
        update_redis_queue_gauges(),
        return_exceptions=True,
    )


async def periodic_refresh() -> None:
    """Background loop; swallow errors so monitoring never takes down the API."""
    while True:
        try:
            await refresh_all()
        except Exception as exc:
            logger.warning("Observability refresh error: %s", exc)
        await asyncio.sleep(REFRESH_INTERVAL_SEC)
