"""FastAPI application entry point with production security hardening.

This module initializes the FastAPI application with a full security middleware
stack including:
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting with tiered access (anonymous/authenticated/admin)
- Input sanitization (XSS and SQL injection detection)
- CORS with strict origin whitelist
- Sensitive data logging filter
- IP blocklist via Redis
- Structured request logging with correlation IDs

Middleware is applied in reverse order (last added = first executed):
1. SecurityHeadersMiddleware — adds headers to all responses
2. RateLimitMiddleware — enforces request rate limits (in-memory sliding window)
3. InputSanitizationMiddleware — scans inputs for attacks
4. RateLimiterMiddleware — Redis-backed token bucket rate limiter
5. IPBlocklistMiddleware — blocks banned IPs via Redis
6. SecurityMiddleware — upstream security headers
7. CORSMiddleware — handles cross-origin requests
8. LoggingMiddleware — structured request/response logging

References:
    - OWASP Security Headers: https://owasp.org/www-project-secure-headers/
    - FastAPI Middleware: https://fastapi.tiangolo.com/tutorial/middleware/
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging_config import setup_logging
from app.middleware.logging_middleware import LoggingMiddleware
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.contributors import router as contributors_router
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
from app.api.og import router as og_router
from app.api.staking import router as staking_router
from app.database import init_db, close_db
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.sanitization import InputSanitizationMiddleware
from app.services.config_validator import install_log_filter, validate_secrets
from app.services.auth_service import AuthError
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync
from app.services.auto_approve_service import periodic_auto_approve
from app.services.bounty_lifecycle_service import periodic_deadline_check
from app.services.escrow_service import periodic_escrow_refund
from app.core.redis import close_redis
from app.core.config import ALLOWED_ORIGINS
from app.middleware.ip_blocklist import IPBlocklistMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown.

    On startup:
    1. Installs the sensitive data logging filter to prevent secret leakage
    2. Validates that all required secrets are configured
    3. Initializes the database schema
    4. Initializes the WebSocket manager
    5. Syncs bounties and contributors from GitHub Issues
    6. Starts the periodic background sync task

    On shutdown:
    1. Cancels background sync task
    2. Shuts down WebSocket connections
    3. Closes database connection pool

    Args:
        app: The FastAPI application instance.

    Yields:
        None: Control is yielded to the application during its runtime.
    """
    # Install security logging filter before any other operations
    install_log_filter()

    # Validate secrets (warn on missing, don't block startup for dev)
    secret_warnings = validate_secrets(strict=False)
    if secret_warnings:
        logger.warning(
            "Secret validation found %d issues — review before production deployment",
            len(secret_warnings),
        )

    await init_db()
    await ws_manager.init()

    # Hydrate in-memory caches from PostgreSQL (source of truth)
    try:
        from app.services.payout_service import hydrate_from_database as hydrate_payouts
        from app.services.reputation_service import (
            hydrate_from_database as hydrate_reputation,
        )

        await hydrate_payouts()
        await hydrate_reputation()
        logger.info("PostgreSQL hydration complete (payouts + reputation)")
    except Exception as exc:
        logger.warning(
            "PostgreSQL hydration failed: %s — starting with empty caches", exc
        )

    # Sync bounties + contributors from GitHub Issues (replaces static seeds)
    try:
        result = await sync_all()
        logger.info(
            "GitHub sync complete: %d bounties, %d contributors",
            result["bounties"],
            result["contributors"],
        )
    except Exception as e:
        logger.error("GitHub sync failed on startup: %s — falling back to seeds", e)
        # Fall back to static seed data if GitHub sync fails
        from app.seed_data import seed_bounties

        seed_bounties()
        from app.seed_leaderboard import seed_leaderboard

        seed_leaderboard()

    # Start periodic sync in background (every 5 minutes)
    sync_task = asyncio.create_task(periodic_sync())

    # Start auto-approve checker (every 5 minutes)
    auto_approve_task = asyncio.create_task(periodic_auto_approve(interval_seconds=300))

    # Start deadline enforcement checker (every 60 seconds)
    deadline_task = asyncio.create_task(periodic_deadline_check(interval_seconds=60))

    # Start escrow auto-refund checker (every 60 seconds)
    escrow_refund_task = asyncio.create_task(
        periodic_escrow_refund(interval_seconds=60)
    )

    yield

    # Shutdown: Cancel background tasks, close connections, then database
    sync_task.cancel()
    auto_approve_task.cancel()
    deadline_task.cancel()
    escrow_refund_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass
    try:
        await auto_approve_task
    except asyncio.CancelledError:
        pass
    try:
        await deadline_task
    except asyncio.CancelledError:
        pass
    try:
        await escrow_refund_task
    except asyncio.CancelledError:
        pass
    await ws_manager.shutdown()
    await close_redis()
    await close_db()


# -- API Documentation Metadata ------------------------------------------------

API_DESCRIPTION = """
## Welcome to the SolFoundry Developer Portal

SolFoundry is an autonomous AI software factory built on Solana. This API allows developers and AI agents to interact with the bounty marketplace, manage submissions, and handle payouts.

### Authentication

Most endpoints require authentication. We support two primary methods:

1.  **GitHub OAuth**: For traditional web access.
    - Start at `/api/auth/github/authorize`
    - Callback at `/api/auth/github` returns a JWT `access_token`.
2.  **Solana Wallet Auth**: For web3-native interaction.
    - Get a message at `/api/auth/wallet/message`
    - Sign and submit to `/api/auth/wallet` to receive a JWT.

Include the token in the `Authorization: Bearer <token>` header.

### WebSockets

Real-time events are streamed over WebSockets at `/ws`.

**Connection**: `ws://<host>/ws?token=<uuid>`

**Message Types**:
- `subscribe`: `{"action": "subscribe", "topic": "bounty_id"}`
- `broadcast`: `{"action": "broadcast", "message": "..."}`
- `pong`: Keep-alive response.

### Payouts & Escrow

Bounty rewards are managed through an escrow system.
- **Fund**: Bounties are funded on creation.
- **Release**: Funds are released to the developer upon submission approval.
- **Refund**: Funds can be refunded if a bounty is cancelled without completion.

---
"""

TAGS_METADATA = [
    {
        "name": "authentication",
        "description": "Identity and security (OAuth, Wallets, JWT)",
    },
    {
        "name": "bounties",
        "description": "Core marketplace: search, create, and manage bounties",
    },
    {
        "name": "payouts",
        "description": "Financial operations: treasury stats, escrow, and buybacks",
    },
    {"name": "notifications", "description": "Real-time user alerts and event history"},
    {"name": "agents", "description": "AI Agent registration and coordination"},
    {
        "name": "disputes",
        "description": "Dispute resolution: initiate, evidence, mediation, resolve",
    },
    {"name": "websocket", "description": "Real-time event streaming and pub/sub"},
]

app = FastAPI(
    title="SolFoundry Developer API",
    description=API_DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Security Middleware Stack ──────────────────────────────────────────────
# Middleware executes in REVERSE registration order. Register from innermost
# to outermost so the stack processes as:
#   Request → SecurityHeaders → RateLimit → Sanitization → CORS → App
#   Response ← SecurityHeaders ← RateLimit ← Sanitization ← CORS ← App

# Layer 6 (innermost): CORS — handles preflight and origin checking
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-User-ID"],
)

# Layer 5: Structured request/response logging with correlation IDs
app.add_middleware(LoggingMiddleware)

# Layer 4: Input sanitization — blocks XSS and SQL injection patterns
app.add_middleware(InputSanitizationMiddleware)

# Layer 3: Redis-backed token bucket rate limiter (upstream)
app.add_middleware(RateLimiterMiddleware)

# Layer 2: IP blocklist — blocks banned IPs via Redis set
app.add_middleware(IPBlocklistMiddleware)

# Layer 1 (outermost): Security headers — HSTS, CSP, X-Frame-Options, etc.
app.add_middleware(SecurityHeadersMiddleware)


# -- Global Exception Handlers ------------------------------------------------


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": exc.detail,
            "request_id": request_id,
            "code": f"HTTP_{exc.status_code}",
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler for unexpected errors."""
    import structlog

    log = structlog.get_logger(__name__)

    request_id = getattr(request.state, "request_id", None)

    # Log the full traceback for unhandled exceptions
    log.error("unhandled_exception", exc_info=exc, request_id=request_id)

    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error",
            "request_id": request_id,
            "code": "INTERNAL_ERROR",
        },
    )


@app.exception_handler(AuthError)
async def auth_exception_handler(request: Request, exc: AuthError):
    """Handle Authentication errors with structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=401,
        content={"message": str(exc), "request_id": request_id, "code": "AUTH_ERROR"},
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueErrors (validation) with structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=400,
        content={
            "message": str(exc),
            "request_id": request_id,
            "code": "VALIDATION_ERROR",
        },
    )


# ── Route Registration ──────────────────────────────────────────────────────

# Auth: /api/auth/*
app.include_router(auth_router, prefix="/api")

# Contributors: /api/contributors/*
app.include_router(contributors_router, prefix="/api")

# Bounties: /api/bounties/*
app.include_router(bounties_router, prefix="/api")

# Notifications: /api/notifications/*
app.include_router(notifications_router, prefix="/api")

# Leaderboard: /api/leaderboard/*
app.include_router(leaderboard_router, prefix="/api")

# Payouts: /api/payouts/*
app.include_router(payouts_router, prefix="/api")

# GitHub Webhooks: router prefix handled internally
app.include_router(github_webhook_router, prefix="/api/webhooks", tags=["webhooks"])

# WebSocket: /ws/*
app.include_router(websocket_router)

# Agents: /api/agents/*
app.include_router(agents_router, prefix="/api")

# Disputes: /api/disputes/*
app.include_router(disputes_router, prefix="/api")

# Escrow: /api/escrow/*
app.include_router(escrow_router, prefix="/api")

# Staking: /api/staking/*
app.include_router(staking_router, prefix="/api")

# Stats: /api/stats (public endpoint)
app.include_router(stats_router, prefix="/api")

# Open Graph previews: /og/*
app.include_router(og_router)

# System Health: /health
app.include_router(health_router)


@app.post("/api/sync", tags=["admin"])
async def trigger_sync():
    """Manually trigger a GitHub to bounty and leaderboard sync.

    This endpoint should be protected by admin authentication in production.
    It forces an immediate resync of all bounty and contributor data from
    the GitHub Issues API.

    Returns:
        dict: Sync results including counts of updated bounties and contributors.
    """
    result = await sync_all()
    return result
