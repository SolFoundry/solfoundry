"""Pydantic models for GitHub issues / bounty data."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Bounty:
    """Represents a SolFoundry bounty (GitHub issue)."""
    number: int
    title: str
    body: str
    state: str
    labels: list[str]
    assignee: Optional[str]
    created_at: datetime
    updated_at: datetime
    html_url: str

    @property
    def is_open(self) -> bool:
        return self.state == "open"

    @property
    def tier(self) -> Optional[str]:
        for label in self.labels:
            if label.startswith("bounty-tier-"):
                return label.replace("bounty-tier-", "")
        return None

    @property
    def reward(self) -> Optional[str]:
        for label in self.labels:
            if label.startswith("bounty-reward-"):
                return label.replace("bounty-reward-", "") + " FNDRY"
        return None

    @property
    def bounty_type(self) -> Optional[str]:
        type_labels = {"bounty-feature", "bounty-bug", "bounty-docs", "bounty-integration", "bounty-security"}
        for label in self.labels:
            if label in type_labels:
                return label.replace("bounty-", "")
        return None

    def matches_filter(self, user_filter: "UserFilter") -> bool:
        if user_filter.tiers and self.tier not in user_filter.tiers:
            return False
        if user_filter.types and self.bounty_type not in user_filter.types:
            return False
        if user_filter.min_reward and self.reward:
            try:
                reward_num = int("".join(filter(str.isdigit, self.reward)))
                if reward_num < user_filter.min_reward:
                    return False
            except ValueError:
                pass
        return True


@dataclass
class UserFilter:
    """Per-user notification filter settings."""
    user_id: int
    tiers: Optional[list[str]] = None
    types: Optional[list[str]] = None
    min_reward: Optional[int] = None
    keywords: Optional[list[str]] = None

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "tiers": self.tiers,
            "types": self.types,
            "min_reward": self.min_reward,
            "keywords": self.keywords,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "UserFilter":
        return cls(
            user_id=data["user_id"],
            tiers=data.get("tiers"),
            types=data.get("types"),
            min_reward=data.get("min_reward"),
            keywords=data.get("keywords"),
        )


@dataclass
class LeaderboardEntry:
    rank: int
    username: str
    merged_count: int
    total_reward: int
    avatar_url: Optional[str] = None
