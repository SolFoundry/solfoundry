#!/usr/bin/env python3
"""
SolFoundry Discord Bounty Bot

Features:
- New bounty postings with rich embeds
- /leaderboard command - top contributors
- /subscribe command - filter by bounty type/level
- /unsubscribe command
- User preference storage (SQLite)
- Configurable notification filters

Fixes #853
"""

import os
import json
import sqlite3
import asyncio
import logging
from datetime import datetime
from typing import Optional, List, Dict

import discord
from discord import app_commands
from discord.ext import tasks, commands
import aiohttp

# Configuration
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO", "SolFoundry/solfoundry")
DATABASE_PATH = os.getenv("DATABASE_PATH", "bounty_bot.db")

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Bounty types and reward levels
BOUNTY_TYPES = ["feature", "bugfix", "integration", "documentation", "testing"]
REWARD_LEVELS = ["T1", "T2", "T3"]  # T1: 1M+, T2: 500K, T3: 100K


class BountyDatabase:
    """SQLite database for user preferences and bounty tracking"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # User subscriptions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                user_id TEXT PRIMARY KEY,
                bounty_types TEXT DEFAULT '[]',
                reward_levels TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Posted bounties table (to avoid duplicates)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS posted_bounties (
                issue_number INTEGER PRIMARY KEY,
                posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Leaderboard cache
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS leaderboard_cache (
                cache_key TEXT PRIMARY KEY,
                data TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")
    
    def get_user_subscription(self, user_id: str) -> Dict:
        """Get user's subscription preferences"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT bounty_types, reward_levels FROM user_subscriptions WHERE user_id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "bounty_types": json.loads(row[0] or "[]"),
                "reward_levels": json.loads(row[1] or "[]")
            }
        return {"bounty_types": [], "reward_levels": []}
    
    def set_user_subscription(self, user_id: str, bounty_types: List[str], reward_levels: List[str]):
        """Set user's subscription preferences"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO user_subscriptions (user_id, bounty_types, reward_levels, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ''', (user_id, json.dumps(bounty_types), json.dumps(reward_levels)))
        conn.commit()
        conn.close()
        logger.info(f"Updated subscription for user {user_id}")
    
    def is_bounty_posted(self, issue_number: int) -> bool:
        """Check if bounty was already posted"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM posted_bounties WHERE issue_number = ?",
            (issue_number,)
        )
        exists = cursor.fetchone() is not None
        conn.close()
        return exists
    
    def mark_bounty_posted(self, issue_number: int):
        """Mark bounty as posted"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO posted_bounties (issue_number) VALUES (?)",
            (issue_number,)
        )
        conn.commit()
        conn.close()
    
    def get_subscribed_users(self, bounty_type: Optional[str] = None, reward_level: Optional[str] = None) -> List[str]:
        """Get list of users who should be notified for this bounty"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, bounty_types, reward_levels FROM user_subscriptions")
        rows = cursor.fetchall()
        conn.close()
        
        subscribed_users = []
        for user_id, types_json, levels_json in rows:
            types = json.loads(types_json or "[]")
            levels = json.loads(levels_json or "[]")
            
            # If user has no filters, they get all notifications
            if not types and not levels:
                subscribed_users.append(user_id)
                continue
            
            # Check if bounty matches user's filters
            type_match = not types or (bounty_type and bounty_type in types)
            level_match = not levels or (reward_level and reward_level in levels)
            
            if type_match and level_match:
                subscribed_users.append(user_id)
        
        return subscribed_users


class SolFoundryBot(commands.Bot):
    """SolFoundry Discord Bot"""
    
    def __init__(self, db: BountyDatabase):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix="!", intents=intents)
        self.db = db
        self.github_session: Optional[aiohttp.ClientSession] = None
    
    async def setup_hook(self):
        """Setup bot components"""
        self.github_session = aiohttp.ClientSession(
            headers={"Authorization": f"token {GITHUB_TOKEN}"}
        )
        logger.info("Bot setup complete")
    
    async def on_ready(self):
        """Called when bot is ready"""
        logger.info(f'Logged in as {self.user} (ID: {self.user.id})')
        logger.info(f'Connected to {len(self.guilds)} guild(s)')
        
        # Start bounty monitoring task
        self.check_new_bounties.start()
    
    async def on_close(self):
        """Cleanup on bot shutdown"""
        if self.github_session:
            await self.github_session.close()
    
    @tasks.loop(minutes=5)
    async def check_new_bounties(self):
        """Check for new bounties every 5 minutes"""
        try:
            await self.fetch_and_post_bounties()
        except Exception as e:
            logger.error(f"Error checking bounties: {e}")
    
    @check_new_bounties.before_loop
    async def before_check_bounties(self):
        """Wait until bot is ready"""
        await self.wait_until_ready()
    
    async def fetch_and_post_bounties(self):
        """Fetch new bounties from GitHub and post to Discord"""
        if not self.github_session:
            return
        
        # Fetch issues with bounty label
        url = f"https://api.github.com/repos/{GITHUB_REPO}/issues?labels=bounty&state=open"
        
        async with self.github_session.get(url) as response:
            if response.status != 200:
                logger.error(f"GitHub API error: {response.status}")
                return
            
            issues = await response.json()
        
        for issue in issues:
            issue_number = issue["number"]
            
            # Skip if already posted
            if self.db.is_bounty_posted(issue_number):
                continue
            
            # Parse bounty info
            title = issue["title"]
            body = issue["body"] or ""
            labels = [label["name"] for label in issue.get("labels", [])]
            
            # Determine bounty type and reward level from labels/title
            bounty_type = self._detect_bounty_type(labels, title)
            reward_level = self._detect_reward_level(labels, body)
            
            # Create embed
            embed = self._create_bounty_embed(issue, bounty_type, reward_level)
            
            # Get subscribed users
            subscribed_users = self.db.get_subscribed_users(bounty_type, reward_level)
            
            # Post to channels
            for guild in self.guilds:
                for channel in guild.text_channels:
                    if "bounty" in channel.name or "notifications" in channel.name:
                        try:
                            await channel.send(embed=embed)
                            if subscribed_users:
                                mentions = " ".join([f"<@{uid}>" for uid in subscribed_users[:10]])
                                if mentions:
                                    await channel.send(f"New bounty alert! {mentions}")
                            self.db.mark_bounty_posted(issue_number)
                            logger.info(f"Posted bounty #{issue_number} to {channel.name}")
                        except Exception as e:
                            logger.error(f"Error posting to channel {channel.name}: {e}")
    
    def _detect_bounty_type(self, labels: List[str], title: str) -> Optional[str]:
        """Detect bounty type from labels and title"""
        title_lower = title.lower()
        
        for label in labels:
            if "feature" in label.lower():
                return "feature"
            if "bug" in label.lower() or "fix" in label.lower():
                return "bugfix"
            if "integration" in label.lower():
                return "integration"
            if "doc" in label.lower():
                return "documentation"
            if "test" in label.lower():
                return "testing"
        
        if "feature" in title_lower:
            return "feature"
        if "bug" in title_lower or "fix" in title_lower:
            return "bugfix"
        
        return None
    
    def _detect_reward_level(self, labels: List[str], body: str) -> Optional[str]:
        """Detect reward level from labels and body"""
        body_lower = body.lower()
        
        for label in labels:
            if "t1" in label.lower() or "tier 1" in label.lower():
                return "T1"
            if "t2" in label.lower() or "tier 2" in label.lower():
                return "T2"
            if "t3" in label.lower() or "tier 3" in label.lower():
                return "T3"
        
        if "1m" in body_lower or "1000k" in body_lower:
            return "T1"
        if "500k" in body_lower:
            return "T2"
        if "100k" in body_lower:
            return "T3"
        
        return None
    
    def _create_bounty_embed(self, issue: Dict, bounty_type: Optional[str], reward_level: Optional[str]) -> discord.Embed:
        """Create a rich embed for bounty notification"""
        embed = discord.Embed(
            title=issue["title"],
            url=issue["html_url"],
            color=discord.Color.gold()
        )
        
        # Add bounty badge
        badge = "🏭"
        if reward_level:
            badge = f"🏆 {reward_level}"
        
        embed.set_author(name=f"{badge} SolFoundry Bounty #{issue['number']}")
        
        # Description (truncated if too long)
        description = issue["body"] or "No description provided"
        if len(description) > 500:
            description = description[:497] + "..."
        embed.description = description
        
        # Fields
        embed.add_field(
            name="Type",
            value=bounty_type or "General",
            inline=True
        )
        
        embed.add_field(
            name="Reward Level",
            value=reward_level or "TBD",
            inline=True
        )
        
        embed.add_field(
            name="Status",
            value="Open",
            inline=True
        )
        
        # Labels
        labels = [label["name"] for label in issue.get("labels", [])]
        if labels:
            embed.add_field(
                name="Labels",
                value=", ".join(labels[:5]),
                inline=False
            )
        
        # Footer
        embed.set_footer(
            text=f"Created by {issue['user']['login']} • Click title to view on GitHub"
        )
        
        embed.timestamp = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
        
        return embed
    
    # Slash Commands
    
    @app_commands.command(name="leaderboard", description="Display top bounty contributors")
    async def leaderboard(self, interaction: discord.Interaction):
        """Display leaderboard of top contributors"""
        await interaction.response.defer()
        
        try:
            # Fetch contributors from GitHub
            url = f"https://api.github.com/repos/{GITHUB_REPO}/contributors"
            
            async with self.github_session.get(url) as response:
                if response.status != 200:
                    await interaction.followup.send("Failed to fetch leaderboard data")
                    return
                
                contributors = await response.json()
            
            # Create embed
            embed = discord.Embed(
                title="🏆 SolFoundry Leaderboard",
                description="Top contributors by contributions",
                color=discord.Color.gold()
            )
            
            # Top 10 contributors
            for i, contributor in enumerate(contributors[:10], 1):
                medals = ["🥇", "🥈", "🥉"]
                medal = medals[i-1] if i <= 3 else f"{i}."
                
                embed.add_field(
                    name=f"{medal} {contributor['login']}",
                    value=f"{contributor['contributions']} contributions",
                    inline=True
                )
            
            embed.set_footer(text="Data from GitHub • Updated in real-time")
            embed.timestamp = datetime.utcnow()
            
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error(f"Leaderboard error: {e}")
            await interaction.followup.send("An error occurred while fetching the leaderboard")
    
    @app_commands.command(name="subscribe", description="Subscribe to bounty notifications")
    @app_commands.describe(
        bounty_type="Filter by bounty type (feature, bugfix, integration, etc.)",
        reward_level="Filter by reward level (T1, T2, T3)"
    )
    async def subscribe(
        self,
        interaction: discord.Interaction,
        bounty_type: Optional[str] = None,
        reward_level: Optional[str] = None
    ):
        """Subscribe to bounty notifications with optional filters"""
        user_id = str(interaction.user.id)
        
        # Validate inputs
        if bounty_type and bounty_type not in BOUNTY_TYPES:
            await interaction.response.send_message(
                f"Invalid bounty type. Valid types: {', '.join(BOUNTY_TYPES)}",
                ephemeral=True
            )
            return
        
        if reward_level and reward_level not in REWARD_LEVELS:
            await interaction.response.send_message(
                f"Invalid reward level. Valid levels: {', '.join(REWARD_LEVELS)}",
                ephemeral=True
            )
            return
        
        # Get current subscription
        current = self.db.get_user_subscription(user_id)
        
        # Update with new filters
        if bounty_type:
            if bounty_type not in current["bounty_types"]:
                current["bounty_types"].append(bounty_type)
        
        if reward_level:
            if reward_level not in current["reward_levels"]:
                current["reward_levels"].append(reward_level)
        
        # Save to database
        self.db.set_user_subscription(
            user_id,
            current["bounty_types"],
            current["reward_levels"]
        )
        
        filters = []
        if current["bounty_types"]:
            filters.append(f"Types: {', '.join(current['bounty_types'])}")
        if current["reward_levels"]:
            filters.append(f"Levels: {', '.join(current['reward_levels'])}")
        
        filter_text = "All bounties" if not filters else " | ".join(filters)
        
        embed = discord.Embed(
            title="✅ Subscribed",
            description=f"You will now receive notifications for:\n**{filter_text}**",
            color=discord.Color.green()
        )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        logger.info(f"User {user_id} subscribed with filters: {current}")
    
    @app_commands.command(name="unsubscribe", description="Unsubscribe from bounty notifications")
    @app_commands.describe(
        bounty_type="Remove specific bounty type filter",
        reward_level="Remove specific reward level filter",
        all="Unsubscribe from all notifications"
    )
    async def unsubscribe(
        self,
        interaction: discord.Interaction,
        bounty_type: Optional[str] = None,
        reward_level: Optional[str] = None,
        all: Optional[bool] = False
    ):
        """Unsubscribe from bounty notifications"""
        user_id = str(interaction.user.id)
        
        if all:
            self.db.set_user_subscription(user_id, [], [])
            embed = discord.Embed(
                title="🔕 Unsubscribed",
                description="You will no longer receive bounty notifications",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            logger.info(f"User {user_id} unsubscribed from all")
            return
        
        current = self.db.get_user_subscription(user_id)
        
        if bounty_type and bounty_type in current["bounty_types"]:
            current["bounty_types"].remove(bounty_type)
        
        if reward_level and reward_level in current["reward_levels"]:
            current["reward_levels"].remove(reward_level)
        
        self.db.set_user_subscription(
            user_id,
            current["bounty_types"],
            current["reward_levels"]
        )
        
        filters = []
        if current["bounty_types"]:
            filters.append(f"Types: {', '.join(current['bounty_types'])}")
        if current["reward_levels"]:
            filters.append(f"Levels: {', '.join(current['reward_levels'])}")
        
        filter_text = "All bounties" if not filters else " | ".join(filters)
        
        embed = discord.Embed(
            title="✅ Updated",
            description=f"Your notification preferences:\n**{filter_text}**",
            color=discord.Color.blue()
        )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        logger.info(f"User {user_id} updated subscription")
    
    @app_commands.command(name="status", description="Show your current subscription status")
    async def status(self, interaction: discord.Interaction):
        """Show current subscription status"""
        user_id = str(interaction.user.id)
        subscription = self.db.get_user_subscription(user_id)
        
        embed = discord.Embed(
            title="📋 Your Subscription Status",
            color=discord.Color.blue()
        )
        
        if not subscription["bounty_types"] and not subscription["reward_levels"]:
            embed.description = "You are subscribed to **all bounty notifications**"
        else:
            filters = []
            if subscription["bounty_types"]:
                filters.append(f"**Types**: {', '.join(subscription['bounty_types'])}")
            if subscription["reward_levels"]:
                filters.append(f"**Levels**: {', '.join(subscription['reward_levels'])}")
            embed.description = "\n".join(filters)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def main():
    """Main entry point"""
    if not DISCORD_TOKEN:
        logger.error("DISCORD_TOKEN environment variable not set")
        return
    
    if not GITHUB_TOKEN:
        logger.warning("GITHUB_TOKEN not set - GitHub API calls will be rate limited")
    
    db = BountyDatabase(DATABASE_PATH)
    bot = SolFoundryBot(db)
    
    try:
        await bot.start(DISCORD_TOKEN)
    except Exception as e:
        logger.error(f"Bot error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
