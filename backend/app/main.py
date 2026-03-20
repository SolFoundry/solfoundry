"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.api.auth import router as auth_router
from app.api.contributors import router as contributors_router
from app.api.bounties import router as bounties_router
from app.api.notifications import router as notifications_router
from app.api.leaderboard import router as leaderboard_router
from app.api.payouts import router as payouts_router
from app.api.webhooks.github import router as github_webhook_router
from app.api.websocket import router as websocket_router
from app.api.developer_guide import router as docs_router
from app.database import init_db, close_db
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAPI Metadata
# ---------------------------------------------------------------------------

_DESCRIPTION = """
## SolFoundry Developer API

SolFoundry is an **autonomous AI software factory** on Solana — a permissionless
bounty marketplace where contributors earn $FNDRY tokens for shipping code.

---

### Quick Start

```bash
# 1. Authenticate via GitHub OAuth
GET /auth/github/authorize           # → redirect user to returned authorize_url
POST /auth/github  { "code": "..." } # → { access_token, refresh_token, user }

# 2. Use the token in subsequent requests
Authorization: Bearer <access_token>

# 3. Browse and claim bounties
GET /api/bounties?status=open
POST /api/bounties/{id}/submit  { "pr_url": "...", "submitted_by": "user" }
```

See [`/docs/getting-started`](/docs/getting-started) for the full developer guide.

---

### Authentication

SolFoundry supports two auth methods that both return the same JWT tokens:

| Method | Description |
|--------|-------------|
| **GitHub OAuth** | Sign in with your GitHub account |
| **Solana Wallet** | Sign a challenge message with your Solana wallet |

Access tokens expire after **1 hour**. Use `POST /auth/refresh` with your
refresh token (valid 7 days) to obtain a new access token without re-authenticating.

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

---

### Rate Limits

| Scope | Limit |
|-------|-------|
| REST API (anonymous) | 60 req / min |
| REST API (authenticated) | 300 req / min |
| WebSocket messages | 100 msg / 60 s per connection |

Rate-limit responses return HTTP **429** with a `Retry-After` header.

---

### Standard Error Responses

All errors follow this shape:
```json
{ "detail": "human-readable error message" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid authentication token |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate transaction hash) |
| 422 | Unprocessable entity (request body schema violation) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

### WebSocket

Real-time events are delivered via WebSocket at `wss://api.solfoundry.org/ws`.

```
ws://host/ws?token=<user-uuid>
```

**Message Types (client → server):**

| type | fields | description |
|------|--------|-------------|
| `subscribe` | `channel`, `token` | Subscribe to a named channel |
| `unsubscribe` | `channel` | Unsubscribe from a channel |
| `broadcast` | `channel`, `data`, `token` | Publish data to channel subscribers |
| `pong` | — | Heartbeat reply to server `ping` |

**Message Types (server → client):**

| type | fields | description |
|------|--------|-------------|
| `ping` | — | Heartbeat — reply with `pong` |
| `subscribed` | `channel` | Subscription confirmed |
| `unsubscribed` | `channel` | Unsubscription confirmed |
| `broadcasted` | `channel`, `recipients` | Broadcast acknowledged |
| `error` | `detail` | Error detail |

**Channel naming conventions:**

| Channel | Events |
|---------|--------|
| `bounty:<id>` | Bounty status changes, new submissions |
| `user:<id>` | Personal notifications, payout confirmations |
| `global` | Platform-wide announcements |

---

### Escrow & Payouts

Bounty rewards are managed through an on-chain escrow:

1. Bounty creator funds escrow when creating a bounty
2. Reward is locked until a submission is approved
3. `POST /api/payouts` records the on-chain payout after approval
4. Treasury stats at `GET /api/treasury` reflect real-time balances

---

### $FNDRY Tokenomics

| Metric | Value |
|--------|-------|
| Token | FNDRY |
| Contract | `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS` |
| Total Supply | 1,000,000,000 |

See `GET /api/tokenomics` for live distribution data.
"""

_TAGS_METADATA = [
    {
        "name": "authentication",
        "description": (
            "GitHub OAuth 2.0 and Solana wallet authentication. "
            "All flows return JWT access + refresh tokens. "
            "Access tokens expire in 1 hour; refresh tokens in 7 days."
        ),
    },
    {
        "name": "bounties",
        "description": (
            "Create, list, search, and manage bounties. "
            "Submit pull-request solutions and track submission status. "
            "Supports full-text search, skill-based filtering, and relevance ranking."
        ),
    },
    {
        "name": "contributors",
        "description": (
            "Contributor profiles including skills, badges, and earnings history."
        ),
    },
    {
        "name": "leaderboard",
        "description": (
            "Ranked contributor leaderboard by $FNDRY earned. "
            "Filter by time period (7d / 30d / all), tier, and skill category."
        ),
    },
    {
        "name": "notifications",
        "description": (
            "Per-user notification inbox. "
            "Requires authentication. "
            "Notification types: bounty_claimed, pr_submitted, review_complete, "
            "payout_sent, bounty_expired, rank_changed."
        ),
    },
    {
        "name": "payouts",
        "description": (
            "Record and query on-chain bounty payouts (SOL or $FNDRY). "
            "Each payout references the Solana transaction hash for on-chain verification."
        ),
    },
    {
        "name": "treasury",
        "description": (
            "Live treasury balance, buyback history, and $FNDRY tokenomics. "
            "Treasury wallet balances are fetched from the Solana RPC in real time."
        ),
    },
    {
        "name": "websocket",
        "description": (
            "Real-time event streaming over WebSocket. "
            "Connect at `ws://host/ws?token=<uuid>`. "
            "Supports channel-based pub/sub with Redis backend (in-memory fallback)."
        ),
    },
    {
        "name": "webhooks",
        "description": (
            "Inbound GitHub webhook processor. "
            "Handles `pull_request`, `issues`, and `ping` events. "
            "All requests are verified with HMAC-SHA256 using `X-Hub-Signature-256`."
        ),
    },
    {
        "name": "admin",
        "description": "Internal admin endpoints (sync triggers, health checks).",
    },
]


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
    title="SolFoundry API",
    description=_DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    contact={
        "name": "SolFoundry Developer Support",
        "url": "https://github.com/solfoundry/solfoundry",
        "email": "dev@solfoundry.org",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=_TAGS_METADATA,
    swagger_ui_parameters={
        "deepLinking": True,
        "persistAuthorization": True,
        "displayRequestDuration": True,
        "syntaxHighlight.theme": "monokai",
        "tryItOutEnabled": True,
        "filter": True,
        "docExpansion": "list",
        "defaultModelsExpandDepth": 2,
        "defaultModelExpandDepth": 3,
    },
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

# Developer guide: /docs/*
app.include_router(docs_router)


@app.get(
    "/health",
    tags=["admin"],
    summary="Health check",
    description=(
        "Returns the current health status of the API, including the number of "
        "bounties and contributors in memory and the timestamp of the last GitHub sync."
    ),
    responses={
        200: {
            "description": "API is healthy",
            "content": {
                "application/json": {
                    "example": {
                        "status": "ok",
                        "bounties": 42,
                        "contributors": 18,
                        "last_sync": "2024-01-15T10:30:00Z",
                    }
                }
            },
        }
    },
)
async def health_check():
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


@app.post(
    "/api/sync",
    tags=["admin"],
    summary="Trigger GitHub sync",
    description=(
        "Manually trigger a full sync of bounties and contributors from GitHub Issues. "
        "This is normally run automatically every 5 minutes. "
        "Returns the number of bounties and contributors synced."
    ),
    responses={
        200: {
            "description": "Sync complete",
            "content": {
                "application/json": {
                    "example": {"bounties": 42, "contributors": 18}
                }
            },
        }
    },
)
async def trigger_sync():
    """Manually trigger a GitHub → bounty/leaderboard sync."""
    result = await sync_all()
    return result


# ---------------------------------------------------------------------------
# Custom OpenAPI schema — inject Bearer security scheme
# ---------------------------------------------------------------------------


def _custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        contact=app.contact,
        license_info=app.license_info,
        tags=app.openapi_tags,
        routes=app.routes,
    )

    # Add Bearer JWT security scheme
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": (
                "JWT access token obtained from `/auth/github` or `/auth/wallet`. "
                "Expires in 1 hour. Use `/auth/refresh` to get a new token."
            ),
        }
    }

    # Apply BearerAuth globally to all operations that use Depends(get_current_user_id)
    _AUTH_PATHS = {
        "/auth/link-wallet",
        "/auth/me",
        "/api/notifications",
        "/api/notifications/unread-count",
        "/api/notifications/read-all",
    }
    for path, path_item in schema.get("paths", {}).items():
        for method, operation in path_item.items():
            if method in ("get", "post", "patch", "delete", "put"):
                tags = operation.get("tags", [])
                if "notifications" in tags or path in _AUTH_PATHS:
                    operation.setdefault("security", [{"BearerAuth": []}])

    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = _custom_openapi
