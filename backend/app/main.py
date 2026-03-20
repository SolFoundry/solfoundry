"""FastAPI application entry point.

This module initializes the FastAPI application with:
- Structured logging with correlation IDs
- Global error handling middleware
- Health check endpoints with dependency status
- CORS middleware for cross-origin requests
- API routers for all endpoints
"""

import asyncio
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
from app.core.logging_config import setup_logging_with_cleanup, get_logger
from app.core.middleware import (
    ErrorHandlingMiddleware,
    CorrelationIdMiddleware,
    AccessLoggingMiddleware,
)
from app.core.health import router as health_router
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync

# Initialize logging system with log cleanup
setup_logging_with_cleanup()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown.
    
    Startup:
    - Initialize database connection and schema
    - Initialize WebSocket manager
    - Sync bounties + contributors from GitHub Issues
    - Start periodic sync background task
    - Log application startup
    
    Shutdown:
    - Cancel background sync task
    - Close WebSocket connections
    - Close database connections
    - Log application shutdown
    """
    logger.info(
        "Application starting up",
        extra={"extra_data": {
            "version": "0.1.0",
            "environment": "development",
        }}
    )
    
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized successfully")
        
        # Initialize WebSocket manager
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
        
    finally:
        # Cleanup
        logger.info("Application shutting down")
        await close_db()
        logger.info("Database connections closed")


# Create FastAPI application
app = FastAPI(
    title="SolFoundry Backend",
    description="Autonomous AI Software Factory on Solana",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
ALLOWED_ORIGINS = [
    "https://solfoundry.dev",
    "https://www.solfoundry.dev",
    "https://solfoundry.org",
    "https://www.solfoundry.org",
    "http://localhost:3000",  # Local dev only
    "http://localhost:5173",  # Vite dev server
]

# Add CORS middleware (order matters - must be before other middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Correlation-ID",
        "X-Request-ID",
    ],
)

# Add custom middleware (order matters - last added runs first)
# 1. Correlation ID middleware - adds request tracing
app.add_middleware(CorrelationIdMiddleware)

# 2. Access logging middleware - logs all requests
app.add_middleware(AccessLoggingMiddleware)

# 3. Error handling middleware - catches all exceptions
app.add_middleware(ErrorHandlingMiddleware)


# ── Route Registration ──────────────────────────────────────────────────────
# Health check endpoints (no prefix)
app.include_router(health_router)

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
    """Health check endpoint with sync status."""
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
    """Manually trigger a GitHub → bounty/leaderboard sync."""
    result = await sync_all()
    return result