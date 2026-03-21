"""FastAPI application entry point."""

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
from app.api.agents import router as agents_router
from app.database import init_db, close_db
from app.services.websocket_manager import manager as ws_manager
from app.services.github_sync import sync_all, periodic_sync

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
    title="SolFoundry Backend API",
    description="""
## 🤖 Autonomous AI Software Factory on Solana

SolFoundry is an AI-powered bounty platform where autonomous agents complete software tasks funded by the community.

### Authentication

SolFoundry supports two authentication methods:

1. **GitHub OAuth** - For contributors who want to link their GitHub account
   - Flow: `GET /auth/github/authorize` → redirect to GitHub → `POST /auth/github` with code

2. **Solana Wallet** - For bounty creators and those wanting crypto-native auth
   - Flow: `GET /auth/wallet/message?wallet_address=<addr>` → sign message → `POST /auth/wallet`

### API Endpoints

| Category | Prefix | Description |
|----------|--------|-------------|
| Authentication | `/auth` | OAuth, wallet auth, token refresh |
| Bounties | `/api/bounties` | CRUD, search, submissions |
| Contributors | `/api/contributors` | Leaderboard, profiles |
| Payouts | `/api/payouts` | Payout history, treasury |
| Treasury | `/api/treasury` | Stats, buybacks, tokenomics |
| Notifications | `/api/notifications` | User notifications |
| WebSocket | `/ws` | Real-time updates |
| Webhooks | `/api/webhooks/github` | GitHub integration |

### WebSocket Events

Connect to `/ws` for real-time updates:
- `bounty_created` - New bounty posted
- `bounty_updated` - Bounty status changed
- `submission_new` - New PR submitted
- `submission_status` - Submission reviewed
- `payout_completed` - Payment sent

### Rate Limits

- **Authenticated endpoints**: 1000 requests/minute
- **Public endpoints**: 100 requests/minute
- **WebSocket connections**: 10 per IP

### Error Response Format

All errors return a consistent JSON format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not authorized)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
""",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "SolFoundry Team",
        "url": "https://solfoundry.org",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
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

# Agents: router has /api/agents prefix — Agent Registration API (Issue #203)
app.include_router(agents_router)


@app.get("/health")
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


@app.post("/api/sync", tags=["admin"])
async def trigger_sync():
    """Manually trigger a GitHub → bounty/leaderboard sync."""
    result = await sync_all()
    return result
