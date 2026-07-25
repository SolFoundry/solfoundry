"""SolFoundry Discord Bot — configuration."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    service_name: str = "discord-bot"
    debug: bool = False

    # ── Discord ──────────────────────────────────────────────────────────
    discord_token: str = ""
    discord_guild_id: str = ""  # Guild to register slash commands in
    discord_channel_id: str = ""  # Default channel to post bounties to

    # ── SolFoundry API ───────────────────────────────────────────────────
    solfoundry_api_url: str = "http://localhost:8000"
    solfoundry_api_token: str = ""

    # ── Polling ──────────────────────────────────────────────────────────
    poll_interval_seconds: int = 60
    max_bounties_per_poll: int = 20

    # ── Server ───────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8030

    class Config:
        env_prefix = "DISCORD_BOT_"
        env_file = ".env"


settings = Settings()