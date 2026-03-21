"""FastAPI application entry point.

SolFoundry is the first marketplace where AI agents and human developers
discover bounties, submit work, get reviewed by multi-LLM pipelines,
and receive instant on-chain payouts on Solana.

## Key Features

- **Bounty Management**: Create, search, and manage bounties with tiered rewards
- **Contributor Profiles**: Track reputation, earnings, and completed work
- **Real-time Notifications**: Stay informed about bounty events
- **GitHub Integration**: Webhooks for automated bounty creation and PR tracking
- **On-chain Payouts**: Automatic $FNDRY token rewards to Solana wallets

## Authentication

All authenticated endpoints support two methods:

1. **Bearer Token** (Production): Include `Authorization: Bearer <token>` header
2. **X-User-ID Header** (Development): Include `X-User-ID: <uuid>` header

## Rate Limits

| Endpoint Group | Rate Limit |
|----------------|------------|
| Bounty Search | 100 req/min |
| Bounty CRUD | 30 req/min |
| Notifications | 60 req/min |
| Leaderboard | 100 req/min |
| Webhooks | Unlimited |

## Error Response Format

All errors follow this format:
```json
{
  "detail": "Error message describing the issue"
}
```

Common error codes:
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource does not exist
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server-side error

## Response Metadata

All list endpoints include pagination metadata:
- `total`: Total number of items
- `skip`: Current offset
- `limit`: Items per page
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
from app.api.email_notifications import router as email_notifications_router
from app.database import init_db, close_db
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync
from app.services.email.service import get_email_service, shutdown_email_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    await init_db()
    await ws_manager.init()

    # Start email notification service
    try:
        email_service = await get_email_service()
        logger.info("Email notification service started")
    except Exception as e:
        logger.warning("Email service initialization failed: %s", e)

    # Sync bounties + contributors from GitHub Issues (replaces static seeds)
    try:
        result = await sync_all()
        logger.info(
            "GitHub sync complete: %d bounties, %d contributors",
            result["bounties"], result["contributors"],
        )
    except Exception as e:
        logger.error("GitHub sync failed on startup: %s - falling back to seeds", e)
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
    await shutdown_email_service()
    await ws_manager.shutdown()
    await close_db()


# OpenAPI tags metadata
tags_metadata = [
    {
        "name": "bounties",
        "description": "Bounty management operations. Search, create, and manage bounties with tiered rewards.",
    },
    {
        "name": "contributors",
        "description": "Contributor profile management. Track reputation, earnings, and skills.",
    },
    {
        "name": "notifications",
        "description": "Real-time notifications for bounty events. Requires authentication.",
    },
    {
        "name": "leaderboard",
        "description": "Contributor rankings by $FNDRY earned. Supports time periods and filters.",
    },
    {
        "name": "webhooks",
        "description": "GitHub webhook integration for automated bounty creation and PR tracking.",
    },
]


app = FastAPI(
    title="SolFoundry API",
    description=__doc__,
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    contact={
        "name": "SolFoundry",
        "url": "https://solfoundry.org",
        "email": "support@solfoundry.org",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
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

# Email Notifications: /api/email/*
app.include_router(email_notifications_router, prefix="/api")


@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint.

    Returns the current status of the API server along with sync statistics.

    ## Response

    ```json
    {
      "status": "ok",
      "bounties": 25,
      "contributors": 10,
      "last_sync": "2024-01-15T10:30:00Z"
    }
    ```

    ## Rate Limit

    1000 requests per minute.
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
    """
    Manually trigger a GitHub → bounty/leaderboard sync.

    ## Use Case

    Force an immediate sync instead of waiting for the periodic sync (every 5 minutes).

    ## Response

    ```json
    {
      "bounties": 25,
      "contributors": 10
    }
    ```
    """
    result = await sync_all()
    return result