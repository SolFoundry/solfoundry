"""SolFoundry Telegram Bot — FastAPI application."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router, bot
from .config import settings

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Background poller ────────────────────────────────────────────────────────
_poll_task: asyncio.Task[None] | None = None


async def background_poller() -> None:
    """Background task that polls for new bounties periodically."""
    logger.info("Starting background poller (interval: %ds)", settings.poll_interval_seconds)
    while True:
        try:
            posted = await bot.poll_and_post()
            if posted:
                logger.info("Background poll: posted %d new bounties", posted)
        except Exception as e:
            logger.error("Background poll error: %s", e)
        await asyncio.sleep(settings.poll_interval_seconds)


# ── Lifecycle ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle handler."""
    global _poll_task

    logger.info(
        "Starting %s (poll interval: %ds)",
        settings.service_name,
        settings.poll_interval_seconds,
    )

    # Start background poller
    _poll_task = asyncio.create_task(background_poller())

    yield

    # Cleanup
    if _poll_task:
        _poll_task.cancel()
        try:
            await _poll_task
        except asyncio.CancelledError:
            pass
    await bot.close()
    logger.info("Shutting down %s", settings.service_name)


# ── Application factory ──────────────────────────────────────────────────────
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="SolFoundry Telegram Bot",
        description="Telegram bot that posts new bounties to a dedicated channel "
                    "with filtering options and inline keyboard buttons.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api/v1")

    return app


app = create_app()


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )