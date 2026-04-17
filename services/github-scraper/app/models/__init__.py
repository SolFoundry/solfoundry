"""GitHub Issue Scraper — Data Models."""

from __future__ import annotations

from datetime import datetime
from enum import IntEnum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Tier & Status Enums
# ---------------------------------------------------------------------------

class BountyTier(IntEnum):
    T1 = 1
    T2 = 2
    T3 = 3


class ImportStatus(str):
    PENDING = "pending"
    IMPORTED = "imported"
    FAILED = "failed"
    SKIPPED = "skipped"
    UPDATED = "updated"


# ---------------------------------------------------------------------------
# Repository Configuration
# ---------------------------------------------------------------------------

class RepoConfig(BaseModel):
    """Configuration for a single watched repository."""

    owner: str
    repo: str
    label_mapping: dict[str, int | bool] = Field(
        default_factory=lambda: {
            "bounty": True,
            "tier-1": 1,
            "tier-2": 2,
            "tier-3": 3,
        }
    )
    default_tier: int = Field(default=2, ge=1, le=3)
    default_reward: dict[int, int] = Field(
        default_factory=lambda: {1: 200_000, 2: 600_000, 3: 1_200_000}
    )
    category: str = "backend"
    enabled: bool = True

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"

    def get_tier(self, labels: list[str]) -> int:
        """Determine bounty tier from GitHub issue labels."""
        for label in labels:
            lower = label.lower().strip()
            for mapping_key, mapping_val in self.label_mapping.items():
                if lower == mapping_key.lower() and isinstance(mapping_val, int) and not isinstance(mapping_val, bool):
                    return mapping_val
        return self.default_tier

    def get_reward(self, tier: int) -> int:
        """Get reward amount for a given tier."""
        return self.default_reward.get(tier, self.default_reward.get(self.default_tier, 600_000))

    def has_bounty_label(self, labels: list[str]) -> bool:
        """Check if the issue has the qualifying bounty label."""
        for label in labels:
            lower = label.lower().strip()
            for mapping_key, mapping_val in self.label_mapping.items():
                if lower == mapping_key.lower() and mapping_val is True:
                    return True
        return False


class RepoConfigList(BaseModel):
    """Top-level repos.yaml structure."""

    repositories: list[RepoConfig] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# GitHub Issue (from API)
# ---------------------------------------------------------------------------

class GitHubIssue(BaseModel):
    """A GitHub issue from the REST API."""

    number: int
    title: str
    body: str = ""
    state: str = "open"
    labels: list[str] = Field(default_factory=list)
    html_url: str = ""
    created_at: str = ""
    updated_at: str = ""
    milestone: Optional[str] = None
    assignees: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Import Record (dedup tracking)
# ---------------------------------------------------------------------------

class ImportRecord(BaseModel):
    """Tracks an issue that has been imported as a bounty."""

    id: Optional[int] = None
    repo_owner: str
    repo_name: str
    issue_number: int
    issue_url: str
    bounty_id: Optional[str] = None
    tier: int = 2
    reward_amount: int = 0
    status: str = ImportStatus.PENDING
    error_message: Optional[str] = None
    imported_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# SolFoundry Bounty Create (matches backend API)
# ---------------------------------------------------------------------------

class BountyCreateRequest(BaseModel):
    """Payload for creating a bounty via the SolFoundry API."""

    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(default="", max_length=5000)
    tier: int = Field(default=2, ge=1, le=3)
    category: str = "backend"
    reward_amount: int = Field(..., gt=0)
    required_skills: list[str] = Field(default_factory=list)
    github_issue_url: str = ""
    deadline: Optional[str] = None
    created_by: str = "github-scraper"


# ---------------------------------------------------------------------------
# API Request/Response Models
# ---------------------------------------------------------------------------

class AddRepoRequest(BaseModel):
    """Request to add a repository to the watch list."""

    owner: str
    repo: str
    default_tier: int = Field(default=2, ge=1, le=3)
    category: str = "backend"
    enabled: bool = True


class AddRepoResponse(BaseModel):
    message: str
    repo: RepoConfig


class TriggerScrapeResponse(BaseModel):
    message: str
    issues_found: int = 0
    bounties_created: int = 0
    bounties_skipped: int = 0
    errors: int = 0


class ScraperStatus(BaseModel):
    enabled: bool
    interval_seconds: int
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    repos_watched: int = 0
    total_imported: int = 0


class WebhookEvent(BaseModel):
    """Parsed GitHub webhook event."""

    action: str
    repo_owner: str
    repo_name: str
    issue: Optional[GitHubIssue] = None