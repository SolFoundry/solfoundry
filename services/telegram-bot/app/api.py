"""SolFoundry Telegram Bot — API routes."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from .bot import TelegramBot
from .config import settings
from .models import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()
bot = TelegramBot()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> dict[str, Any]:
    """Health check endpoint."""
    bot_info = await bot.get_me()
    stats = bot.stats
    return {
        "status": "ok",
        "service": settings.service_name,
        "subscribers": stats["subscribers"],
        "bounties_posted": stats["bounties_posted"],
        "last_check": stats["last_check"],
        "bot_name": bot_info.get("first_name", ""),
        "bot_username": bot_info.get("username", ""),
    }


@router.post("/poll")
async def trigger_poll() -> dict[str, Any]:
    """Manually trigger a poll for new bounties."""
    posted = await bot.poll_and_post()
    return {
        "status": "completed",
        "bounties_posted": posted,
        "total_posted": len(bot._bounties_posted),
        "subscribers": len(bot._subscribers),
    }


@router.post("/send")
async def send_custom_message(
    chat_id: str,
    text: str,
    parse_mode: str = "HTML",
) -> dict[str, Any]:
    """Send a custom message to a Telegram chat."""
    result = await bot.send_message(chat_id, text, parse_mode=parse_mode)
    if result:
        return {"status": "sent", "message_id": result.get("message_id")}
    raise HTTPException(status_code=500, detail="Failed to send message")


@router.post("/webhook")
async def handle_webhook(request: Request) -> dict[str, Any]:
    """Handle incoming Telegram webhook updates."""
    try:
        update = await request.json()
        logger.debug("Received webhook update: %s", update)

        # Handle callback query (inline button clicks)
        if "callback_query" in update:
            callback = update["callback_query"]
            data = callback.get("data", "")
            chat_id = callback["message"]["chat"]["id"]
            message_id = callback["message"]["message_id"]

            # Answer callback query to remove loading state
            await bot._telegram_call("answerCallbackQuery", {
                "callback_query_id": callback["id"],
                "text": "Processing...",
            })

            if data.startswith("details:"):
                bounty_id = data.split(":", 1)[1]
                await bot.send_message(
                    chat_id,
                    f"📋 <b>Bounty Details</b>\n\n"
                    f"ID: <code>{bounty_id}</code>\n"
                    f"Check bounty on SolFoundry for full details.",
                    reply_markup={
                        "inline_keyboard": [[{
                            "text": "🔗 Open SolFoundry",
                            "url": "https://solfoundry.org",
                        }]]
                    },
                )

            elif data.startswith("tags:"):
                await bot.send_message(
                    chat_id,
                    "💡 <b>Filter by Tags</b>\n\n"
                    "Use <code>/subscribe</code> to set up bounty filters.\n"
                    "Use <code>/unsubscribe</code> to stop notifications.",
                )

            elif data == "subscribe":
                await bot.subscribe(chat_id)
                await bot.send_message(
                    chat_id,
                    "✅ <b>Subscribed!</b>\n\n"
                    "You'll now receive bounty notifications.\n"
                    "Use <code>/filters</code> to customize your preferences.",
                )

            elif data == "unsubscribe":
                await bot.unsubscribe(chat_id)
                await bot.send_message(
                    chat_id,
                    "✅ <b>Unsubscribed.</b>\n\n"
                    "You won't receive bounty notifications anymore.\n"
                    "Use <code>/subscribe</code> to resubscribe.",
                )

        # Handle /start command
        if "message" in update:
            msg = update["message"]
            chat_id = msg["chat"]["id"]
            text = msg.get("text", "")

            if text == "/start":
                await bot.send_message(
                    chat_id,
                    "<b>🤖 SolFoundry Bounty Bot</b>\n\n"
                    "Get real-time bounty notifications from SolFoundry!\n\n"
                    "<b>Commands:</b>\n"
                    "/subscribe — Subscribe to all bounty notifications\n"
                    "/unsubscribe — Stop receiving bounty notifications\n"
                    "/filters — Set custom filters (min reward, tiers, tags)\n"
                    "/stats — Bot statistics\n"
                    "/help — Show this message",
                    reply_markup={
                        "inline_keyboard": [
                            [{"text": "✅ Subscribe", "callback_data": "subscribe"}],
                            [{"text": "🔗 Open SolFoundry", "url": "https://solfoundry.org"}],
                        ]
                    },
                )

            elif text == "/subscribe":
                await bot.subscribe(chat_id, msg["chat"].get("username", ""))
                await bot.send_message(
                    chat_id,
                    "✅ <b>Subscribed!</b>\n\n"
                    "You'll receive notifications for all new bounties.\n"
                    "Use <code>/filters</code> to customize.",
                )

            elif text == "/unsubscribe":
                await bot.unsubscribe(chat_id)
                await bot.send_message(
                    chat_id,
                    "✅ <b>Unsubscribed.</b>\n\n"
                    "You won't receive bounty notifications.",
                )

            elif text == "/stats":
                stats = bot.stats
                await bot.send_message(
                    chat_id,
                    "<b>📊 Bot Statistics</b>\n\n"
                    f"📨 Bounties posted: {stats['bounties_posted']}\n"
                    f"👥 Subscribers: {stats['subscribers']}\n"
                    f"🕐 Last check: {stats['last_check'] or 'Never'}\n"
                    f"⚠️ Recent errors: {len(stats['recent_errors'])}",
                )

            elif text == "/help":
                await bot.send_message(
                    chat_id,
                    "<b>🤖 SolFoundry Bounty Bot</b>\n\n"
                    "<b>Commands:</b>\n"
                    "/subscribe — Subscribe to bounty notifications\n"
                    "/unsubscribe — Stop notifications\n"
                    "/filters — Set filters (min/max reward, tier, tags)\n"
                    "/stats — View bot statistics\n"
                    "/help — This message\n\n"
                    "<b>Filter format:</b>\n"
                    "<code>/filters min_reward=100 max_reward=1000 tiers=1,2 tags=bounty,backend</code>",
                )

            elif text.startswith("/filters"):
                # Parse filter parameters
                parts = text.split(maxsplit=1)
                filters = {}
                if len(parts) > 1:
                    for pair in parts[1].split():
                        if "=" in pair:
                            key, value = pair.split("=", 1)
                            if key == "tiers":
                                filters[key] = [int(t.strip()) for t in value.split(",") if t.strip().isdigit()]
                            elif key == "tags":
                                filters[key] = [t.strip() for t in value.split(",") if t.strip()]
                            elif key in ("min_reward", "max_reward"):
                                try:
                                    filters[key] = int(value)
                                except ValueError:
                                    pass
                if filters:
                    bot.update_subscription_filters(chat_id, filters)
                    parts = []
                    parts.append("✅ <b>Filters updated!</b>\n\n")
                    if "min_reward" in filters:
                        parts.append(f"Min reward: {filters['min_reward']} $FNDRY\n")
                    if "max_reward" in filters:
                        parts.append(f"Max reward: {filters['max_reward']} $FNDRY\n")
                    if "tiers" in filters:
                        parts.append(f"Tiers: {filters['tiers']}\n")
                    if "tags" in filters:
                        parts.append(f"Tags: {', '.join(filters['tags'])}\n")
                    await bot.send_message(chat_id, "".join(parts),
                    )
                else:
                    await bot.subscribe(chat_id)
                    await bot.send_message(
                        chat_id,
                        "ℹ️ <b>Filter Usage:</b>\n\n"
                        "<code>/filters min_reward=100 max_reward=1000 tiers=1,2 tags=bounty,backend</code>\n\n"
                        "All fields are optional.",
                    )

        return {"status": "ok"}
    except Exception as e:
        logger.error("Webhook handler error: %s", e)
        return {"status": "error", "message": str(e)}


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    """Get bot statistics."""
    return bot.stats


@router.post("/subscribe")
async def subscribe_user(chat_id: int, username: str = "") -> dict[str, Any]:
    """Subscribe a user to bounty notifications."""
    success = await bot.subscribe(chat_id, username)
    return {"status": "subscribed" if success else "already_subscribed"}


@router.post("/unsubscribe")
async def unsubscribe_user(chat_id: int) -> dict[str, Any]:
    """Unsubscribe a user from bounty notifications."""
    success = await bot.unsubscribe(chat_id)
    return {"status": "unsubscribed" if success else "not_found"}