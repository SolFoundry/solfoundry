"""Contributor reputation scoring service.

Calculates reputation from review scores and bounty tier. Manages tier
progression, anti-farming, score history, and badges. In-memory MVP.
PostgreSQL migration path: reputation_history table on contributor_id.
"""

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

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
)
from app.services.contributor_service import _store as _contributor_store

_reputation_store: dict[str, list[ReputationHistoryEntry]] = {}
_reputation_lock = threading.Lock()


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
    result = None
    for badge in ReputationBadge:
        if reputation_score >= BADGE_THRESHOLDS[badge]:
            result = badge
    return result


def count_tier_completions(history: list[ReputationHistoryEntry]) -> dict[int, int]:
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


def is_veteran(history: list[ReputationHistoryEntry]) -> bool:
    """Check if contributor is a veteran (4+ T1 bounties -> anti-farming)."""
    return sum(1 for e in history if e.bounty_tier == 1) >= ANTI_FARMING_THRESHOLD


def _allowed_tier_for_contributor(history: list[ReputationHistoryEntry]) -> int:
    """Return the highest bounty tier a contributor is allowed to submit."""
    tier_counts = count_tier_completions(history)
    current = determine_current_tier(tier_counts)
    return {"T1": 1, "T2": 2, "T3": 3}[current.value]


def record_reputation(data: ReputationRecordCreate) -> ReputationHistoryEntry:
    """Record reputation earned from a completed bounty.

    Thread-safe. Rejects duplicates (same contributor_id + bounty_id) by
    returning the existing entry. Validates that the contributor has
    unlocked the requested bounty tier before recording.
    """
    contributor = _contributor_store.get(data.contributor_id)
    if contributor is None:
        raise ValueError(f"Contributor '{data.contributor_id}' not found")

    with _reputation_lock:
        history = _reputation_store.get(data.contributor_id, [])

        # Fix 4: idempotency — return existing entry on duplicate bounty_id
        for existing in history:
            if existing.bounty_id == data.bounty_id:
                return existing

        # Fix 5: tier enforcement — contributor must have unlocked the tier
        allowed_tier = _allowed_tier_for_contributor(history)
        if data.bounty_tier > allowed_tier:
            raise ValueError(
                f"Contributor has not unlocked tier T{data.bounty_tier}; "
                f"current maximum allowed tier is T{allowed_tier}"
            )

        anti_farming = is_veteran(history) and data.bounty_tier == 1

        earned = calculate_earned_reputation(
            review_score=data.review_score,
            bounty_tier=data.bounty_tier,
            is_veteran_on_tier1=anti_farming,
        )

        entry = ReputationHistoryEntry(
            entry_id=str(uuid.uuid4()),
            contributor_id=data.contributor_id,
            bounty_id=data.bounty_id,
            bounty_title=data.bounty_title,
            bounty_tier=data.bounty_tier,
            review_score=data.review_score,
            earned_reputation=earned,
            anti_farming_applied=anti_farming,
            created_at=datetime.now(timezone.utc),
        )

        _reputation_store.setdefault(data.contributor_id, []).append(entry)

        # Fix 6: consistent precision — use round(total, 2) everywhere
        total = sum(r.earned_reputation for r in _reputation_store[data.contributor_id])
        contributor.reputation_score = round(total, 2)

    return entry


def get_reputation(contributor_id: str) -> Optional[ReputationSummary]:
    """Get the full reputation summary for a contributor."""
    contributor = _contributor_store.get(contributor_id)
    if contributor is None:
        return None

    history = _reputation_store.get(contributor_id, [])
    total = sum(e.earned_reputation for e in history)
    tier_counts = count_tier_completions(history)
    current_tier = determine_current_tier(tier_counts)
    average = round(sum(e.review_score for e in history) / len(history), 2) if history else 0.0

    return ReputationSummary(
        contributor_id=contributor_id,
        username=contributor.username,
        display_name=contributor.display_name,
        reputation_score=round(total, 2),
        badge=determine_badge(total),
        tier_progression=build_tier_progression(tier_counts, current_tier),
        is_veteran=is_veteran(history),
        total_bounties_completed=sum(tier_counts.values()),
        average_review_score=average,
        history=sorted(history, key=lambda e: e.created_at, reverse=True),
    )


def get_reputation_leaderboard(limit: int = 20, offset: int = 0) -> list[ReputationSummary]:
    """Get contributors ranked by reputation score descending."""
    summaries = [
        s for cid in _contributor_store
        if (s := get_reputation(cid)) is not None
    ]
    summaries.sort(key=lambda s: (-s.reputation_score, s.username))
    return summaries[offset: offset + limit]


def get_history(contributor_id: str) -> list[ReputationHistoryEntry]:
    """Get per-bounty reputation history sorted newest-first."""
    history = _reputation_store.get(contributor_id, [])
    return sorted(history, key=lambda e: e.created_at, reverse=True)
