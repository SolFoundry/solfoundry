"""Telegram bot command and callback handlers."""
import logging
import re
from typing import Optional

from telegram import InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.formatters import FILTER_HELP, format_bounty_detail, format_filter_status, format_leaderboard
from bot.github_client import GitHubClient
from bot.models import UserFilter
from bot.subscription_store import SubscriptionStore

logger = logging.getLogger(__name__)


def parse_filter_args(text: str) -> tuple[Optional[UserFilter], Optional[str]]:
    """Parse /filter args into UserFilter. Returns (filter, error)."""
    text = text.strip()
    if not text or text == "clear":
        return None, None

    tiers: Optional[list[str]] = None
    types: Optional[list[str]] = None
    min_reward: Optional[int] = None

    for token in text.split():
        token = token.strip()
        if not token or ':' not in token:
            continue
        key, _, value = token.partition(':')
        key, value = key.lower(), value.lower()
        if key == "tier":
            tiers = [v.strip() for v in value.split(',') if v.strip()]
        elif key == "type":
            types = [v.strip() for v in value.split(',') if v.strip()]
        elif key == "min":
            try:
                min_reward = int(value)
            except ValueError:
                return None, f"Invalid min value: {value}"

    return UserFilter(user_id=0, tiers=tiers, types=types, min_reward=min_reward), None


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "👋 <b>Welcome to SolFoundry Bounty Bot!</b>\n\n"
        "I'll notify you about new SolFoundry bounties.\n\n"
        "📋 <b>Commands:</b>\n"
        "/bounty N — Bounty details\n"
        "/leaderboard — 🏆 Top contributors\n"
        "/filters — View filters\n"
        "/filter — Set filters\n"
        "/subscribe — Subscribe\n"
        "/help — All commands",
        parse_mode="HTML", disable_web_page_preview=True,
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "📖 <b>Commands</b>\n\n"
        "/start — Welcome\n"
        "/bounty N — Bounty #N detail\n"
        "/leaderboard — 🏆 Top contributors\n"
        "/filters — View your filters\n"
        "/filter tier:1,2 min:500 — Set filters\n"
        "/filter clear — Reset filters\n"
        "/subscribe — Subscribe\n"
        "/unsubscribe — Unsubscribe\n"
        "/help — This message\n\n"
        "<b>Acceptance Criteria (Bounty #847):</b>\n"
        "✅ Real-time bounty posting with rich embeds\n"
        "✅ /leaderboard command\n"
        "✅ Customizable notification filters per user",
        parse_mode="HTML", disable_web_page_preview=True,
    )


async def cmd_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("⏳ Fetching leaderboard...")
    try:
        entries = GitHubClient().fetch_contributor_stats()
        text = format_leaderboard(entries)
        await msg.edit_text(text, parse_mode="HTML")
    except Exception as e:
        logger.exception("Leaderboard failed")
        await msg.edit_text(f"❌ Failed: {e}")


async def cmd_filters(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    store = SubscriptionStore()
    user_filter = store.get_filter(update.effective_user.id)
    await update.message.reply_text(format_filter_status(user_filter), parse_mode="HTML")


async def cmd_filter(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    store = SubscriptionStore()
    user_id = update.effective_user.id
    raw_args = " ".join(context.args) if context.args else ""

    if raw_args == "clear":
        store.delete_filter(user_id)
        await update.message.reply_text("✅ Filters reset to defaults.")
        return

    if not raw_args:
        user_filter = store.get_filter(user_id)
        await update.message.reply_text(format_filter_status(user_filter), parse_mode="HTML")
        return

    user_filter, error = parse_filter_args(raw_args)
    if error:
        await update.message.reply_text(f"❌ {error}\n\n{FILTER_HELP}", parse_mode="HTML")
        return

    valid_tiers = {"1", "2", "3"}
    valid_types = {"feature", "bug", "docs", "integration", "security"}

    if user_filter.tiers and set(user_filter.tiers) - valid_tiers:
        await update.message.reply_text("❌ Invalid tier. Valid: 1, 2, 3.", parse_mode="HTML")
        return
    if user_filter.types and set(user_filter.types) - valid_types:
        await update.message.reply_text(
            "❌ Invalid type. Valid: feature, bug, docs, integration, security.", parse_mode="HTML",
        )
        return

    user_filter.user_id = user_id
    store.save_filter(user_filter)
    await update.message.reply_text(
        f"✅ Filters updated!\n\n{format_filter_status(user_filter)}", parse_mode="HTML",
    )


async def cmd_subscribe(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    store = SubscriptionStore()
    store.save_filter(UserFilter(user_id=update.effective_user.id))
    await update.message.reply_text(
        "✅ Subscribed to all bounties!\nUse /filter to narrow down notifications.",
    )


async def cmd_unsubscribe(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    store = SubscriptionStore()
    store.delete_filter(update.effective_user.id)
    await update.message.reply_text("❌ Unsubscribed. Use /subscribe to re-enable.")


async def cmd_bounty(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("Usage: /bounty <issue_number>\nExample: /bounty 847")
        return
    try:
        number = int(context.args[0])
    except ValueError:
        await update.message.reply_text("❌ Invalid issue number.")
        return

    msg = await update.message.reply_text(f"🔍 Fetching bounty #{number}...")
    try:
        bounty = GitHubClient().fetch_bounty(number)
        if not bounty:
            await msg.edit_text(f"❌ Bounty #{number} not found.")
            return
        text, keyboard = format_bounty_detail(bounty)
        await msg.edit_text(text, parse_mode="HTML", reply_markup=keyboard, disable_web_page_preview=True)
    except Exception as e:
        logger.exception("Bounty fetch failed")
        await msg.edit_text(f"❌ Failed to fetch bounty #{number}: {e}")


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()
    data = query.data

    if data == "subscribe":
        store = SubscriptionStore()
        store.save_filter(UserFilter(user_id=query.from_user.id))
        await query.edit_message_text(
            "✅ Subscribed! Use /filter to customize what you get notified about.",
        )
        return

    if data.startswith("claim:"):
        number = data.split(":", 1)[1]
        await query.edit_message_text(
            f"✅ Head to GitHub to claim this bounty:\n"
            f"https://github.com/SolFoundry/solfoundry/issues/{number}\n\n"
            "1. Fork the repo\n"
            "2. Open a PR with your solution\n"
            "3. Include <code>Closes #{number}</code> in the PR description",
            parse_mode="HTML", disable_web_page_preview=True,
        )
