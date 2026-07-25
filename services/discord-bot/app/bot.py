"""SolFoundry Discord Bot — Discord bot logic."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import discord
from discord.ext import commands, tasks

from .config import settings
from .models import BountyItem, BotStats, UserFilter

logger = logging.getLogger(__name__)


class SolFoundryBot(commands.Bot):
    """Discord bot for SolFoundry bounty notifications."""

    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True

        super().__init__(
            command_prefix="!",
            intents=intents,
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="SolFoundry bounties",
            ),
        )

        self._bounties_posted: set[str] = set()
        self._user_filters: dict[int, UserFilter] = {}
        self._last_check: str | None = None
        self._errors: list[str] = []
        self._default_channel_id: int | None = None

        if settings.discord_channel_id:
            try:
                self._default_channel_id = int(settings.discord_channel_id)
            except ValueError:
                pass

        # Background poller
        self._poll_interval = settings.poll_interval_seconds

    async def setup_hook(self) -> None:
        """Register commands and start background tasks."""
        await self.add_cog(BountyCommands(self))
        self.poll_bounties.start()
        logger.info("Bot setup complete")

    @tasks.loop(seconds=settings.poll_interval_seconds)
    async def poll_bounties(self) -> None:
        """Background task: poll for new bounties and post them."""
        logger.debug("Polling for new bounties...")
        try:
            bounties = await self._fetch_new_bounties()
            for bounty in bounties:
                await self._post_bounty(bounty)
            if bounties:
                logger.info("Polled: posted %d new bounties", len(bounties))
        except Exception as e:
            logger.error("Poll error: %s", e)
            self._errors.append(f"Poll: {e}")

    @poll_bounties.before_loop
    async def before_poll(self) -> None:
        """Wait for the bot to be ready before polling."""
        await self.wait_until_ready()

    async def _fetch_new_bounties(self) -> list[BountyItem]:
        """Fetch new bounties from the SolFoundry API."""
        import httpx

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

            raw_bounties = []
            if isinstance(data, list):
                raw_bounties = data
            elif isinstance(data, dict):
                raw_bounties = data.get("bounties", data.get("items", data.get("data", [])))

            bounties = [BountyItem(**b) for b in raw_bounties]
            new_bounties = [b for b in bounties if b.id not in self._bounties_posted]
            self._last_check = datetime.now(timezone.utc).isoformat()
            return new_bounties
        except Exception as e:
            logger.error("Failed to fetch bounties: %s", e)
            self._errors.append(f"Fetch: {e}")
            return []

    async def _post_bounty(self, bounty: BountyItem) -> bool:
        """Post a bounty to the default Discord channel."""
        if self._default_channel_id is None:
            return False

        channel = self.get_channel(self._default_channel_id)
        if channel is None:
            logger.warning("Default channel %d not found", self._default_channel_id)
            return False

        embed = self._build_bounty_embed(bounty)
        view = BountyView(bounty.id)
        await channel.send(embed=embed, view=view)
        self._bounties_posted.add(bounty.id)
        logger.info("Posted bounty %s: %s", bounty.id[:8], bounty.title)
        return True

    @staticmethod
    def _build_bounty_embed(bounty: BountyItem) -> discord.Embed:
        """Build a rich Discord embed for a bounty."""
        tier_emojis = {1: "🥇", 2: "🥈", 3: "🥉"}

        embed = discord.Embed(
            title=bounty.title,
            url=bounty.source_url or "https://solfoundry.org",
            color=discord.Color.green(),
            timestamp=datetime.now(),
        )

        embed.set_author(
            name="SolFoundry Bounty",
            icon_url="https://solfoundry.org/favicon.ico",
        )

        # Description
        desc = bounty.description or "No description provided."
        if len(desc) > 300:
            desc = desc[:300] + "..."
        embed.description = desc

        # Fields
        tier_emoji = tier_emojis.get(bounty.tier, "📌")
        embed.add_field(
            name="💰 Reward",
            value=f"{bounty.reward_amount:,.0f} ${bounty.reward_token}",
            inline=True,
        )
        embed.add_field(
            name="🏆 Tier",
            value=f"{tier_emoji} T{bounty.tier}",
            inline=True,
        )
        embed.add_field(name="📊 Status", value="Open", inline=True)

        # Tags
        if bounty.tags:
            tags = " ".join(f"`{t}`" for t in bounty.tags[:5])
            embed.add_field(name="🏷️ Tags", value=tags, inline=False)

        embed.set_footer(text=f"Bounty ID: {bounty.id[:16]}...")
        return embed

    @staticmethod
    def _build_leaderboard_embed(
        entries: list[tuple[str, int, float]],
        title: str = "🏆 Top Contributors",
    ) -> discord.Embed:
        """Build a leaderboard embed."""
        embed = discord.Embed(
            title=title,
            color=discord.Color.gold(),
            timestamp=datetime.now(),
        )

        if not entries:
            embed.description = "No contributors yet. Start earning!"
            return embed

        medals = ["🥇", "🥈", "🥉"]
        leaderboard_lines = []
        for i, (name, tasks, reward) in enumerate(entries[:10]):
            medal = medals[i] if i < 3 else f"{i+1}."
            leaderboard_lines.append(f"{medal} **{name}** — {tasks} tasks, {reward:,.0f} $FNDRY")

        embed.description = "\n".join(leaderboard_lines)
        return embed

    def get_stats(self) -> BotStats:
        """Get bot statistics."""
        return BotStats(
            bounties_posted=len(self._bounties_posted),
            subscribers=len(self._user_filters),
            last_check=self._last_check,
            recent_errors=self._errors[-10:],
        )


# ── Discord Views (Interactive Components) ────────────────────────────────────

class BountyView(discord.ui.View):
    """Interactive view for bounty messages."""

    def __init__(self, bounty_id: str) -> None:
        super().__init__(timeout=None)
        self.bounty_id = bounty_id

    @discord.ui.button(label="🔗 View Bounty", style=discord.ButtonStyle.url, url="https://solfoundry.org")
    async def view_bounty(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await interaction.response.defer()

    @discord.ui.button(label="📋 Details", style=discord.ButtonStyle.primary)
    async def show_details(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        embed = discord.Embed(
            title="Bounty Details",
            description=f"**ID:** `{self.bounty_id}`\n\n"
                        f"Check SolFoundry for full bounty details.\n\n"
                        f"🔗 https://solfoundry.org",
            color=discord.Color.blue(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @discord.ui.button(label="🔔 Subscribe", style=discord.ButtonStyle.success)
    async def subscribe(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await interaction.response.send_message(
            "✅ **Subscribed!** You'll now receive bounty notifications.\n"
            "Use `/filters` to customize your preferences.",
            ephemeral=True,
        )


# ── Cog: Bounty Commands ──────────────────────────────────────────────────────

class BountyCommands(commands.Cog):
    """Slash commands for the SolFoundry Discord bot."""

    def __init__(self, bot: SolFoundryBot) -> None:
        self.bot = bot

    @commands.slash_command(name="subscribe", description="Subscribe to bounty notifications")
    async def subscribe(self, ctx: commands.Context) -> None:
        user_id = ctx.author.id
        if user_id not in self.bot._user_filters:
            self.bot._user_filters[user_id] = UserFilter(user_id=user_id)
        else:
            self.bot._user_filters[user_id].subscribed = True
        await ctx.respond("✅ **Subscribed!** You'll receive bounty notifications.", ephemeral=True)

    @commands.slash_command(name="unsubscribe", description="Stop receiving bounty notifications")
    async def unsubscribe(self, ctx: commands.Context) -> None:
        user_id = ctx.author.id
        if user_id in self.bot._user_filters:
            self.bot._user_filters[user_id].subscribed = False
        await ctx.respond("✅ **Unsubscribed.** No more bounty notifications.", ephemeral=True)

    @commands.slash_command(name="filters", description="Set notification filters")
    async def set_filters(
        self,
        ctx: commands.Context,
        min_reward: float = 0,
        max_reward: float = 0,
        tiers: str = "",
        tags: str = "",
    ) -> None:
        """Set notification filters for bounty types and reward levels.

        Parameters
        ----------
        min_reward: Minimum reward amount in $FNDRY
        max_reward: Maximum reward amount in $FNDRY
        tiers: Comma-separated tier numbers (e.g., "1,2")
        tags: Comma-separated tags (e.g., "backend,frontend")
        """
        user_id = ctx.author.id
        if user_id not in self.bot._user_filters:
            self.bot._user_filters[user_id] = UserFilter(user_id=user_id)

        uf = self.bot._user_filters[user_id]
        if min_reward > 0:
            uf.min_reward = min_reward
        if max_reward > 0:
            uf.max_reward = max_reward
        if tiers:
            uf.tiers = [int(t.strip()) for t in tiers.split(",") if t.strip().isdigit()]
        if tags:
            uf.tags = [t.strip() for t in tags.split(",") if t.strip()]

        embed = discord.Embed(
            title="✅ Filters Updated",
            color=discord.Color.green(),
            description=(
                f"**Min Reward:** {uf.min_reward or 'Any'} $FNDRY\n"
                f"**Max Reward:** {uf.max_reward or 'Any'} $FNDRY\n"
                f"**Tiers:** {', '.join(str(t) for t in uf.tiers) or 'Any'}\n"
                f"**Tags:** {', '.join(uf.tags) or 'Any'}\n"
            ),
        )
        await ctx.respond(embed=embed, ephemeral=True)

    @commands.slash_command(name="leaderboard", description="Show top contributors leaderboard")
    async def leaderboard(self, ctx: commands.Context) -> None:
        """Display the leaderboard of top contributors."""
        await ctx.defer()

        import httpx

        url = f"{settings.solfoundry_api_url}/api/leaderboard"
        headers = {"Accept": "application/json"}
        if settings.solfoundry_api_token:
            headers["Authorization"] = f"Bearer {settings.solfoundry_api_token}"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=headers, timeout=30.0)
                resp.raise_for_status()
                data = resp.json()

            # Parse leaderboard entries
            entries = []
            if isinstance(data, list):
                for entry in data[:10]:
                    name = entry.get("name", entry.get("username", "Unknown"))
                    tasks = entry.get("tasks_completed", entry.get("tasks", 0))
                    reward = entry.get("total_reward", entry.get("reward", 0))
                    entries.append((name, tasks, reward))
            elif isinstance(data, dict):
                raw = data.get("leaderboard", data.get("entries", data.get("data", [])))
                for entry in raw[:10]:
                    name = entry.get("name", entry.get("username", "Unknown"))
                    tasks = entry.get("tasks_completed", entry.get("tasks", 0))
                    reward = entry.get("total_reward", entry.get("reward", 0))
                    entries.append((name, tasks, reward))

            embed = self.bot._build_leaderboard_embed(entries)
            await ctx.respond(embed=embed)

        except Exception as e:
            logger.error("Leaderboard fetch error: %s", e)
            # Fallback: show placeholder
            embed = discord.Embed(
                title="🏆 Top Contributors",
                description="Leaderboard data coming soon!",
                color=discord.Color.gold(),
            )
            await ctx.respond(embed=embed)

    @commands.slash_command(name="stats", description="Show bot statistics")
    async def stats(self, ctx: commands.Context) -> None:
        """Display bot statistics."""
        stats = self.bot.get_stats()
        embed = discord.Embed(
            title="📊 Bot Statistics",
            color=discord.Color.blue(),
            timestamp=datetime.now(),
        )
        embed.add_field(name="📨 Bounties Posted", value=str(stats.bounties_posted), inline=True)
        embed.add_field(name="👥 Subscribers", value=str(stats.subscribers), inline=True)
        embed.add_field(name="🕐 Last Check", value=stats.last_check or "Never", inline=False)
        if stats.recent_errors:
            embed.add_field(
                name="⚠️ Recent Errors",
                value=f"{len(stats.recent_errors)} errors",
                inline=False,
            )
        await ctx.respond(embed=embed)

    @commands.slash_command(name="help", description="Show available commands")
    async def help_cmd(self, ctx: commands.Context) -> None:
        """Display help information."""
        embed = discord.Embed(
            title="🤖 SolFoundry Discord Bot",
            description="Get real-time bounty notifications from SolFoundry!",
            color=discord.Color.blue(),
        )
        embed.add_field(
            name="/subscribe",
            value="Subscribe to bounty notifications",
            inline=False,
        )
        embed.add_field(
            name="/unsubscribe",
            value="Stop receiving notifications",
            inline=False,
        )
        embed.add_field(
            name="/filters",
            value="Set filters: `/filters min_reward:100 tiers:1,2 tags:backend`",
            inline=False,
        )
        embed.add_field(
            name="/leaderboard",
            value="View top contributors",
            inline=False,
        )
        embed.add_field(
            name="/stats",
            value="Show bot statistics",
            inline=False,
        )
        await ctx.respond(embed=embed)