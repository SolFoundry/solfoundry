"""
SolFoundry Telegram Bot — polling + FastAPI webhook server.

Usage:
    python -m bot.app                          # polling mode
    uvicorn bot.app:app --port 8080           # webhook mode
"""
import asyncio
import logging
import sys
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Request, Response
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    MessageHandler, filters,
)

from bot.config import config
from bot.formatters import format_bounty_notification
from bot.github_client import GitHubClient
from bot.handlers import (
    cmd_start, cmd_help, cmd_leaderboard, cmd_filters,
    cmd_filter, cmd_subscribe, cmd_unsubscribe, cmd_bounty,
    handle_callback,
)
from bot.subscription_store import SubscriptionStore

logging.basicConfig(
    level=getattr(logging, config.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI webhook app
# ─────────────────────────────────────────────────────────────────────────────

app_fastapi = FastAPI(title="SolFoundry Telegram Bot Webhook")
telegram_app: Optional[Application] = None


@app_fastapi.post(config.webhook_path)
async def telegram_webhook(request: Request) -> Response:
    global telegram_app
    if telegram_app is None:
        return Response(status_code=503, content="Bot not initialized")
    try:
        data = await request.json()
        update = Update.de_json(data, telegram_app.bot)
        await telegram_app.process_update(update)
    except Exception:
        logger.exception("Webhook update failed")
    return Response(status_code=200)


@app_fastapi.get("/health")
async def health() -> dict:
    return {"status": "ok", "mode": config.bot_mode}


# ─────────────────────────────────────────────────────────────────────────────
# Bounty polling loop
# ─────────────────────────────────────────────────────────────────────────────

async def poll_bounties(application: Application) -> None:
    """Background task: poll GitHub for new bounties and post to channel."""
    store = SubscriptionStore()
    github = GitHubClient()
    channel_id = config.telegram_channel_id
    logger.info("Bounty polling loop started (interval: 60s)")

    while True:
        try:
            bounties = github.fetch_open_bounties()
            logger.debug("Fetched %d open bounties", len(bounties))

            for bounty in bounties:
                if not bounty.is_open:
                    continue
                if store.is_notified(bounty.number):
                    continue

                text, keyboard = format_bounty_notification(bounty)
                try:
                    await application.bot.send_message(
                        chat_id=channel_id,
                        text=text,
                        parse_mode="HTML",
                        reply_markup=keyboard,
                        disable_web_page_preview=True,
                    )
                    store.mark_notified(bounty.number)
                    logger.info("Notified channel about bounty #%d: %s", bounty.number, bounty.title)
                except Exception as e:
                    logger.error("Failed to send bounty #%d: %s", bounty.number, e)

            store.set_last_check(datetime.now(timezone.utc).isoformat())

        except Exception:
            logger.exception("Polling loop error")

        await asyncio.sleep(60)


# ─────────────────────────────────────────────────────────────────────────────
# Bot setup
# ─────────────────────────────────────────────────────────────────────────────

def build_app() -> Application:
    application = (
        Application.builder()
        .token(config.telegram_bot_token)
        .read_timeout(30)
        .write_timeout(30)
        .build()
    )
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("help", cmd_help))
    application.add_handler(CommandHandler("leaderboard", cmd_leaderboard))
    application.add_handler(CommandHandler("filters", cmd_filters))
    application.add_handler(CommandHandler("filter", cmd_filter))
    application.add_handler(CommandHandler("subscribe", cmd_subscribe))
    application.add_handler(CommandHandler("unsubscribe", cmd_unsubscribe))
    application.add_handler(CommandHandler("bounty", cmd_bounty))
    application.add_handler(CallbackQueryHandler(handle_callback))
    return application


# ─────────────────────────────────────────────────────────────────────────────
# Entrypoints
# ─────────────────────────────────────────────────────────────────────────────

async def run_polling() -> None:
    """Polling mode — development."""
    global telegram_app
    telegram_app = build_app()
    await telegram_app.initialize()
    await telegram_app.start()
    asyncio.create_task(poll_bounties(telegram_app))
    await telegram_app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
    await telegram_app.updater.stop()
    await telegram_app.stop()
    await telegram_app.shutdown()


async def run_webhook() -> None:
    """Webhook mode — production."""
    global telegram_app
    telegram_app = build_app()
    await telegram_app.initialize()
    await telegram_app.start()
    webhook_url = config.full_webhook_url
    await telegram_app.bot.set_webhook(webhook_url)
    logger.info("Webhook set to: %s", webhook_url)
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass
    finally:
        await telegram_app.stop()
        await telegram_app.shutdown()


if __name__ == "__main__":
    errors = config.validate()
    if errors:
        for e in errors:
            print(f"CONFIG ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    mode = config.bot_mode.lower()
    if mode == "polling":
        asyncio.run(run_polling())
    elif mode == "webhook":
        import uvicorn
        uvicorn.run("bot.app:app", host="0.0.0.0", port=8080, reload=False)
    else:
        print(f"Unknown BOT_MODE: {mode}", file=sys.stderr)
        sys.exit(1)
