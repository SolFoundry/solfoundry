"""
API endpoint for bounty statistics - COMPLETE SOLUTION
This is the solution for GitHub Bounty Issue #344
"""

from datetime import datetime
from typing import Dict, Any
from dataclasses import dataclass, asdict

from fastapi import APIRouter, Depends
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

from app.services.bounty_service import BountyService
from app.services.contributor_service import ContributorService
from app.services.leaderboard_service import LeaderboardService

router = APIRouter(prefix="/api", tags=["stats"])

@dataclass
class BountyStats:
    """Bounty statistics data model"""
    total_bounties_created: int
    total_bounties_completed: int
    total_bounties_open: int
    total_contributors: int
    total_fndry_paid: int
    total_prs_reviewed: int
    bounties_by_tier: Dict[str, Dict[str, int]]
    top_contributor: Dict[str, Any]

def get_stats_service(
    bounty_service: BountyService = Depends(),
  contributor_service: ContributorService = Depends(),
    leaderboard_service: LeaderboardService = Depends(),
) -> Dict[str, Any]\:
    """Aggregate statistics from various services"""
    
    # Get data from services
    bounty_data = bounty_service.get_aggregate_stats()
    tier_data = bounty_service.get_bounties_by_tier()
    total_contributors = contributor_service.get_total_contributors()
    top_contributor = contributor_service.get_top_contributor()
    financial_data = leaderboard_service.get_financial_stats()
    
    # Create stats object
    stats = BountyStats(
        total_bounties_created=bounty_data.total_created,
        total_bounties_completed=bounty_data.total_completed,
        total_bounties_open=bounty_data.total_open,
        total_contributors=total_contributors,
        total_fndry_paid=financial_data.total_paid,
        total_prs_reviewed=financial_data.total_prs_reviewed,
        bounties_by_tier={
            tier: {
                "open": data.open_count,
                "completed": data.completed_count
            }
            for tier, data in tier_data.items()
        },
        top_contributor={
            "username": top_contributor.
  username,
            "bounties_completed": top_contributor.bounties_completed
        }
    )
    
    return asdict(stats)

@router.get("/stats", summary="Get bounty statistics")
@cache(expire=300)  # 5 minutes cache
async def get_stats(
    stats_data: Dict[str, Any] = Depends(get_stats_service)
) -> Dict[str, Any]\:
    """
    Returns aggregate statistics about the bounty program.
    
    This endpoint provides an overview of the bounty program's performance,
    including totals for bounties created, completed, and paid out.
    
    Data is cached for 5 minutes to avoid recomputation on every request.
    """
    return stats_data

# For testing - override dependency
def override_get_stats_service():
    """Override for testing"""
    return {
        "total_bounties_created": 50,
        "total_bounties_completed": 35,
        "total_bounties_open": 12,
        "total_contributors": 25,
        "total_fndry_paid": 5000000,
        "total_prs_reviewed": 200,
        "bounties_by_tier": {
            "tier-1": {"open": 5, "completed": 25},
            "tier-2": {"open": 5, "completed": 8},
            "tier-3": {"open": 2, "completed": 2}
        },
        "top_c
  ontributor": {
            "username": "HuiNeng6",
            "bounties_completed": 17
        }
    }
