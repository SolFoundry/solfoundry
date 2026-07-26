"""Configuration loader for the Discord bounty bot.

All configuration is read from environment variables (or a `.env` file if
``python-dotenv`` is installed). No secrets are hardcoded.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

try:  # python-dotenv is optional but recommended
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # type: ignore[misc]
    load_dotenv = None  # noqa: F841


class Config:
    """Read-only config snapshot for the Discord bot."""

    def __init__(self) -> None:
        self.discord_webhook_url: str = self._env("DISCORD_WEBHOOK_URL")
        self.github_token: Optional[str] = self._opt("GITHUB_TOKEN")
        self.solfoundry_repo: str = self._opt("SOLFOWNDRY_REPO") or "SolFoundry/solfoundry"
        self.poll_interval: int = self._int("POLL_INTERVAL", default=300)
        self.last_seen_file: str = self._opt("LAST_SEEN_FILE") or ".last_seen_bounties.json"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _env(name: str) -> str:
        value = os.environ.get(name, "")
        if not value:
            raise RuntimeError(
                f"Required environment variable {name!r} is not set. "
                "Export it or add it to your .env file."
            )
        return value

    @staticmethod
    def _opt(name: str) -> Optional[str]:
        return os.environ.get(name) or None

    @staticmethod
    def _int(name: str, default: int) -> int:
        raw = os.environ.get(name)
        if raw is None:
            return default
        try:
            value = int(raw)
        except ValueError:
            raise RuntimeError(
                f"Environment variable {name!r} must be an integer, got {raw!r}"
            )
        if value < 1:
            raise RuntimeError(
                f"Environment variable {name!r} must be a positive integer, got {value}"
            )
        return value


def get_config() -> Config:
    """Build and return the bot configuration."""
    return Config()
