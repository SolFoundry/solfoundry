"""Issue and bounty mapping models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class IssueState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    ALL = "all"


class BountyTier(str, Enum):
    T0_CRITICAL = "T0"
    T1_MAJOR = "T1"
    T2_STANDARD = "T2"
    T3_MINOR = "T3"
    T4_MICRO = "T4"


TIER_REWARD_MAP: dict[BountyTier, str] = {
    BountyTier.T0_CRITICAL: "1M+ $FNDRY",
    BountyTier.T1_MAJOR: "500K-1M $FNDRY",
    BountyTier.T2_STANDARD: "100K-500K $FNDRY",
    BountyTier.T3_MINOR: "10K-100K $FNDRY",
    BountyTier.T4_MICRO: "1K-10K $FNDRY",
}


@dataclass
class ScrapedIssue:
    """A GitHub issue scraped from a repository."""
    source_repo: str  # owner/repo
    issue_number: int
    title: str
    body: str
    state: str
    labels: list[str] = field(default_factory=list)
    author: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    comments_count: int = 0
    url: str = ""
    html_url: str = ""
    assignees: list[str] = field(default_factory=list)

    @property
    def unique_key(self) -> str:
        """Unique identifier for deduplication."""
        return f"{self.source_repo}#{self.issue_number}"

    def to_dict(self) -> dict:
        return {
            "source_repo": self.source_repo,
            "issue_number": self.issue_number,
            "title": self.title,
            "body": self.body[:500],  # Truncate for API
            "state": self.state,
            "labels": self.labels,
            "author": self.author,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "comments_count": self.comments_count,
            "url": self.url,
            "html_url": self.html_url,
        }


@dataclass
class BountyMapping:
    """Mapping from a scraped issue to a SolFoundry bounty."""
    issue: ScrapedIssue
    tier: BountyTier
    reward: str
    title: str
    description: str
    domain: str = "Backend"
    auto_posted: bool = False
    solfoundry_id: Optional[str] = None

    def to_post_payload(self) -> dict:
        """Convert to SolFoundry API payload."""
        return {
            "title": self.title,
            "description": self.description,
            "reward": self.reward,
            "tier": self.tier.value,
            "domain": self.domain,
            "source_issue_url": self.issue.html_url,
            "source_repo": self.issue.source_repo,
            "labels": self.issue.labels,
        }
