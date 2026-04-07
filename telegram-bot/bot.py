"""
SolFoundry Telegram Bot — Bounty Notification Bot
================================================

A Telegram bot that monitors SolFoundry bounties and posts new bounties
to a channel with inline keyboard buttons for quick details and claiming.

Setup:
1. Create a bot via @BotFather → get BOT_TOKEN
2. Create a channel → add bot as admin → get CHAT_ID
3. Set environment variables (see .env.example)
4. Run: python bot.py

Environment variables:
  TELEGRAM_BOT_TOKEN   - BotFather token
  TELEGRAM_CHAT_ID    - Channel ID (e.g. -1001234567890)
  SOLFOUNDRY_API_URL  - SolFoundry API (default: https://solfoundry.org/api)
  POLL_INTERVAL_SECS  - Seconds between bounty polls (default: 60)

Usage with Docker:
  docker build -t solfoundry-telegram-bot .
  docker run -d --env-file .env solfoundry-telegram-bot
"""

import os
import sys
import time
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import requests
import telegram
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    filters,
    MessageHandler,
)

# ─── Config ───────────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
SOLFOUNDRY_API_URL = os.getenv("SOLFOUNDRY_API_URL", "https://solfoundry.org/api")
POLL_INTERVAL_SECS = int(os.getenv("POLL_INTERVAL_SECS", "60"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# ─── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=getattr(logging, LOG_LEVEL, logging.INFO),
)
log = logging.getLogger("solfoundry-telegram-bot")

# ─── Data models ───────────────────────────────────────────────────────────────


@dataclass
class Bounty:
    id: str
    title: str
    tier: int
    reward_amount: int
    reward_token: str
    category: str
    status: str
    github_issue_url: str
    created_at: str
    funding_token: str
    submission_count: int = 0

    @classmethod
    def from_api(cls, data: dict) -> "Bounty":
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            tier=data.get("tier", 0),
            reward_amount=data.get("reward_amount", 0),
            reward_token=data.get("funding_token", "FNDRY"),
            category=data.get("category", "unknown"),
            status=data.get("status", "unknown"),
            github_issue_url=data.get("github_issue_url", ""),
            created_at=data.get("created_at", ""),
            funding_token=data.get("funding_token", "FNDRY"),
            submission_count=data.get("submission_count", 0),
        )

    def format_reward(self) -> str:
        if self.reward_amount >= 1_000_000:
            return f"{self.reward_amount / 1_000_000:.0f}M ${self.reward_token}"
        elif self.reward_amount >= 1_000:
            return f"{self.reward_amount / 1_000:.0f}K ${self.reward_token}"
        return f"{self.reward_amount} ${self.reward_token}"

    def tier_emoji(self) -> str:
        return {1: "🟢", 2: "🔵", 3: "🟣"}.get(self.tier, "⚪")

    def tier_label(self) -> str:
        return {1: "T1", 2: "T2", 3: "T3"}.get(self.tier, "T?")


@dataclass
class Subscription:
    user_id: int
    tier_filter: Optional[int] = None
    category_filter: Optional[str] = None
    min_reward: Optional[int] = None
    language_filter: Optional[list[str]] = field(default_factory=list)


# ─── SolFoundry API Client ─────────────────────────────────────────────────────


class SolFoundryClient:
    BASE_URL = SOLFOUNDRY_API_URL

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    def get_open_bounties(self, limit: int = 50) -> list[Bounty]:
        try:
            resp = self.session.get(
                f"{self.BASE_URL}/bounties",
                params={"limit": limit, "status": "open"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", []) if isinstance(data, dict) else data
            return [Bounty.from_api(b) for b in items]
        except requests.RequestException as e:
            log.error(f"Failed to fetch bounties: {e}")
            return []

    def get_bounty(self, bounty_id: str) -> Optional[Bounty]:
        try:
            resp = self.session.get(
                f"{self.BASE_URL}/bounties/{bounty_id}",
                timeout=10,
            )
            resp.raise_for_status()
            return Bounty.from_api(resp.json())
        except requests.RequestException as e:
            log.error(f"Failed to fetch bounty {bounty_id}: {e}")
            return None


# ─── Subscription Store ────────────────────────────────────────────────────────


class SubscriptionStore:
    """In-memory subscription store. Replace with Redis/DB in production."""

    def __init__(self):
        self._subs: dict[int, Subscription] = {}

    def add(self, user_id: int, sub: Subscription) -> None:
        self._subs[user_id] = sub
        log.info(f"User {user_id} subscribed: {sub}")

    def remove(self, user_id: int) -> None:
        self._subs.pop(user_id, None)
        log.info(f"User {user_id} unsubscribed")

    def get(self, user_id: int) -> Optional[Subscription]:
        return self._subs.get(user_id)

    def list(self) -> list[Subscription]:
        return list(self._subs.values())

    def matches(self, bounty: Bounty) -> list[Subscription]:
        matched = []
        for sub in self._subs.values():
            if sub.tier_filter is not None and bounty.tier != sub.tier_filter:
                continue
            if sub.category_filter and bounty.category != sub.category_filter:
                continue
            if sub.min_reward and bounty.reward_amount < sub.min_reward:
                continue
            matched.append(sub)
        return matched


# ─── Bot Handlers ─────────────────────────────────────────────────────────────


class SolFoundryBot:
    def __init__(self):
        self.client = SolFoundryClient()
        self.subs = SubscriptionStore()
        self._seen_ids: set[str] = set()
        self._lock = threading.Lock()

    # ── Telegram message formatting ──────────────────────────────────────────────

    def format_bounty_message(self, bounty: Bounty) -> tuple[str, InlineKeyboardMarkup]:
        tier_emoji = bounty.tier_emoji()
        reward_str = bounty.format_reward()

        text = (
            f"{tier_emoji} <b>{bounty.title}</b>\n\n"
            f"🏷 <b>Tier:</b> {bounty.tier_label()} ({bounty.category})\n"
            f"💰 <b>Reward:</b> <code>{reward_str}</code>\n"
            f"📋 <b>Status:</b> {bounty.status}\n"
            f"🔢 <b>Submissions:</b> {bounty.submission_count}\n"
            f"🕐 <b>Created:</b> {bounty.created_at[:10]}\n"
        )

        # Build inline keyboard
        issue_number = bounty.github_issue_url.split("/")[-1] if bounty.github_issue_url else ""
        keyboard = [
            [
                InlineKeyboardButton(
                    "📋 Issue Details",
                    url=bounty.github_issue_url or f"https://solfoundry.org/bounties/{bounty.id}",
                ),
            ],
            [
                InlineKeyboardButton(
                    "🚨 Claim on GitHub",
                    url=f"https://github.com/SolFoundry/solfoundry/issues/{issue_number}" if issue_number else "https://solfoundry.org/bounties",
                ),
            ],
            [
                InlineKeyboardButton(
                    "📊 View All Bounties",
                    url="https://solfoundry.org/bounties",
                ),
            ],
        ]

        return text, InlineKeyboardMarkup(keyboard)

    # ── Notification dispatcher ────────────────────────────────────────────────

    async def notify_channel(self, bounty: Bounty, app: Application) -> None:
        if not TELEGRAM_CHAT_ID:
            log.warning("TELEGRAM_CHAT_ID not set — skipping notification")
            return

        try:
            text, keyboard = self.format_bounty_message(bounty)
            await app.bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=text,
                reply_markup=keyboard,
                parse_mode="HTML",
                disable_web_page_preview=True,
            )
            log.info(f"Notified channel about bounty: {bounty.title}")
        except telegram.error.TelegramError as e:
            log.error(f"Failed to send Telegram message: {e}")

    # ── Background polling ────────────────────────────────────────────────────

    async def poll_bounties(self, app: Application) -> None:
        log.info("Starting bounty poll...")
        while True:
            try:
                bounties = self.client.get_open_bounties(limit=100)
                new_count = 0
                for bounty in bounties:
                    if bounty.id not in self._seen_ids:
                        self._seen_ids.add(bounty.id)
                        new_count += 1
                        await self.notify_channel(bounty, app)
                        # Rate limit: wait a bit between sends
                        await asyncio.sleep(1)
                if new_count:
                    log.info(f"Found {new_count} new bounty(ies)")
            except Exception as e:
                log.error(f"Poll error: {e}")
            await asyncio.sleep(POLL_INTERVAL_SECS)

    # ── Command handlers ──────────────────────────────────────────────────────

    async def cmd_start(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text(
            "👋 <b>SolFoundry Bounty Bot</b>\n\n"
            "I'll notify you about new SolFoundry bounties in this chat.\n\n"
            "Commands:\n"
            "/subscribe — Set up bounty filters\n"
            "/unsubscribe — Stop notifications\n"
            "/list — List current bounties\n"
            "/status — Bot status\n"
            "/help — Show this message",
            parse_mode="HTML",
        )

    async def cmd_help(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        await self.cmd_start(update, ctx)

    async def cmd_subscribe(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        keyboard = [
            [InlineKeyboardButton("🟢 T1 Only", callback_data="sub:t1"),
             InlineKeyboardButton("🔵 T2 Only", callback_data="sub:t2"),
             InlineKeyboardButton("🟣 T3 Only", callback_data="sub:t3")],
            [InlineKeyboardButton("🔴 All Tiers", callback_data="sub:all")],
        ]
        await update.message.reply_text(
            "⚙️ <b>Subscribe to bounty notifications</b>\n\n"
            "Select which tier(s) you want to be notified about:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="HTML",
        )

    async def cmd_unsubscribe(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        self.subs.remove(update.effective_user.id)
        await update.message.reply_text("✅ Unsubscribed from all bounty notifications.")

    async def cmd_list(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text("🔍 Fetching latest bounties...")
        bounties = self.client.get_open_bounties(limit=10)
        if not bounties:
            await update.message.reply_text("❌ No bounties found or API error.")
            return
        for bounty in bounties:
            text, keyboard = self.format_bounty_message(bounty)
            await update.message.reply_text(
                text,
                reply_markup=keyboard,
                parse_mode="HTML",
                disable_web_page_preview=True,
            )
            await asyncio.sleep(0.5)

    async def cmd_status(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        sub = self.subs.get(update.effective_user.id)
        await update.message.reply_text(
            "📊 <b>Bot Status</b>\n\n"
            f"• API: {SOLFOUNDRY_API_URL}\n"
            f"• Poll interval: {POLL_INTERVAL_SECS}s\n"
            f"• Seen bounties: {len(self._seen_ids)}\n"
            f"• Your subscription: {'✅ Active' if sub else '❌ None'}\n"
            f"• Channel notifications: {'✅ ON' if TELEGRAM_CHAT_ID else '⚠️ Not configured'}",
            parse_mode="HTML",
        )

    async def callback_handler(
        self, update: Update, ctx: ContextTypes.DEFAULT_TYPE
    ) -> None:
        query = update.callback_query
        await query.answer()
        data = query.data or ""

        user_id = update.effective_user.id

        if data.startswith("sub:"):
            tier_str = data.split(":")[1]
            tier_map = {"t1": 1, "t2": 2, "t3": 3, "all": None}
            tier = tier_map.get(tier_str)
            self.subs.add(user_id, Subscription(user_id=user_id, tier_filter=tier))
            tier_name = {1: "T1", 2: "T2", 3: "T3", None: "All"}[tier]
            await query.edit_message_text(
                f"✅ Subscribed to <b>{tier_name}</b> bounty notifications.",
                parse_mode="HTML",
            )

    # ── Run ───────────────────────────────────────────────────────────────────

    def run(self) -> None:
        if not TELEGRAM_BOT_TOKEN:
            log.error("TELEGRAM_BOT_TOKEN not set!")
            sys.exit(1)

        log.info("Starting SolFoundry Telegram Bot...")

        import asyncio

        app = (
            Application.builder()
            .token(TELEGRAM_BOT_TOKEN)
            .read_timeout(30)
            .write_timeout(30)
            .build()
        )

        # Register handlers
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("help", self.cmd_help))
        app.add_handler(CommandHandler("subscribe", self.cmd_subscribe))
        app.add_handler(CommandHandler("unsubscribe", self.cmd_unsubscribe))
        app.add_handler(CommandHandler("list", self.cmd_list))
        app.add_handler(CommandHandler("status", self.cmd_status))
        app.add_handler(CallbackQueryHandler(self.callback_handler))

        # Start background bounty polling
        app.post_init = lambda app: asyncio.create_task(self.poll_bounties(app))

        log.info("Bot is running. Press Ctrl+C to stop.")
        app.run_polling(allowed_updates=Update.ALL_TYPES)


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio

    bot = SolFoundryBot()
    bot.run()
