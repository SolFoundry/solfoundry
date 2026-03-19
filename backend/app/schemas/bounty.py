"""Bounty schemas."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class BountySearch(BaseModel):
    """Bounty search request."""
    q: Optional[str] = None
    tier: Optional[int] = None
    category: Optional[str] = None
    status: Optional[str] = None
    reward_min: Optional[Decimal] = None
    reward_max: Optional[Decimal] = None
    skills: Optional[List[str]] = None
    sort_by: Optional[str] = "newest"  # newest, reward_high, reward_low, deadline, popularity
    page: int = 1
    page_size: int = 20


class BountyResponse(BaseModel):
    """Bounty response."""
    id: int
    title: str
    description: str
    tier: int
    category: Optional[str]
    status: str
    reward_min: Optional[Decimal]
    reward_max: Optional[Decimal]
    skills: Optional[List[str]]
    deadline: Optional[datetime]
    github_issue_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class BountiesResponse(BaseModel):
    """Paginated bounties response."""
    bounties: list[BountyResponse]
    total: int
    page: int
    page_size: int


class SuggestionResponse(BaseModel):
    """Autocomplete suggestion."""
    suggestions: list[str]
