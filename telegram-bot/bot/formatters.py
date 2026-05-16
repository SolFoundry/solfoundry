"""Rich embed formatters for Telegram messages."""
import textwrap
from typing import Optional, Tuple

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.models import Bounty, LeaderboardEntry

TIER_EMOJI = {"1": "🔧", "2": "⚡", "3": "🚀", None: "📋"}
TIER_LABEL = {
    "1": "Tier 1 — Bug Fixes & Docs",
    "2": "Tier 2 — Module & Integration",
    "3": "Tier 3 — Major Feature",
    None: "Bounty",
}


def format_bounty_notification(bounty: Bounty) -> Tuple[str, InlineKeyboardMarkup]:
    tier = bounty.tier
    tier_emoji = TIER_EMOJI.get(tier, "📋")
    tier_text = TIER_LABEL.get(tier, "Bounty")
    body_preview = (bounty.body[:300].strip() + "...") if len(bounty.body) > 300 else bounty.body[:300].strip()
    reward_text = f"💰 {bounty.reward}" if bounty.reward else ""

    meta_parts = []
    if reward_text:
        meta_parts.append(reward_text)
    if bounty.bounty_type:
        meta_parts.append(f"🏷 {bounty.bounty_type.capitalize()}")
    meta_parts.append(f"🕐 {bounty.created_at.strftime('%Y-%m-%d')}")

    lines = [
        f"{tier_emoji} <b>New {tier_text}</b>",
        f"#{bounty.number} {bounty.title}",
        "",
    ]
    if body_preview:
        lines.append(textwrap.fill(body_preview, width=80))
        lines.append("")
    lines.append(" | ".join(meta_parts))

    keyboard = [
        [
            InlineKeyboardButton("🔍 Details", url=bounty.html_url),
        ],
        [
            InlineKeyboardButton("✅ I want this", callback_data=f"claim:{bounty.number}"),
        ],
    ]
    return "\n".join(lines), InlineKeyboardMarkup(keyboard)


def format_bounty_detail(bounty: Bounty) -> Tuple[str, InlineKeyboardMarkup]:
    tier = bounty.tier
    tier_emoji = TIER_EMOJI.get(tier, "📋")
    tier_text = TIER_LABEL.get(tier, "Bounty")
    reward_text = f"💰 <b>{bounty.reward}</b>" if bounty.reward else "💰 Reward TBD"

    lines = [
        f"{tier_emoji} <b>{tier_text}</b>",
        f"#{bounty.number} — {bounty.title}",
        "",
        reward_text,
        "",
    ]
    if bounty.body:
        wrapped = textwrap.fill(bounty.body[:1000], width=80)
        lines.append(wrapped)
        lines.append("")

    meta = [
        f"📌 State: <b>{bounty.state.upper()}</b>",
        f"🕐 Posted: {bounty.created_at.strftime('%Y-%m-%d %H:%M UTC')}",
        f"🔗 {bounty.html_url}",
    ]
    if bounty.assignee:
        meta.append(f"👤 Assignee: @{bounty.assignee}")
    lines.extend(meta)

    keyboard = [
        [InlineKeyboardButton("🐙 Open on GitHub", url=bounty.html_url)],
        [InlineKeyboardButton("✅ I want this bounty", callback_data=f"claim:{bounty.number}")],
    ]
    return "\n".join(lines), InlineKeyboardMarkup(keyboard)


def format_leaderboard(entries: list[LeaderboardEntry]) -> str:
    if not entries:
        return "📊 No leaderboard data available yet."

    header = "🏆 <b>Top Contributors</b>\n\n```\n{'Rank':<6}{'Contributor':<25}{'Merged':<10}{'Est. Reward':<12}"
    lines = [header, "─" * 55]

    medal = {1: "🥇", 2: "🥈", 3: "🥉"}
    for entry in entries:
        medal_str = medal.get(entry.rank, f"#{entry.rank}")
        row = f"{medal_str:<6}{'@' + entry.username:<25}{entry.merged_count:<10}{entry.total_reward} FNDRY"
        lines.append(row)
    lines.append("```")
    return "\n".join(lines)


def format_filter_status(user_filter: "UserFilter") -> str:
    tier_str = ", ".join(user_filter.tiers) if user_filter.tiers else "All"
    type_str = ", ".join(user_filter.types) if user_filter.types else "All types"
    reward_str = f"≥ {user_filter.min_reward} FNDRY" if user_filter.min_reward else "No minimum"

    lines = [
        "🔔 <b>Your Notification Filters</b>",
        "",
        f"<b>Tiers:</b> {tier_str}",
        f"<b>Types:</b> {type_str}",
        f"<b>Min reward:</b> {reward_str}",
        "",
        "Use /filter to update your settings.",
    ]
    return "\n".join(lines)


FILTER_HELP = """\
🔔 <b>Set Bounty Notification Filters</b>

<code>/filter tier:1,2 type:feature,bug min:500 keyword:api</code>

<b>Options:</b>
• <code>tier:N,N</code> — Filter by tier (1, 2, 3)
• <code>type:t1,t2</code> — Type: feature, bug, docs, integration, security
• <code>min:N</code> — Minimum FNDRY reward
• <code>keyword:word</code> — Title must contain keyword

<b>Examples:</b>
<code>/filter tier:2,3 min:500</code> → T2/T3 ≥500 FNDRY
<code>/filter type:bug</code> → Bug bounties only
<code>/filter clear</code> → Reset to defaults
"""
