"""SolFoundry Telegram Bot — Telegram bot logic."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from .config import settings
from .models import BountyItem, BotStats, Subscription

logger = logging.getLogger(__name__)


class TelegramBot:
    """SolFoundry Telegram bot for bounty notifications."""

    def __init__(self) -> None:
        self.token = settings.telegram_token
        self.default_chat_id = settings.telegram_chat_id
        self.api_base = f"https://api.telegram.org/bot{self.token}"
        self._last_bounty_id: str | None = None
        self._bounties_posted: set[str] = set()
        self._subscribers: dict[int, Subscription] = {}
        self._last_check: str | None = None
        self._errors: list[str] = []
        self._http_client: httpx.AsyncClient | None = None

        # Proxy configuration
        self._proxy = settings.telegram_proxy_url or None

    @property
    def _client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client with proxy support."""
        if self._http_client is None:
            client_kwargs: dict[str, Any] = {"timeout": 30.0}
            if self._proxy:
                client_kwargs["proxies"] = {"https://": self._proxy, "http://": self._proxy}
            self._http_client = httpx.AsyncClient(**client_kwargs)
        return self._http_client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    async def _telegram_call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Make a call to the Telegram Bot API."""
        url = f"{self.api_base}/{method}"
        try:
            resp = await self._client.post(url, json=params or {}, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                logger.error("Telegram API error: %s", data.get("description", "unknown"))
                return {}
            return data.get("result", {})
        except Exception as e:
            logger.error("Telegram API call failed: %s", e)
            self._errors.append(f"Telegram API {method}: {e}")
            return {}

    async def send_message(
        self,
        chat_id: str | int,
        text: str,
        parse_mode: str = "HTML",
        reply_markup: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send a message to a Telegram chat."""
        params: dict[str, Any] = {
            "chat_id": str(chat_id),
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            params["reply_markup"] = reply_markup
        return await self._telegram_call("sendMessage", params)

    async def set_webhook(self, url: str) -> bool:
        """Set the Telegram webhook URL."""
        result = await self._telegram_call("setWebhook", {"url": url})
        return bool(result)

    async def delete_webhook(self) -> bool:
        """Delete the Telegram webhook."""
        result = await self._telegram_call("deleteWebhook")
        return bool(result)

    async def get_me(self) -> dict[str, Any]:
        """Get bot information."""
        return await self._telegram_call("getMe")

    # ── Bounty formatting ─────────────────────────────────────────────────────

    @staticmethod
    def format_bounty_message(bounty: BountyItem) -> str:
        """Format a bounty as a Telegram HTML message."""
        tier_emoji = {1: "🥇", 2: "🥈", 3: "🥉"}
        tier_str = f"{tier_emoji.get(bounty.tier, '📌')} T{bounty.tier}"

        tags_str = ""
        if bounty.tags:
            tags = " ".join(f"<code>{t}</code>" for t in bounty.tags[:5])
            tags_str = f"\n🏷️ {tags}"

        header = f"<b>🚀 New Bounty on SolFoundry!</b>\n"
        title = f"<b>{bounty.title}</b>"
        reward = f"\n💰 <b>{bounty.reward_amount:,.0f} ${bounty.reward_token}</b> {tier_str}"
        desc = ""
        if bounty.description:
            # Truncate long descriptions
            clean = bounty.description.replace("<", "&lt;").replace(">", "&gt;")[:300]
            desc = f"\n\n{clean}"
        footer = f"\n\n🔗 <a href='{bounty.source_url or 'https://solfoundry.org'}'>View on SolFoundry</a>"

        return f"{header}{title}{reward}{tags_str}{desc}{footer}"

    @staticmethod
    def build_bounty_inline_keyboard(bounty_id: str, source_url: str = "") -> dict[str, Any]:
        """Build an inline keyboard for a bounty message."""
        buttons = []
        # View button
        if source_url:
            buttons.append([{
                "text": "🔗 View Bounty",
                "url": source_url,
            }])
        # Action buttons
        buttons.append([
            {"text": "📋 Details", "callback_data": f"details:{bounty_id}"},
            {"text": "🏷️ Tags", "callback_data": f"tags:{bounty_id}"},
        ])
        return {"inline_keyboard": buttons}

    # ── Bounty posting ─────────────────────────────────────────────────────────

    async def post_bounty_to_channel(self, bounty: BountyItem) -> bool:
        """Post a bounty to the default Telegram channel."""
        if not self.default_chat_id:
            logger.warning("No default chat ID configured")
            return False

        if bounty.id in self._bounties_posted:
            return False

        message = self.format_bounty_message(bounty)
        keyboard = self.build_bounty_inline_keyboard(bounty.id, bounty.source_url)

        result = await self.send_message(self.default_chat_id, message, reply_markup=keyboard)
        if result:
            self._bounties_posted.add(bounty.id)
            self._last_bounty_id = bounty.id
            logger.info("Posted bounty %s: %s", bounty.id[:8], bounty.title)
            return True
        return False

    async def post_bounty_to_subscribers(self, bounty: BountyItem) -> int:
        """Post a bounty to all subscribed users matching their filters."""
        posted_count = 0
        for chat_id, sub in self._subscribers.items():
            if self._matches_filters(bounty, sub.filters):
                message = self.format_bounty_message(bounty)
                keyboard = self.build_bounty_inline_keyboard(bounty.id, bounty.source_url)
                result = await self.send_message(chat_id, message, reply_markup=keyboard)
                if result:
                    posted_count += 1
        return posted_count

    @staticmethod
    def _matches_filters(bounty: BountyItem, filters: dict[str, Any]) -> bool:
        """Check if a bounty matches a subscriber's filters."""
        if not filters:
            return True

        # Min reward filter
        min_reward = filters.get("min_reward", 0)
        if min_reward and bounty.reward_amount < min_reward:
            return False

        # Max reward filter
        max_reward = filters.get("max_reward", 0)
        if max_reward and bounty.reward_amount > max_reward:
            return False

        # Tier filter
        tiers = filters.get("tiers", [])
        if tiers and bounty.tier not in tiers:
            return False

        # Tag filter
        tags = filters.get("tags", [])
        if tags:
            bounty_tags = set(t.lower() for t in bounty.tags)
            if not any(t.lower() in bounty_tags for t in tags):
                return False

        return True

    # ── Subscription management ────────────────────────────────────────────────

    async def subscribe(self, chat_id: int, username: str = "", filters: dict[str, Any] | None = None) -> bool:
        """Subscribe a user to bounty notifications."""
        if chat_id in self._subscribers:
            return False
        self._subscribers[chat_id] = Subscription(
            chat_id=chat_id,
            username=username,
            filters=filters or {},
        )
        logger.info("New subscriber: %s (%d)", username or "unknown", chat_id)
        return True

    async def unsubscribe(self, chat_id: int) -> bool:
        """Unsubscribe a user from bounty notifications."""
        if chat_id in self._subscribers:
            del self._subscribers[chat_id]
            logger.info("Unsubscribed: %d", chat_id)
            return True
        return False

    def update_subscription_filters(self, chat_id: int, filters: dict[str, Any]) -> bool:
        """Update a subscriber's filters."""
        if chat_id in self._subscribers:
            self._subscribers[chat_id].filters = filters
            return True
        return False

    # ── Polling for new bounties ───────────────────────────────────────────────

    async def fetch_new_bounties(self) -> list[BountyItem]:
        """Fetch new bounties from the SolFoundry API."""
        url = f"{settings.solfoundry_api_url}/api/bounties"
        headers = {"Accept": "application/json"}
        if settings.solfoundry_api_token:
            headers["Authorization"] = f"Bearer {settings.solfoundry_api_token}"

        params = {
            "sort": "created_at",
            "order": "desc",
            "per_page": settings.max_bounties_per_poll,
            "status": "open",
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=headers, params=params, timeout=30.0)
                resp.raise_for_status()
                data = resp.json()

            # Handle both list and paginated response formats
            raw_bounties = []
            if isinstance(data, list):
                raw_bounties = data
            elif isinstance(data, dict):
                raw_bounties = data.get("bounties", data.get("items", data.get("data", [])))

            bounties = [BountyItem(**b) for b in raw_bounties]
            # Filter to only new ones
            new_bounties = [b for b in bounties if b.id not in self._bounties_posted]
            self._last_check = datetime.now(timezone.utc).isoformat()
            return new_bounties
        except Exception as e:
            logger.error("Failed to fetch bounties: %s", e)
            self._errors.append(f"Fetch bounties: {e}")
            return []

    async def poll_and_post(self) -> int:
        """Poll for new bounties and post them."""
        new_bounties = await self.fetch_new_bounties()
        posted_count = 0

        for bounty in new_bounties:
            # Post to default channel
            if await self.post_bounty_to_channel(bounty):
                posted_count += 1
            # Post to subscribers
            posted_count += await self.post_bounty_to_subscribers(bounty)

        if new_bounties:
            logger.info("Polled: %d new bounties found, %d posted", len(new_bounties), posted_count)

        return posted_count

    # ── Stats ──────────────────────────────────────────────────────────────────

    def get_stats(self) -> BotStats:
        """Get bot statistics."""
        return BotStats(
            total_bounties_posted=len(self._bounties_posted),
            total_subscribers=len(self._subscribers),
            last_check=self._last_check,
            last_bounty_at=self._last_bounty_id,
            errors=self._errors[-10:] if self._errors else [],
        )

    @property
    def stats(self) -> dict[str, Any]:
        stats = self.get_stats()
        return {
            "bounties_posted": stats.total_bounties_posted,
            "subscribers": stats.total_subscribers,
            "last_check": stats.last_check,
            "last_bounty_id": stats.last_bounty_at,
            "recent_errors": stats.errors,
        }