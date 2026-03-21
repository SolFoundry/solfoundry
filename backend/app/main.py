"""FastAPI application entry point with production security hardening.

This module initializes the FastAPI application with a full security middleware
stack including:
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting with tiered access (anonymous/authenticated/admin)
- Input sanitization (XSS and SQL injection detection)
- CORS with strict origin whitelist
- Sensitive data logging filter

Middleware is applied in reverse order (last added = first executed):
1. SecurityHeadersMiddleware — adds headers to all responses
2. RateLimitMiddleware — enforces request rate limits
3. InputSanitizationMiddleware — scans inputs for attacks
4. CORSMiddleware — handles cross-origin requests

References:
    - OWASP Security Headers: https://owasp.org/www-project-secure-headers/
    - FastAPI Middleware: https://fastapi.tiangolo.com/tutorial/middleware/
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.contributors import router as contributors_router
from app.api.bounties import router as bounties_router
from app.api.notifications import router as notifications_router
from app.api.leaderboard import router as leaderboard_router
from app.api.payouts import router as payouts_router
from app.api.webhooks.github import router as github_webhook_router
from app.api.websocket import router as websocket_router
from app.database import init_db, close_db
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.sanitization import InputSanitizationMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware
from app.services.config_validator import install_log_filter, validate_secrets
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync

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

    # Sync bounties + contributors from GitHub Issues (replaces static seeds)
    try:
        result = await sync_all()
        logger.info(
            "GitHub sync complete: %d bounties, %d contributors",
            result["bounties"], result["contributors"],
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

    yield

    # Shutdown: Cancel background sync, close connections, then database
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass
    await ws_manager.shutdown()
    await close_db()


app = FastAPI(
    title="SolFoundry Backend",
    description="Autonomous AI Software Factory on Solana",
    version="0.1.0",
    lifespan=lifespan,
)

# ── Security Middleware Stack ──────────────────────────────────────────────
# Middleware executes in REVERSE registration order. Register from innermost
# to outermost so the stack processes as:
#   Request → SecurityHeaders → RateLimit → Sanitization → CORS → App
#   Response ← SecurityHeaders ← RateLimit ← Sanitization ← CORS ← App

ALLOWED_ORIGINS: list[str] = [
    "https://solfoundry.org",
    "https://www.solfoundry.org",
    "http://localhost:3000",  # Local dev only
    "http://localhost:5173",  # Vite dev server
]

# Layer 4 (innermost): CORS — handles preflight and origin checking
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Layer 3: Input sanitization — blocks XSS and SQL injection patterns
app.add_middleware(InputSanitizationMiddleware)

# Layer 2: Rate limiting — enforces per-IP and per-endpoint request limits
app.add_middleware(RateLimitMiddleware)

# Layer 1 (outermost): Security headers — HSTS, CSP, X-Frame-Options, etc.
app.add_middleware(SecurityHeadersMiddleware)

# ── Route Registration ──────────────────────────────────────────────────────
# Auth: /auth/* (prefix defined in router)
app.include_router(auth_router)

# Contributors: /contributors/* → needs /api prefix added here
app.include_router(contributors_router, prefix="/api")

# Bounties: router already has /api/bounties prefix — do NOT add another /api
app.include_router(bounties_router)

# Notifications: router has /notifications prefix — add /api here
app.include_router(notifications_router, prefix="/api")

# Leaderboard: router has /api prefix — mounts at /api/leaderboard/*
app.include_router(leaderboard_router)

# Payouts: router has /api prefix — mounts at /api/payouts/*
app.include_router(payouts_router)

# GitHub Webhooks: router prefix handled internally
app.include_router(github_webhook_router, prefix="/api/webhooks", tags=["webhooks"])

# WebSocket: /ws/*
app.include_router(websocket_router)


@app.get("/health")
async def health_check():
    """Return application health status with sync metadata.

    This endpoint is exempt from rate limiting and authentication to support
    external monitoring and load balancer health checks.

    Returns:
        dict: Health status including bounty count, contributor count,
            and last GitHub sync timestamp.
    """
    from app.services.github_sync import get_last_sync
    from app.services.bounty_service import _bounty_store
    from app.services.contributor_service import _store
    last_sync = get_last_sync()
    return {
        "status": "ok",
        "bounties": len(_bounty_store),
        "contributors": len(_store),
        "last_sync": last_sync.isoformat() if last_sync else None,
    }


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
