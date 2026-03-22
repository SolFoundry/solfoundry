"""Telegram notification service."""

import asyncio
import logging
import os
import re
import httpx

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


def _sanitize_telegram_text(text: str) -> str:
    """Sanitize text for Telegram MarkdownV2 format."""
    sanitized = re.sub(r"[<>&]", "", text)
    for char in r"_*[]()~`>#+-=|{}.!":
        sanitized = sanitized.replace(char, f"\\{char}")
    return sanitized[:4000]


async def send_telegram_notification(message: str) -> None:
    """Send a sanitized Telegram notification."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.debug("Telegram not configured, skipping notification")
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": _sanitize_telegram_text(message),
                },
            )
    except Exception as error:
        logger.warning("Telegram notification failed: %s", error)
