"""SolFoundry Discord Bot — Pydantic models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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


class UserFilter(BaseModel):
    """A user's notification filter preferences."""
    user_id: int
    min_reward: float = 0
    max_reward: float = 0
    tiers: list[int] = []
    tags: list[str] = []
    subscribed: bool = True


class BotStats(BaseModel):
    """Bot statistics."""
    bounties_posted: int = 0
    subscribers: int = 0
    last_check: str | None = None
    recent_errors: list[str] = []


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    service: str = "discord-bot"
    subscribers: int = 0
    bounties_posted: int = 0
    last_check: str | None = None