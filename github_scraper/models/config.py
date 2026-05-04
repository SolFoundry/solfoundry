"""Configuration models for the GitHub Issue Scraper."""

from __future__ import annotations

import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class RepoSource:
    """A GitHub repository to scrape issues from."""
    owner: str
    repo: str
    label_filter: list[str] = field(default_factory=lambda: ["bounty", "bug", "feature", "help wanted"])
    state_filter: str = "open"
    min_stars: int = 0
    priority: int = 0  # Higher = scraped first
    rate_limit_rpm: int = 60  # Requests per minute

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"

    @classmethod
    def from_dict(cls, data: dict) -> "RepoSource":
        return cls(
            owner=data["owner"],
            repo=data["repo"],
            label_filter=data.get("label_filter", ["bounty", "bug", "feature", "help wanted"]),
            state_filter=data.get("state_filter", "open"),
            min_stars=data.get("min_stars", 0),
            priority=data.get("priority", 0),
            rate_limit_rpm=data.get("rate_limit_rpm", 60),
        )


@dataclass
class ScraperConfig:
    """Main configuration for the scraper service."""
    repos: list[RepoSource] = field(default_factory=list)
    poll_interval_seconds: int = 300  # 5 minutes default
    webhook_port: int = 8090
    webhook_secret: str = ""
    solfoundry_api_url: str = "https://solfoundry.org/api"
    solfoundry_api_key: str = ""
    github_token: str = ""
    max_issues_per_repo: int = 100
    dedup_similarity_threshold: float = 0.85
    log_level: str = "INFO"
    database_url: str = "sqlite:///scraper.db"

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ScraperConfig":
        """Load configuration from a YAML file."""
        with open(path) as f:
            data = yaml.safe_load(f) or {}

        repos = [RepoSource.from_dict(r) for r in data.get("repos", [])]
        return cls(
            repos=repos,
            poll_interval_seconds=data.get("poll_interval_seconds", 300),
            webhook_port=data.get("webhook_port", 8090),
            webhook_secret=data.get("webhook_secret", ""),
            solfoundry_api_url=data.get("solfoundry_api_url", "https://solfoundry.org/api"),
            solfoundry_api_key=data.get("solfoundry_api_key", ""),
            github_token=data.get("github_token", ""),
            max_issues_per_repo=data.get("max_issues_per_repo", 100),
            dedup_similarity_threshold=data.get("dedup_similarity_threshold", 0.85),
            log_level=data.get("log_level", "INFO"),
            database_url=data.get("database_url", "sqlite:///scraper.db"),
        )
