"""Bounty stats API endpoint.

Public endpoint returning aggregate statistics about the bounty program.
Cached for 5 minutes to avoid recomputing on every request.
"""

import logging
import time
from typing import Dict, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.bounty_service import _bounty_store
from app.services.contributor_service import _store as _contributor_store

logger = logging.getLogger(__name__)

# Cache configuration
_cache_ttl_seconds = 300  # 5 minutes
_cache: Dict[str, tuple[float, dict]] = {}


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
    total_fndry_paid: int
    total_prs_reviewed: int
    bounties_by_tier: Dict[str, TierStats]
    top_contributor: Optional[TopContributor]


router = APIRouter(tags=["stats"])


def _compute_stats() -> dict:
    """Compute bounty statistics from data stores."""
    # Bounty counts
    total_created = len(_bounty_store)
    total_completed = 0
    total_open = 0
    total_fndry_paid = 0
    total_prs_reviewed = 0

    # Tier breakdown
    tier_stats: Dict[str, Dict[str, int]] = {
        "tier-1": {"open": 0, "completed": 0},
        "tier-2": {"open": 0, "completed": 0},
        "tier-3": {"open": 0, "completed": 0},
    }

    # Count bounties
    for bounty in _bounty_store.values():
        # Status counts
        if bounty.status == "completed":
            total_completed += 1
            total_fndry_paid += bounty.reward_amount

            # Count PRs from submissions
            total_prs_reviewed += len([s for s in bounty.submissions if s.pr_url])
        elif bounty.status in ("open", "in_progress"):
            total_open += 1

        # Tier counts
        tier = bounty.tier
        if tier in tier_stats:
            if bounty.status == "completed":
                tier_stats[tier]["completed"] += 1
            elif bounty.status in ("open", "in_progress"):
                tier_stats[tier]["open"] += 1

    # Contributor counts
    total_contributors = len(_contributor_store)

    # Top contributor (by bounties_completed)
    top_contributor = None
    if _contributor_store:
        top = max(
            _contributor_store.values(),
            key=lambda c: c.total_bounties_completed,
        )
        if top.total_bounties_completed > 0:
            top_contributor = {
                "username": top.username,
                "bounties_completed": top.total_bounties_completed,
            }

    return {
        "total_bounties_created": total_created,
        "total_bounties_completed": total_completed,
        "total_bounties_open": total_open,
        "total_contributors": total_contributors,
        "total_fndry_paid": total_fndry_paid,
        "total_prs_reviewed": total_prs_reviewed,
        "bounties_by_tier": {
            tier: {"open": data["open"], "completed": data["completed"]}
            for tier, data in tier_stats.items()
        },
        "top_contributor": top_contributor,
    }


def _get_cached_stats() -> dict:
    """Get stats from cache or compute fresh."""
    cache_key = "bounty_stats"
    now = time.time()

    # Check cache
    if cache_key in _cache:
        cached_at, data = _cache[cache_key]
        if now - cached_at < _cache_ttl_seconds:
            logger.debug("Returning cached stats (age: %.1fs)", now - cached_at)
            return data

    # Compute fresh
    data = _compute_stats()
    _cache[cache_key] = (now, data)
    logger.info("Computed fresh stats, cached for %ds", _cache_ttl_seconds)
    return data


@router.get("/api/stats", response_model=StatsResponse)
async def get_stats() -> StatsResponse:
    """Get bounty program statistics.

    Returns aggregate statistics about the bounty program:
    - Total bounties (created, completed, open)
    - Total contributors
    - Total $FNDRY paid out
    - Total PRs reviewed
    - Breakdown by tier
    - Top contributor

    No authentication required - public endpoint.
    Cached for 5 minutes.
    """
    data = _get_cached_stats()
    return StatsResponse(**data)


@router.get("/api/stats/shields/payouts", response_class=JSONResponse)
async def get_payouts_shield():
    """Endpoint format specifically for shields.io custom badge endpoints.
    Returns the total $FNDRY paid in a format compatible with shields.io JSON endpoint.
    """
    data = _get_cached_stats()
    total_paid = data.get("total_fndry_paid", 0)
    
    # Format large numbers (e.g. 250000 -> 250k)
    formatted_paid = f"{total_paid:,}"
    if total_paid >= 1000000:
        formatted_paid = f"{total_paid / 1000000:.1f}M"
    elif total_paid >= 1000:
        formatted_paid = f"{total_paid / 1000:.0f}k"
    
    return {
        "schemaVersion": 1,
        "label": "Paid",
        "message": f"{formatted_paid} $FNDRY",
        "color": "blueviolet"
    }

