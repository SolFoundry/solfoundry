"""SolFoundry GitHub Issue Scraper — Pydantic models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── GitHub API models ────────────────────────────────────────────────────────

class GitHubLabel(BaseModel):
    """A label on a GitHub issue."""
    name: str
    color: str
    description: str | None = None


class GitHubUser(BaseModel):
    """A GitHub user (minimal)."""

    class Config:
        extra = "ignore"

    login: str
    id: int
    avatar_url: str = ""


class GitHubIssue(BaseModel):
    """A GitHub issue as returned by the API."""

    class Config:
        extra = "ignore"

    id: int
    number: int
    title: str
    state: str
    body: str | None = None
    labels: list[GitHubLabel] = []
    html_url: str
    repository_url: str
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    user: GitHubUser | None = None
    assignees: list[GitHubUser] = []
    comments: int = 0


class GitHubRepo(BaseModel):
    """A GitHub repository to scrape."""
    owner: str
    name: str
    labels: list[str] = Field(default_factory=lambda: ["bounty", "good first issue"])
    min_reward: int = 0
    max_reward: int = 0


# ── SolFoundry API models ────────────────────────────────────────────────────

class BountyCreate(BaseModel):
    """Payload for creating a bounty on SolFoundry."""
    title: str
    description: str
    source_url: str
    source_issue_number: int
    source_repo: str
    reward_amount: float = 0
    tier: int = 1
    tags: list[str] = []


class BountyResponse(BaseModel):
    """Response from SolFoundry API after bounty creation."""
    id: str
    title: str
    status: str
    url: str


# ── Scraper models ───────────────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    """Request to scrape a specific repository."""
    owner: str
    repo: str
    labels: list[str] = ["bounty", "good first issue"]
    since: str | None = None


class ScrapeResult(BaseModel):
    """Result of a scrape operation."""
    repo: str
    issues_found: int
    issues_posted: int
    issues_skipped: int
    errors: list[str] = []


class WebhookPayload(BaseModel):
    """GitHub webhook payload for issue events."""
    action: str
    issue: GitHubIssue | None = None
    repository: dict[str, Any] | None = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    service: str = "github-scraper"
    scraped_repos: int = 0
    issues_posted: int = 0
    last_scrape: str | None = None