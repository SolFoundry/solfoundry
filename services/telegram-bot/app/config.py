"""SolFoundry Telegram Bot — configuration."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    service_name: str = "telegram-bot"
    debug: bool = False

    # ── Telegram ─────────────────────────────────────────────────────────
    telegram_token: str = ""
    telegram_chat_id: str = ""  # Default channel/group to post bounties to
    telegram_webhook_url: str = ""  # Optional webhook URL for Telegram

    # ── SolFoundry API ───────────────────────────────────────────────────
    solfoundry_api_url: str = "http://localhost:8000"
    solfoundry_api_token: str = ""

    # ── Polling ──────────────────────────────────────────────────────────
    poll_interval_seconds: int = 60  # How often to check for new bounties
    max_bounties_per_poll: int = 20

    # ── Proxy (for regions with restricted Telegram access) ──────────────
    telegram_proxy_url: str = ""

    # ── Server ───────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8020

    class Config:
        env_prefix = "TELEGRAM_BOT_"
        env_file = ".env"


settings = Settings()