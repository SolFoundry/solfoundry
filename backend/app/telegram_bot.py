"""SolFoundry Telegram Bot for bounty notifications.

Posts new bounties to a Telegram channel with inline keyboard buttons
for bounty details and claiming. Supports user subscription management.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class SolFoundryTelegramBot:
    """Telegram bot that posts new bounties and manages subscriptions."""

    def __init__(self, token: str, channel_id: str):
        self.token = token
        self.channel_id = channel_id
        self.base_url = f"https://api.telegram.org/bot{token}"
        self.http = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.http.aclose()

    # --- Core API Methods ---

    async def send_message(
        self,
        chat_id: str,
        text: str,
        parse_mode: str = "HTML",
        reply_markup: Optional[dict] = None,
    ) -> dict:
        """Send a message to a chat."""
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        resp = await self.http.post(f"{self.base_url}/sendMessage", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def edit_message(
        self,
        chat_id: str,
        message_id: int,
        text: str,
        parse_mode: str = "HTML",
        reply_markup: Optional[dict] = None,
    ) -> dict:
        """Edit an existing message."""
        payload = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        resp = await self.http.post(f"{self.base_url}/editMessageText", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
    ) -> dict:
        """Answer a callback query from inline button press."""
        payload = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text

        resp = await self.http.post(f"{self.base_url}/answerCallbackQuery", json=payload)
        resp.raise_for_status()
        return resp.json()

    # --- Bounty Notification ---

    async def post_new_bounty(
        self,
        bounty_id: int,
        title: str,
        tier: str,
        reward: str,
        skills: list[str],
        deadline: Optional[str],
        bounty_url: str,
    ) -> dict:
        """Post a new bounty notification to the channel."""
        tier_emoji = {"T1": "🟢", "T2": "🟡", "T3": "🟣"}.get(tier, "⚪")
        skills_str = " · ".join(skills[:5]) if skills else "Various"
        deadline_str = f"\n⏰ Deadline: {deadline}" if deadline else ""

        text = f"""
🔨 <b>New Bounty Available!</b>

{tier_emoji} <b>{title}</b>
💰 Reward: <b>{reward} $FNDRY</b>
🏷 Tier: {tier}
🔧 Skills: {skills_str}{deadline_str}

🔗 {bounty_url}
""".strip()

        # Inline keyboard
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "📋 View Details", "url": bounty_url},
                    {"text": "⚡ Quick Claim", "callback_data": f"claim:{bounty_id}"},
                ],
                [
                    {"text": f"🔔 Subscribe to {tier}", "callback_data": f"subscribe:{tier}"},
                    {"text": "📊 All Bounties", "url": "https://solfoundry.xyz/bounties"},
                ],
            ]
        }

        return await self.send_message(self.channel_id, text, reply_markup=keyboard)

    async def post_bounty_status_update(
        self,
        bounty_id: int,
        title: str,
        status: str,
        details: str,
        bounty_url: str,
    ) -> dict:
        """Post a bounty status change notification."""
        status_emoji = {
            "approved": "✅",
            "changes_requested": "🔄",
            "merged": "🎉",
            "cancelled": "❌",
        }.get(status, "ℹ️")

        text = f"""
{status_emoji} <b>Bounty Status Update</b>

<b>{title}</b>
Status: <b>{status.replace('_', ' ').title()}</b>
{details}

🔗 {bounty_url}
""".strip()

        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "📋 View Details", "url": bounty_url},
                ],
            ]
        }

        return await self.send_message(self.channel_id, text, reply_markup=keyboard)

    async def post_payout_notification(
        self,
        username: str,
        bounty_title: str,
        amount: str,
        tx_url: str,
    ) -> dict:
        """Post a payout notification."""
        text = f"""
💰 <b>Payout Alert!</b>

🎉 <b>@{username}</b> earned <b>{amount} $FNDRY</b>
for completing: <b>{bounty_title}</b>

🚀 Payout sent to Solana wallet — instant on-chain transfer!
""".strip()

        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "🔍 View Transaction", "url": tx_url},
                    {"text": "🏆 Leaderboard", "url": "https://solfoundry.xyz/leaderboard"},
                ],
            ]
        }

        return await self.send_message(self.channel_id, text, reply_markup=keyboard)

    # --- Callback Handlers ---

    async def handle_callback(self, callback_query: dict) -> None:
        """Handle inline keyboard button callbacks."""
        query_id = callback_query["id"]
        data = callback_query.get("data", "")
        chat_id = str(callback_query["message"]["chat"]["id"])
        user_id = str(callback_query["from"]["id"])
        username = callback_query["from"].get("username", "anonymous")

        if data.startswith("claim:"):
            bounty_id = data.split(":")[1]
            await self.answer_callback_query(
                query_id,
                text=f"🎯 Bounty #{bounty_id} — Fork the repo and submit your PR!",
            )
            logger.info(f"User {username} ({user_id}) claimed bounty #{bounty_id}")

        elif data.startswith("subscribe:"):
            tier = data.split(":")[1]
            # Register subscription (would persist to DB in production)
            await self.answer_callback_query(
                query_id,
                text=f"🔔 Subscribed to {tier} bounties! You'll get notified of new ones.",
            )
            logger.info(f"User {username} ({user_id}) subscribed to {tier}")

        else:
            await self.answer_callback_query(query_id, text="Action received!")

    # --- Webhook Setup ---

    async def set_webhook(self, webhook_url: str) -> dict:
        """Set webhook URL for receiving updates."""
        resp = await self.http.post(
            f"{self.base_url}/setWebhook",
            json={"url": webhook_url, "allowed_updates": ["callback_query"]},
        )
        resp.raise_for_status()
        return resp.json()

    async def get_webhook_info(self) -> dict:
        """Get current webhook info."""
        resp = await self.http.get(f"{self.base_url}/getWebhookInfo")
        resp.raise_for_status()
        return resp.json()


# --- Subscription Manager ---

class SubscriptionManager:
    """Manage user subscriptions to bounty types."""

    def __init__(self):
        # In-memory store; replace with DB
        self._subscriptions: dict[str, set[str]] = {}  # user_id -> set of tiers

    def subscribe(self, user_id: str, tier: str) -> None:
        if user_id not in self._subscriptions:
            self._subscriptions[user_id] = set()
        self._subscriptions[user_id].add(tier)

    def unsubscribe(self, user_id: str, tier: str) -> None:
        if user_id in self._subscriptions:
            self._subscriptions[user_id].discard(tier)

    def get_subscriptions(self, user_id: str) -> set[str]:
        return self._subscriptions.get(user_id, set())

    def get_subscribers_for_tier(self, tier: str) -> list[str]:
        return [
            uid for uid, tiers in self._subscriptions.items()
            if tier in tiers
        ]


# --- FastAPI Integration ---

from fastapi import APIRouter, Request

telegram_router = APIRouter()

# These would be injected via dependency injection in production
_bot: Optional[SolFoundryTelegramBot] = None
_subscriptions = SubscriptionManager()


@telegram_router.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    """Handle incoming Telegram webhook updates."""
    body = await request.json()

    if "callback_query" in body:
        if _bot:
            await _bot.handle_callback(body["callback_query"])

    return {"ok": True}


@telegram_router.post("/bounty/{bounty_id}/notify")
async def notify_new_bounty(bounty_id: int, request: Request):
    """Trigger a bounty notification (called internally)."""
    if not _bot:
        return {"error": "Bot not configured"}

    # In production, fetch bounty data from DB
    # For now, post a placeholder
    await _bot.post_new_bounty(
        bounty_id=bounty_id,
        title=f"Bounty #{bounty_id}",
        tier="T1",
        reward="100,000",
        skills=["Frontend"],
        deadline=None,
        bounty_url=f"https://solfoundry.xyz/bounties/{bounty_id}",
    )
    return {"ok": True}
