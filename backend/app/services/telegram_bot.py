"""
Telegram Bot for New Bounty Notifications

Sends formatted Telegram messages when new bounties are created on SolFoundry.
Integrates with the existing background task system and GitHub webhook flow.

Usage:
    from app.services.telegram_bot import send_bounty_notification
    await send_bounty_notification(bounty_data)
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_API_BASE = "https://api.telegram.org"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_configured() -> bool:
    """Return True if both bot token and chat ID are set."""
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)


def _escape_markdown(text: str) -> str:
    """Escape special MarkdownV2 characters for Telegram."""
    special = r"_*[]()~`>#+-=|{}.!"
    for ch in special:
        text = text.replace(ch, "\\" + ch)
    return text


def _format_bounty_message(bounty: dict) -> str:
    """
    Build a Telegram MarkdownV2 message from a bounty dict.

    Expected keys:
        title       — bounty title
        url         — GitHub issue URL
        tier        — tier label (e.g. "tier-1", "tier-2", "tier-3")
        reward      — reward string (e.g. "50000 $FNDRY" or "$500 USDC")
        description — short description (first ~200 chars)
        tags        — list of label strings
    """
    title = _escape_markdown(bounty.get("title", "Untitled Bounty"))
    url = _escape_markdown(bounty.get("url", ""))
    tier = _escape_markdown(bounty.get("tier", "tier-1").upper().replace("-", " "))
    reward = _escape_markdown(bounty.get("reward", "TBD"))
    desc = _escape_markdown(
        (bounty.get("description", "") or "")[:200]
    )
    tags = bounty.get("tags", [])
    tags_str = " ".join(
        _escape_markdown(f"#{t.lower().replace('-', '').replace(' ', '')}")
        for t in tags
    ) if tags else ""

    lines = [
        f"🚀 *New Bounty: {title}*",
        "",
        f"📋 *Tier:* {tier}",
        f"💰 *Reward:* {reward}",
        "",
        f"📝 *Description:*",
        f"{desc}",
        "",
    ]
    if tags_str:
        lines.append(f"🏷️  {tags_str}")
        lines.append("")
    lines.append(f"🔗 [View on GitHub]({url})")
    lines.append("")
    lines.append("⚡ *Ship code\\. Earn \\$FNDRY\\. Level up\\.*")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def send_bounty_notification(bounty: dict) -> bool:
    """
    Send a Telegram notification for a newly created bounty.

    Args:
        bounty: Dict with bounty details (title, url, tier, reward, description, tags).

    Returns:
        True if sent successfully, False otherwise.
    """
    if not _is_configured():
        logger.warning("Telegram not configured — skipping notification")
        return False

    text = _format_bounty_message(bounty)

    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "MarkdownV2",
        "disable_web_page_preview": False,
    }

    url = f"{TELEGRAM_API_BASE}/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if data.get("ok"):
                logger.info(
                    "Telegram notification sent for bounty: %s",
                    bounty.get("title", "?"),
                )
                return True
            else:
                logger.error(
                    "Telegram API error: %s", data.get("description", "unknown")
                )
                return False
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Telegram HTTP error %s: %s",
            exc.response.status_code,
            exc.response.text,
        )
    except httpx.RequestError as exc:
        logger.error("Telegram request failed: %s", exc)
    except Exception as exc:
        logger.exception("Unexpected error sending Telegram notification: %s", exc)

    return False


# ---------------------------------------------------------------------------
# Sync helper (for use in non-async contexts, e.g. background threads)
# ---------------------------------------------------------------------------

def send_bounty_notification_sync(bounty: dict) -> bool:
    """
    Synchronous version of send_bounty_notification.
    Uses httpx directly without async.
    """
    if not _is_configured():
        logger.warning("Telegram not configured — skipping notification")
        return False

    text = _format_bounty_message(bounty)

    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "MarkdownV2",
        "disable_web_page_preview": False,
    }

    url = f"{TELEGRAM_API_BASE}/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if data.get("ok"):
                logger.info(
                    "Telegram notification sent for bounty: %s",
                    bounty.get("title", "?"),
                )
                return True
            else:
                logger.error(
                    "Telegram API error: %s", data.get("description", "unknown")
                )
                return False
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Telegram HTTP error %s: %s",
            exc.response.status_code,
            exc.response.text,
        )
    except httpx.RequestError as exc:
        logger.error("Telegram request failed: %s", exc)
    except Exception as exc:
        logger.exception("Unexpected error sending Telegram notification: %s", exc)

    return False