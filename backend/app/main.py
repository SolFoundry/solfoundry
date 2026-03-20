"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.contributors import router as contributors_router
from app.api.leaderboard import router as leaderboard_router
from app.api.websocket import router as websocket_router
from app.api.webhooks.github import router as github_webhook_router
from app.services.websocket_service import start_redis_listener


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup: launch Redis pub/sub listener
    task = asyncio.create_task(start_redis_listener())
    yield
    # Shutdown: cancel the listener
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


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
app.include_router(leaderboard_router)
app.include_router(github_webhook_router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(websocket_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
