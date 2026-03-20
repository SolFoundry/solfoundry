"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.contributors import router as contributors_router
from app.api.bounties import router as bounties_router
from app.api.notifications import router as notifications_router
from app.api.leaderboard import router as leaderboard_router
from app.api.payouts import router as payouts_router
from app.api.webhooks.github import router as github_webhook_router
from app.api.websocket import router as websocket_router
from app.database import init_db, close_db
from app.services.websocket_manager import manager as ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    # Startup: Initialize database and WebSocket manager
    await init_db()
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
    "https://solfoundry.dev",
    "https://www.solfoundry.dev",
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

app.include_router(contributors_router)
app.include_router(bounties_router, prefix="/api", tags=["bounties"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(leaderboard_router)
app.include_router(payouts_router)
app.include_router(github_webhook_router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(websocket_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
