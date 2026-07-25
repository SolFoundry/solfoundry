"""SolFoundry Discord Bot — FastAPI application."""

from __future__ import annotations

import asyncio
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router, get_bot
from .config import settings

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifecycle ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle handler."""
    logger.info(
        "Starting %s (poll interval: %ds)",
        settings.service_name,
        settings.poll_interval_seconds,
    )

    bot = get_bot()

    # Start Discord bot in background
    if settings.discord_token:
        logger.info("Starting Discord bot...")
        bot_task = asyncio.create_task(bot.start(settings.discord_token))
    else:
        logger.warning("No Discord token configured. Bot will not connect.")
        bot_task = None

    yield

    # Cleanup
    if bot_task and bot.is_ready():
        logger.info("Shutting down Discord bot...")
        await bot.close()
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass

    logger.info("Shutting down %s", settings.service_name)


# ── Application factory ──────────────────────────────────────────────────────
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="SolFoundry Discord Bot",
        description="Discord bot that posts new bounties to a channel, displays "
                    "live leaderboard rankings, and allows users to filter notifications.",
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