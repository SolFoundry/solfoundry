"""Bot configuration loaded from environment variables."""
from dataclasses import dataclass
from os import getenv
from typing import Optional


@dataclass
class BotConfig:
    telegram_bot_token: str = getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_channel_id: str = getenv("TELEGRAM_CHANNEL_ID", "")

    github_token: str = getenv("GITHUB_TOKEN", "")
    github_repo: str = getenv("GITHUB_REPO", "SolFoundry/solfoundry")
    github_webhook_secret: str = getenv("GITHUB_WEBHOOK_SECRET", "")

    solfoundry_api_url: Optional[str] = getenv("SOLFOUNDRY_API_URL")

    redis_url: str = getenv("REDIS_URL", "redis://localhost:6379/0")

    bot_mode: str = getenv("BOT_MODE", "polling")
    webhook_host: str = getenv("WEBHOOK_HOST", "")
    webhook_path: str = getenv("WEBHOOK_PATH", "/telegram/webhook")

    log_level: str = getenv("LOG_LEVEL", "INFO")

    @property
    def full_webhook_url(self) -> str:
        return f"{self.webhook_host.rstrip('/')}{self.webhook_path}"

    def validate(self) -> list[str]:
        errors = []
        if not self.telegram_bot_token:
            errors.append("TELEGRAM_BOT_TOKEN is required")
        if not self.telegram_channel_id:
            errors.append("TELEGRAM_CHANNEL_ID is required")
        return errors


config = BotConfig()
