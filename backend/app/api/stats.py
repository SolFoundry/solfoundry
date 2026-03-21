"""Bounty stats API endpoint.

Public endpoint returning aggregate statistics about the bounty program.
Cached for 5 minutes to avoid recomputing on every request.
"""

import logging
from typing import Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import bounty_service, contributor_service, treasury_service
from app.models.payout import TokenomicsResponse, TreasuryStats

logger = logging.getLogger(__name__)


class TierStats(BaseModel):
    """Statistics for a single tier."""
    open: int
    completed: int


class TopContributor(BaseModel):
    """Top contributor information."""
    username: str
    bounties_completed: int


class StatsResponse(BaseModel):
    """Bounty program statistics response."""
    total_bounties_created: int
    total_bounties_completed: int
    total_bounties_open: int
    total_contributors: int
    total_fndry_paid: float
    total_prs_reviewed: int
    bounties_by_tier: Dict[str, TierStats]
    top_contributor: Optional[TopContributor]


router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats() -> StatsResponse:
    """Get bounty program statistics.
    
    Returns aggregate statistics about the bounty program:
    - Total bounties (created, completed, open)
    - Total contributors
    - Total $FNDRY paid out
    - Total PRs reviewed
    - Breakdown by tier
    - Top contributor
    """
    # Fetch from database via services
    total_created = await bounty_service.count_bounties()
    total_completed = await bounty_service.count_bounties(status="completed")
    total_open = await bounty_service.count_bounties(status="open")
    total_contributors = await contributor_service.count_contributors()
    
    # Tier breakdown
    tier_stats = {}
    for t in ["tier-1", "tier-2", "tier-3"]:
        tier_stats[t] = TierStats(
            open=await bounty_service.count_bounties(tier=t, status="open"),
            completed=await bounty_service.count_bounties(tier=t, status="completed")
        )

    # Note: For total paid and prs reviewed, we might need more optimized queries in services
    # For now, we'll use placeholder or basic aggregation if available
    total_fndry_paid = 0.0 # Placeholder, should come from payout_service.get_total_paid_out()
    total_prs_reviewed = 0 # Placeholder

    return StatsResponse(
        total_bounties_created=total_created,
        total_bounties_completed=total_completed,
        total_bounties_open=total_open,
        total_contributors=total_contributors,
        total_fndry_paid=total_fndry_paid,
        total_prs_reviewed=total_prs_reviewed,
        bounties_by_tier=tier_stats,
        top_contributor=None # Should fetch top from leaderboard_service
    )


@router.get("/stats/tokenomics", response_model=TokenomicsResponse)
async def get_tokenomics() -> TokenomicsResponse:
    """Get tokenomics statistics for $FNDRY."""
    return await treasury_service.get_tokenomics()


@router.get("/stats/treasury", response_model=TreasuryStats)
async def get_treasury() -> TreasuryStats:
    """Get treasury wallet statistics."""
    return await treasury_service.get_treasury_stats()