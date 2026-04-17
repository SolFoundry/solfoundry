"""GitHub Issue Scraper for SolFoundry Bounties — Configuration."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    # GitHub API
    github_token: str = ""
    github_webhook_secret: str = ""
    github_api_base: str = "https://api.github.com"

    # SolFoundry API
    solfoundry_api_url: str = "http://localhost:8000"
    solfoundry_api_token: str = ""

    # Scraping
    scraping_interval_seconds: int = Field(default=1800, ge=60, le=86400)
    scraping_enabled: bool = True
    max_issues_per_repo: int = Field(default=100, ge=1, le=500)

    # Database
    database_url: str = "sqlite+aiosqlite:///./scraper.db"

    # Redis (optional, for distributed locking)
    redis_url: str = ""

    # Repository config
    repo_config_path: str = "./repos.yaml"

    # Server
    host: str = "0.0.0.0"
    port: int = 8001

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


# Singleton
settings = Settings()