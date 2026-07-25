"""SolFoundry GitHub Issue Scraper — configuration."""

from __future__ import annotations

from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    service_name: str = "github-scraper"
    debug: bool = False

    # ── GitHub API ────────────────────────────────────────────────────────
    github_token: str = ""
    github_api_base: str = "https://api.github.com"

    # ── SolFoundry API ────────────────────────────────────────────────────
    solfoundry_api_url: str = "http://localhost:8000"
    solfoundry_api_token: str = ""

    # ── Scraping ──────────────────────────────────────────────────────────
    poll_interval_seconds: int = 300
    max_issues_per_repo: int = 50
    default_repos: str = ""

    # ── Redis ─────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Server ────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8010

    class Config:
        env_prefix = "SCRAPER_"
        env_file = ".env"


settings = Settings()