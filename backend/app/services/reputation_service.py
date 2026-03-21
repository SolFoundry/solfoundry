"""Contributor reputation scoring service."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ContributorNotFoundError, TierNotUnlockedError
from app.models.reputation import (
    ANTI_FARMING_THRESHOLD,
    BADGE_THRESHOLDS,
    TIER_REQUIREMENTS,
    VETERAN_SCORE_BUMP,
    ContributorTier,
    ReputationBadge,
    ReputationHistoryEntry,
    ReputationRecordCreate,
    ReputationSummary,
    TierProgressionDetail,
    truncate_history,
)
from app.models.contributor import ContributorDB, ReputationHistoryDB
from app.services import contributor_service


def calculate_earned_reputation(
    review_score: float, bounty_tier: int, is_veteran_on_tier1: bool
) -> float:
    """Calculate reputation points earned from a single bounty completion."""
    tier_multiplier = {1: 1.0, 2: 2.0, 3: 3.0}.get(bounty_tier, 1.0)
    tier_threshold = {1: 6.0, 2: 7.0, 3: 8.0}.get(bounty_tier, 6.0)

    if is_veteran_on_tier1 and bounty_tier == 1:
        tier_threshold += VETERAN_SCORE_BUMP

    if review_score < tier_threshold:
        return 0.0
    return round((review_score - tier_threshold) * tier_multiplier * 5.0, 2)


def determine_badge(reputation_score: float) -> Optional[ReputationBadge]:
    """Return the highest badge earned for the given score."""
    sorted_badges = sorted(BADGE_THRESHOLDS.items(), key=lambda item: item[1], reverse=True)
    for badge, threshold in sorted_badges:
        if reputation_score >= threshold:
            return badge
    return None


def count_tier_completions(history: list[ReputationHistoryDB]) -> dict[int, int]:
    """Count bounties completed per tier from history."""
    counts = {1: 0, 2: 0, 3: 0}
    for entry in history:
        if entry.bounty_tier in counts:
            counts[entry.bounty_tier] += 1
    return counts


def determine_current_tier(tier_counts: dict[int, int]) -> ContributorTier:
    """Determine highest tier: T1 (anyone), T2 (4 T1s), T3 (3 T2s)."""
    if tier_counts.get(2, 0) >= TIER_REQUIREMENTS[ContributorTier.T3]["merged_bounties"]:
        return ContributorTier.T3
    if tier_counts.get(1, 0) >= TIER_REQUIREMENTS[ContributorTier.T2]["merged_bounties"]:
        return ContributorTier.T2
    return ContributorTier.T1


def build_tier_progression(
    tier_counts: dict[int, int], current_tier: ContributorTier
) -> TierProgressionDetail:
    """Build tier progression breakdown with next-tier info."""
    next_tier: Optional[ContributorTier] = None
    bounties_until_next_tier = 0

    if current_tier == ContributorTier.T1:
        next_tier = ContributorTier.T2
        needed = TIER_REQUIREMENTS[ContributorTier.T2]["merged_bounties"]
        bounties_until_next_tier = max(0, needed - tier_counts.get(1, 0))
    elif current_tier == ContributorTier.T2:
        next_tier = ContributorTier.T3
        needed = TIER_REQUIREMENTS[ContributorTier.T3]["merged_bounties"]
        bounties_until_next_tier = max(0, needed - tier_counts.get(2, 0))

    return TierProgressionDetail(
        current_tier=current_tier,
        tier1_completions=tier_counts.get(1, 0),
        tier2_completions=tier_counts.get(2, 0),
        tier3_completions=tier_counts.get(3, 0),
        next_tier=next_tier,
        bounties_until_next_tier=bounties_until_next_tier,
    )


def is_veteran(history: list[ReputationHistoryDB]) -> bool:
    """Check if contributor is a veteran (4+ T1 bounties -> anti-farming)."""
    return sum(1 for e in history if e.bounty_tier == 1) >= ANTI_FARMING_THRESHOLD


def _allowed_tier_for_contributor(history: list[ReputationHistoryDB]) -> int:
    """Return the highest bounty tier a contributor is allowed to submit."""
    tier_counts = count_tier_completions(history)
    current = determine_current_tier(tier_counts)
    return {"T1": 1, "T2": 2, "T3": 3}[current.value]


async def record_reputation(db: AsyncSession, data: ReputationRecordCreate) -> ReputationHistoryEntry:
    """Record reputation earned from a completed bounty."""
    contributor = await contributor_service.get_contributor_db(db, data.contributor_id)
    if contributor is None:
        raise ContributorNotFoundError(f"Contributor '{data.contributor_id}' not found")

    # Check for duplicate bounty_id
    stmt = select(ReputationHistoryDB).where(
        ReputationHistoryDB.contributor_id == contributor.id,
        ReputationHistoryDB.bounty_id == uuid.UUID(data.bounty_id)
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return ReputationHistoryEntry.model_validate(existing)

    # Get full history to check tier eligibility
    history_stmt = select(ReputationHistoryDB).where(ReputationHistoryDB.contributor_id == contributor.id)
    history_result = await db.execute(history_stmt)
    history = list(history_result.scalars().all())

    # Tier enforcement
    allowed_tier = _allowed_tier_for_contributor(history)
    if data.bounty_tier > allowed_tier:
        raise TierNotUnlockedError(
            f"Contributor has not unlocked tier T{data.bounty_tier}; "
            f"current maximum allowed tier is T{allowed_tier}"
        )

    anti_farming = is_veteran(history) and data.bounty_tier == 1
    earned = calculate_earned_reputation(
        review_score=data.review_score,
        bounty_tier=data.bounty_tier,
        is_veteran_on_tier1=anti_farming,
    )

    entry_db = ReputationHistoryDB(
        contributor_id=contributor.id,
        bounty_id=uuid.UUID(data.bounty_id),
        bounty_title=data.bounty_title,
        bounty_tier=data.bounty_tier,
        review_score=data.review_score,
        earned_reputation=earned,
        anti_farming_applied=anti_farming,
    )
    db.add(entry_db)
    
    # Update total reputation on contributor
    new_total = sum(h.earned_reputation for h in history) + earned
    contributor.reputation_score = round(new_total, 2)
    contributor.total_contributions += 1
    contributor.total_bounties_completed += 1
    
    await db.commit()
    await db.refresh(entry_db)
    return ReputationHistoryEntry.model_validate(entry_db)


async def get_reputation(
    db: AsyncSession, contributor_id: str, include_history: bool = True
) -> Optional[ReputationSummary]:
    """Get the full reputation summary for a contributor."""
    contributor = await contributor_service.get_contributor_db(db, contributor_id)
    if contributor is None:
        return None

    stmt = select(ReputationHistoryDB).where(ReputationHistoryDB.contributor_id == contributor.id)
    result = await db.execute(stmt)
    history = list(result.scalars().all())
    
    total = sum(e.earned_reputation for e in history)
    tier_counts = count_tier_completions(history)
    current_tier = determine_current_tier(tier_counts)
    average = round(
        sum(e.review_score for e in history) / len(history), 2
    ) if history else 0.0

    recent_history: list[ReputationHistoryEntry] = []
    if include_history:
        sorted_history = sorted(history, key=lambda e: e.created_at, reverse=True)
        recent_history = [ReputationHistoryEntry.model_validate(e) for e in sorted_history[:10]]

    return ReputationSummary(
        contributor_id=str(contributor.id),
        username=contributor.username,
        display_name=contributor.display_name,
        reputation_score=round(total, 2),
        badge=determine_badge(total),
        tier_progression=build_tier_progression(tier_counts, current_tier),
        is_veteran=is_veteran(history),
        total_bounties_completed=len(history),
        average_review_score=average,
        history=recent_history,
    )


async def get_reputation_leaderboard(db: AsyncSession, limit: int = 20, offset: int = 0) -> list[ReputationSummary]:
    """Get contributors ranked by reputation score descending."""
    stmt = select(ContributorDB).order_by(ContributorDB.reputation_score.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    contributors = result.scalars().all()
    
    summaries = []
    for c in contributors:
        # Build a summary without full history for the leaderboard
        # In a real app, we might want to optimize this to avoid N+1 queries
        # but for now we follow the structure.
        summary = await get_reputation(db, str(c.id), include_history=False)
        if summary:
            summaries.append(summary)
            
    return summaries


async def get_history(db: AsyncSession, contributor_id: str) -> list[ReputationHistoryEntry]:
    """Get per-bounty reputation history sorted newest-first."""
    try:
        uuid_obj = uuid.UUID(contributor_id)
        stmt = select(ReputationHistoryDB).where(ReputationHistoryDB.contributor_id == uuid_obj).order_by(ReputationHistoryDB.created_at.desc())
        result = await db.execute(stmt)
        return [ReputationHistoryEntry.model_validate(e) for e in result.scalars().all()]
    except ValueError:
        return []
