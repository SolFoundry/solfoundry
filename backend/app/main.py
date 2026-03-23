"""SolFoundry API (Sovereign 14.0 Reconstruction).

Central FastAPI application with integrated security, rate limiting, and
unified persistence for payouts and treasury operations.
"""

import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

# Middleware
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.ip_blocklist import IPBlocklistMiddleware
from app.middleware.rate_limit import RateLimitMiddleware  # LUA-based
from app.middleware.rate_limiter import RateLimiterMiddleware  # Redis-backed
from app.middleware.logging_middleware import LoggingMiddleware
from app.middleware.sanitization import InputSanitizationMiddleware

# Routers
from app.api.health import router as health_router
from app.api.metrics import router as metrics_router
from app.api.auth import router as auth_router
from app.api.bounties import router as bounties_router
from app.api.notifications import router as notifications_router
from app.api.leaderboard import router as leaderboard_router
from app.api.payouts import router as payouts_router
from app.api.webhooks.github import router as github_webhook_router
from app.api.websocket import router as websocket_router
from app.api.agents import router as agents_router
from app.api.disputes import router as disputes_router
from app.api.stats import router as stats_router
from app.api.escrow import router as escrow_router
from app.api.admin import router as admin_router
from app.api.og import router as og_router
from app.api.contributor_webhooks import router as contributor_webhooks_router
from app.api.siws import router as siws_router
from app.api import buybacks

# Core & Services
from app.database import init_db, close_db
from app.core.logging_config import setup_logging
from app.core.redis import close_redis
from app.services.health import monitor
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync
from app.services.auto_approve_service import periodic_auto_approve
from app.services.bounty_lifecycle_service import periodic_deadline_check
from app.services.escrow_service import periodic_escrow_refund
from app.services.observability_metrics import periodic_refresh
from app.services.config_validator import install_log_filter, validate_secrets
from app.services.auth_service import AuthError

# Initialize logging
setup_logging()
import structlog
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    install_log_filter()
    validate_secrets(strict=False)

    await init_db()
    await ws_manager.init()

    # Hydrate in-memory caches
    try:
        from app.services.payout_service import hydrate_from_database as hydrate_payouts
        from app.services.reputation_service import (
            hydrate_from_database as hydrate_reputation,
        )

        await hydrate_payouts()
        await hydrate_reputation()
    except Exception as exc:
        logger.warning("PostgreSQL hydration failed: %s", exc)

    # Startup sync
    try:
        await sync_all()
    except Exception:
        pass

    # Background tasks
    sync_task = asyncio.create_task(periodic_sync())
    auto_approve_task = asyncio.create_task(periodic_auto_approve(interval_seconds=300))
    deadline_task = asyncio.create_task(periodic_deadline_check(interval_seconds=60))
    escrow_refund_task = asyncio.create_task(
        periodic_escrow_refund(interval_seconds=60)
    )

    obs_task = None
    if os.getenv("OBSERVABILITY_ENABLE_BACKGROUND", "true").lower() == "true":
        obs_task = asyncio.create_task(periodic_refresh())

    monitor.start()

    yield

    # Shutdown
    sync_task.cancel()
    auto_approve_task.cancel()
    deadline_task.cancel()
    escrow_refund_task.cancel()
    if obs_task:
        obs_task.cancel()

    await ws_manager.shutdown()
    await close_redis()
    await close_db()
    monitor.stop()


app = FastAPI(
    title="SolFoundry API",
    description="Sovereign Absolute Reconstruction (14.0)",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Middleware Stack ─────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)
app.add_middleware(InputSanitizationMiddleware)
app.add_middleware(RateLimiterMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(IPBlocklistMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next: Callable):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)

    monitor.track_request(
        path=request.url.path,
        method=request.method,
        status_code=response.status_code,
        duration=process_time,
    )
    return response


# ── Global Exception Handlers ────────────────────────────────────────────────


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": exc.detail,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.error("unhandled_exception", exc_info=exc, request_id=request_id)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "request_id": request_id},
    )


@app.exception_handler(AuthError)
async def auth_exception_handler(request: Request, exc: AuthError):
    return JSONResponse(
        status_code=401,
        content={
            "message": str(exc),
            "request_id": getattr(request.state, "request_id", None),
        },
    )


# ── Route Registration ──────────────────────────────────────────────────────

app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(bounties_router, prefix="/api", tags=["bounties"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(leaderboard_router, prefix="/api", tags=["leaderboard"])
app.include_router(payouts_router, prefix="/api", tags=["payouts"])
app.include_router(buybacks.router, prefix="/api/buybacks", tags=["treasury"])
app.include_router(github_webhook_router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(websocket_router, tags=["websocket"])
app.include_router(agents_router, prefix="/api", tags=["agents"])
app.include_router(disputes_router, prefix="/api", tags=["disputes"])
app.include_router(escrow_router, prefix="/api", tags=["escrow"])
app.include_router(stats_router, prefix="/api", tags=["stats"])
app.include_router(og_router, tags=["og"])
app.include_router(contributor_webhooks_router, prefix="/api")
app.include_router(siws_router, prefix="/api")
app.include_router(health_router, prefix="/api/v2", tags=["system"])
app.include_router(metrics_router, tags=["system"])
app.include_router(admin_router, tags=["admin"])

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
