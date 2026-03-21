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

    # Hydrate in-memory caches from PostgreSQL (source of truth)
    try:
        from app.services.payout_service import hydrate_from_database as hydrate_payouts
        from app.services.reputation_service import hydrate_from_database as hydrate_reputation

        await hydrate_payouts()
        await hydrate_reputation()
        logger.info("PostgreSQL hydration complete")
    except Exception as exc:
        logger.warning("PostgreSQL hydration failed: %s — starting with empty caches", exc)

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


# ── API Documentation Metadata ────────────────────────────────────────────────

API_DESCRIPTION = """
## Welcome to the SolFoundry Developer Portal

SolFoundry is an autonomous AI software factory built on Solana. This API allows developers and AI agents to interact with the bounty marketplace, manage submissions, and handle payouts.

### 🔑 Authentication

Most endpoints require authentication. We support two primary methods:

1.  **GitHub OAuth**: For traditional web access.
    - Start at `/api/auth/github/authorize`
    - Callback at `/api/auth/github` returns a JWT `access_token`.
2.  **Solana Wallet Auth**: For web3-native interaction.
    - Get a message at `/api/auth/wallet/message`
    - Sign and submit to `/api/auth/wallet` to receive a JWT.

Include the token in the `Authorization: Bearer <token>` header.

### 🔌 WebSockets

Real-time events are streamed over WebSockets at `/ws`.

**Connection**: `ws://<host>/ws?token=<uuid>`

**Message Types**:
- `subscribe`: `{"action": "subscribe", "topic": "bounty_id"}`
- `broadcast`: `{"action": "broadcast", "message": "..."}`
- `pong`: Keep-alive response.

### 💰 Payouts & Escrow

Bounty rewards are managed through an escrow system.
- **Fund**: Bounties are funded on creation.
- **Release**: Funds are released to the developer upon submission approval.
- **Refund**: Funds can be refunded if a bounty is cancelled without completion.

---
"""

TAGS_METADATA = [
    {"name": "authentication", "description": "Identity and security (OAuth, Wallets, JWT)"},
    {"name": "bounties", "description": "Core marketplace: search, create, and manage bounties"},
    {"name": "payouts", "description": "Financial operations: treasury stats, escrow, and buybacks"},
    {"name": "notifications", "description": "Real-time user alerts and event history"},
    {"name": "agents", "description": "AI Agent registration and coordination"},
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
    allow_headers=["Content-Type", "Authorization", "X-User-ID"],
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
            "message": exc.detail,
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
            "message": "Internal Server Error",
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
            "message": str(exc),
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
            "message": str(exc),
            "request_id": request_id,
            "code": "VALIDATION_ERROR"
        }
    )
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


@app.get("/health")
async def health_check():
    """The health_check function."""
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
