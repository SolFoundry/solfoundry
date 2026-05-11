"""SolFoundry Discord Bot for bounty notifications and leaderboard.

Posts new bounties to a channel, displays live leaderboard rankings,
and allows users to filter notifications by bounty type and reward level.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class SolFoundryDiscordBot:
    """Discord bot for SolFoundry bounty notifications."""

    def __init__(self, token: str, channel_id: str):
        self.token = token
        self.channel_id = channel_id
        self.base_url = "https://discord.com/api/v10"
        self.http = httpx.AsyncClient(
            headers={"Authorization": f"Bot {token}"},
            timeout=30.0,
        )
        self.subscriptions: dict[str, dict] = {}  # user_id -> prefs

    async def close(self):
        await self.http.aclose()

    # --- Core API ---

    async def send_message(
        self,
        channel_id: str,
        content: Optional[str] = None,
        embed: Optional[dict] = None,
        components: Optional[list] = None,
    ) -> dict:
        """Send a message with optional embed and components."""
        payload = {}
        if content:
            payload["content"] = content
        if embed:
            payload["embeds"] = [embed]
        if components:
            payload["components"] = components

        resp = await self.http.post(
            f"{self.base_url}/channels/{channel_id}/messages",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    # --- Bounty Notifications ---

    async def post_new_bounty(
        self,
        bounty_id: int,
        title: str,
        tier: str,
        reward: int,
        skills: list[str],
        deadline: Optional[str],
        bounty_url: str,
    ) -> dict:
        """Post a new bounty notification with embed."""
        tier_color = {"T1": 0x00D4AA, "T2": 0xFBBF24, "T3": 0xA855F7}.get(tier, 0x6B7280)
        tier_emoji = {"T1": "🟢", "T2": "🟡", "T3": "🟣"}.get(tier, "⚪")
        reward_str = f"{reward // 1000}K" if reward < 1000000 else f"{reward // 1000000}M"

        embed = {
            "title": f"{tier_emoji} New Bounty: {title}",
            "url": bounty_url,
            "color": tier_color,
            "fields": [
                {"name": "💰 Reward", "value": f"**{reward_str} $FNDRY**", "inline": True},
                {"name": "🏷 Tier", "value": tier, "inline": True},
                {"name": "🔧 Skills", "value": " · ".join(skills[:5]) if skills else "Various", "inline": True},
            ],
            "footer": {"text": f"Bounty #{bounty_id} · SolFoundry"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if deadline:
            embed["fields"].append({
                "name": "⏰ Deadline", "value": deadline, "inline": False,
            })

        # Action row with buttons
        components = [{
            "type": 1,  # ACTION_ROW
            "components": [
                {
                    "type": 2,  # BUTTON
                    "style": 5,  # LINK
                    "label": "📋 View Details",
                    "url": bounty_url,
                },
                {
                    "type": 2,
                    "style": 5,
                    "label": "⚡ Fork & Claim",
                    "url": f"https://github.com/SolFoundry/solfoundry/fork",
                },
                {
                    "type": 2,
                    "style": 1,  # PRIMARY
                    "label": f"🔔 Subscribe {tier}",
                    "custom_id": f"subscribe:{tier}",
                },
            ],
        }]

        return await self.send_message(self.channel_id, embed=embed, components=components)

    async def post_leaderboard(
        self,
        leaderboard: list[dict],
        period: str = "all-time",
    ) -> dict:
        """Post a leaderboard ranking embed."""
        medals = ["🥇", "🥈", "🥉"]
        rows = []

        for i, entry in enumerate(leaderboard[:10]):
            medal = medals[i] if i < 3 else f"`{i+1}.`"
            username = entry.get("username", "anonymous")
            earned = entry.get("total_earned", 0)
            completed = entry.get("bounties_completed", 0)
            rows.append(f"{medal} **{username}** — {earned // 1000}K $FNDRY ({completed} bounties)")

        embed = {
            "title": f"🏆 SolFoundry Leaderboard ({period.title()})",
            "color": 0xF97316,  # anvil-orange
            "description": "\n".join(rows) if rows else "No entries yet!",
            "footer": {"text": "SolFoundry · Claim bounties to climb the ranks!"},
        }

        components = [{
            "type": 1,
            "components": [
                {
                    "type": 2, "style": 5,
                    "label": "📊 Full Leaderboard",
                    "url": "https://solfoundry.xyz/leaderboard",
                },
                {
                    "type": 2, "style": 1,
                    "label": "🔥 Browse Bounties",
                    "custom_id": "browse_bounties",
                },
            ],
        }]

        return await self.send_message(self.channel_id, embed=embed, components=components)

    async def post_payout_notification(
        self,
        username: str,
        bounty_title: str,
        amount: int,
        tx_url: str,
    ) -> dict:
        """Post a payout notification."""
        amount_str = f"{amount // 1000}K" if amount < 1000000 else f"{amount // 1000000}M"

        embed = {
            "title": "💰 Payout Alert!",
            "color": 0x00D4AA,
            "description": f"🎉 **@{username}** earned **{amount_str} $FNDRY**\nfor completing: **{bounty_title}**",
            "fields": [
                {"name": "🔗 Transaction", "value": f"[View on Solana]({tx_url})", "inline": True},
            ],
            "footer": {"text": "Instant on-chain payouts · SolFoundry"},
        }

        return await self.send_message(self.channel_id, embed=embed)

    # --- Interaction Handler ---

    async def handle_interaction(self, interaction: dict) -> dict:
        """Handle Discord button interactions."""
        data = interaction.get("data", {})
        custom_id = data.get("custom_id", "")
        member = interaction.get("member", {})
        user_id = member.get("user", {}).get("id", "unknown")
        username = member.get("user", {}).get("username", "anonymous")

        if custom_id.startswith("subscribe:"):
            tier = custom_id.split(":")[1]
            if user_id not in self.subscriptions:
                self.subscriptions[user_id] = {"tiers": [], "languages": []}
            if tier not in self.subscriptions[user_id]["tiers"]:
                self.subscriptions[user_id]["tiers"].append(tier)

            return {
                "type": 4,  # CHANNEL_MESSAGE_WITH_SOURCE
                "data": {
                    "content": f"🔔 Subscribed to {tier} bounties! You'll get notified of new ones.",
                    "flags": 64,  # EPHEMERAL
                },
            }

        elif custom_id == "browse_bounties":
            return {
                "type": 4,
                "data": {
                    "content": "🔥 Browse all bounties: https://solfoundry.xyz/bounties",
                    "flags": 64,
                },
            }

        return {
            "type": 4,
            "data": {"content": "✅ Action received!", "flags": 64},
        }

    # --- User Notification Filtering ---

    def should_notify_user(
        self,
        user_id: str,
        bounty_tier: str,
        bounty_skills: list[str],
    ) -> bool:
        """Check if a user should be notified based on their preferences."""
        prefs = self.subscriptions.get(user_id)
        if not prefs:
            return True  # Notify all by default

        tier_filter = prefs.get("tiers", [])
        if tier_filter and bounty_tier not in tier_filter:
            return False

        lang_filter = prefs.get("languages", [])
        if lang_filter and not any(s.lower() in " ".join(bounty_skills).lower() for s in lang_filter):
            return False

        return True

    def set_user_preferences(
        self,
        user_id: str,
        tiers: Optional[list[str]] = None,
        languages: Optional[list[str]] = None,
    ) -> None:
        """Set notification preferences for a user."""
        if user_id not in self.subscriptions:
            self.subscriptions[user_id] = {"tiers": [], "languages": []}
        if tiers is not None:
            self.subscriptions[user_id]["tiers"] = tiers
        if languages is not None:
            self.subscriptions[user_id]["languages"] = languages
