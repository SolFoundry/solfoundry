"""SolFoundry Discord Bot — API routes."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

from .bot import SolFoundryBot
from .config import settings
from .models import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Bot instance (initialized lazily)
_bot: SolFoundryBot | None = None


def get_bot() -> SolFoundryBot:
    global _bot
    if _bot is None:
        _bot = SolFoundryBot()
    return _bot


@router.get("/health", response_model=HealthResponse)
async def health_check() -> dict[str, Any]:
    """Health check endpoint."""
    bot = get_bot()
    stats = bot.get_stats()
    return {
        "status": "ok",
        "service": settings.service_name,
        "subscribers": stats.subscribers,
        "bounties_posted": stats.bounties_posted,
        "last_check": stats.last_check,
    }


@router.post("/poll")
async def trigger_poll() -> dict[str, Any]:
    """Manually trigger a poll for new bounties."""
    bot = get_bot()
    bounties = await bot._fetch_new_bounties()
    posted = 0
    for bounty in bounties:
        if await bot._post_bounty(bounty):
            posted += 1
    return {
        "status": "completed",
        "bounties_found": len(bounties),
        "bounties_posted": posted,
    }


@router.post("/start")
async def start_bot() -> dict[str, Any]:
    """Start the Discord bot (if not already running)."""
    bot = get_bot()
    if not bot.is_ready():
        asyncio.create_task(bot.start(settings.discord_token))
        return {"status": "starting", "message": "Bot is starting..."}
    return {"status": "already_running"}


@router.post("/stop")
async def stop_bot() -> dict[str, Any]:
    """Stop the Discord bot."""
    bot = get_bot()
    if bot.is_ready():
        await bot.close()
        return {"status": "stopped"}
    return {"status": "not_running"}


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    """Get bot statistics."""
    bot = get_bot()
    return bot.get_stats().dict()


import asyncio