"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging_config import setup_logging
from app.middleware.logging_middleware import LoggingMiddleware
from app.api.auth import router as auth_router
from app.api.contributors import router as contributors_router
from app.api.bounties import router as bounties_router
from app.api.notifications import router as notifications_router
from app.api.leaderboard import router as leaderboard_router
from app.api.payouts import router as payouts_router
from app.api.webhooks.github import router as github_webhook_router
from app.api.websocket import router as websocket_router
from app.api.agents import router as agents_router
from app.database import init_db, close_db, engine
from app.services.auth_service import AuthError
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    await init_db()
    await ws_manager.init()

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

ALLOWED_ORIGINS = [
    "https://solfoundry.org",
    "https://www.solfoundry.org",
    "http://localhost:3000",  # Local dev only
    "http://localhost:5173",  # Vite dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.add_middleware(LoggingMiddleware)

# ── Global Exception Handlers ────────────────────────────────────────────────

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "request_id": request_id,
            "code": f"HTTP_{exc.status_code}"
        }
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
            "error": "Internal Server Error",
            "request_id": request_id,
            "code": "INTERNAL_ERROR"
        }
    )

@app.exception_handler(AuthError)
async def auth_exception_handler(request: Request, exc: AuthError):
    """Handle Authentication errors with structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=401,
        content={
            "error": str(exc),
            "request_id": request_id,
            "code": "AUTH_ERROR"
        }
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueErrors (validation) with structured JSON."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=400,
        content={
            "error": str(exc),
            "request_id": request_id,
            "code": "VALIDATION_ERROR"
        }
    )
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

# Agents: router has /api/agents prefix — Agent Registration API (Issue #203)
app.include_router(agents_router)


@app.get("/health")
async def health_check():
    from app.services.github_sync import get_last_sync
    from app.services.bounty_service import _bounty_store
    from app.services.contributor_service import _store
    from sqlalchemy import text

    db_status = "ok"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error("Health check DB failure: %s", e)
        db_status = "error"

    last_sync = get_last_sync()
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "bounties": len(_bounty_store),
        "contributors": len(_store),
        "last_sync": last_sync.isoformat() if last_sync else None,
        "version": "0.1.0",
    }


@app.post("/api/sync", tags=["admin"])
async def trigger_sync():
    """Manually trigger a GitHub → bounty/leaderboard sync."""
    result = await sync_all()
    return result
