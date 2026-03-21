"""FastAPI application entry point."""

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
from app.services.websocket_manager import manager as ws_manager


from backend.src.middleware.logging import setup_logging
from backend.src.middleware.logging import StructuredLoggingMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    # Startup: Initialize database, seed data, and WebSocket manager
    setup_logging(log_dir='logs', max_bytes=10485760, backup_count=5)
    await init_db()
    from app.seed_data import seed_bounties
    seed_bounties()
    from app.seed_leaderboard import seed_leaderboard
    seed_leaderboard()
    await ws_manager.init()
    yield
    # Shutdown: Close WebSocket connections, then database
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

app.add_middleware(StructuredLoggingMiddleware)

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



from app.database import engine
from sqlalchemy import text

@app.get("/health")
async def health_check():
    health = {
        "status": "ok",
        "dependencies": {
            "database": "unknown",
            "websocket": "unknown"
        }
    }
    
    # Check DB
    try:
        if engine is not None:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            health["dependencies"]["database"] = "ok"
    except Exception:
        health["dependencies"]["database"] = "degraded"
        health["status"] = "degraded"
        
    # Check WS
    try:
        from app.services.websocket_manager import manager as ws_manager
        if hasattr(ws_manager, "active_connections"):
            health["dependencies"]["websocket"] = "ok"
    except Exception:
        health["dependencies"]["websocket"] = "degraded"
        health["status"] = "degraded"
        
    return health

