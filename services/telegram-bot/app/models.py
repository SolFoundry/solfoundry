"""SolFoundry Telegram Bot — Pydantic models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── SolFoundry API models ─────────────────────────────────────────────────────

class BountyItem(BaseModel):
    """A bounty as returned by the SolFoundry API."""

    class Config:
        extra = "ignore"

    id: str
    title: str
    description: str = ""
    reward_amount: float = 0
    reward_token: str = "FNDRY"
    tier: int = 1
    status: str = "open"
    tags: list[str] = []
    source_url: str = ""
    created_at: datetime | None = None
    github_url: str = ""


class BountyListResponse(BaseModel):
    """Paginated bounty list from SolFoundry API."""
    bounties: list[BountyItem] = []
    total: int = 0
    page: int = 1
    per_page: int = 20


# ── Subscription models ───────────────────────────────────────────────────────

class Subscription(BaseModel):
    """A user's subscription to bounty notifications."""
    chat_id: int
    username: str = ""
    subscribed_at: datetime = Field(default_factory=datetime.now)
    filters: dict[str, Any] = Field(default_factory=dict)
    # Filters: {"min_reward": 0, "max_reward": 0, "tags": [], "tiers": []}


# ── Bot state models ──────────────────────────────────────────────────────────

class BotStats(BaseModel):
    """Bot statistics."""
    total_bounties_posted: int = 0
    total_subscribers: int = 0
    last_check: str | None = None
    last_bounty_at: str | None = None
    errors: list[str] = []


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    service: str = "telegram-bot"
    subscribers: int = 0
    bounties_posted: int = 0
    last_check: str | None = None