"""Reputation service with PostgreSQL as primary source of truth (Issue #162).

Calculates reputation from review scores and bounty tier.  Manages tier
progression, anti-farming, score history, and badges.

The reputation history itself remains in-memory for this release (a
dedicated ``reputation_history`` table is the next migration target).
Contributor stat updates (``reputation_score``) are persisted to
PostgreSQL via ``contributor_service.update_reputation_score()``.

PostgreSQL migration path: reputation_history table on contributor_id.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

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
from app.services import contributor_service

logger = logging.getLogger(__name__)

_reputation_store: dict[str, list[ReputationHistoryEntry]] = {}
_reputation_lock = asyncio.Lock()


async def hydrate_from_database() -> None:
    """Load reputation history from PostgreSQL into the in-memory cache.

    Called during application startup. Falls back gracefully if the
    database is unreachable.
    """
    from app.services.pg_store import load_reputation

    loaded = await load_reputation()
    if loaded:
        _reputation_store.update(loaded)


async def _load_reputation_from_db() -> Optional[
    dict[str, list[ReputationHistoryEntry]]
]:
    """Load all reputation data from PostgreSQL.

    Returns None on DB failure so callers can fall back to the cache.
    """
    try:
        from app.services.pg_store import load_reputation

        return await load_reputation()
    except Exception as exc:
        logger.warning("DB read failed for reputation: %s", exc)
        return None


def calculate_earned_reputation(
    review_score: float, bounty_tier: int, is_veteran_on_tier1: bool
) -> float:
    """Calculate reputation points earned from a single bounty completion.

    Reputation is proportional to how far the review score exceeds the
    tier's passing threshold, multiplied by the tier's weight.  Veterans
    face a raised T1 threshold to discourage farming easy bounties.

    Args:
        review_score: The multi-LLM review score (0.0--10.0).
        bounty_tier: The bounty tier (1, 2, or 3).
        is_veteran_on_tier1: Whether anti-farming applies (veteran on T1).

    Returns:
        Earned reputation points (0.0 if below threshold).
    """
    tier_multiplier = {1: 1.0, 2: 2.0, 3: 3.0}.get(bounty_tier, 1.0)
    tier_threshold = {1: 6.0, 2: 7.0, 3: 8.0}.get(bounty_tier, 6.0)

    if is_veteran_on_tier1 and bounty_tier == 1:
        tier_threshold += VETERAN_SCORE_BUMP

    if review_score < tier_threshold:
        return 0.0
    return round((review_score - tier_threshold) * tier_multiplier * 5.0, 2)


def determine_badge(reputation_score: float) -> Optional[ReputationBadge]:
    """Return the highest badge earned for the given cumulative score.

    Iterates thresholds in descending order so the first match is the
    highest earned badge, independent of enum declaration order.

    Args:
        reputation_score: The contributor's cumulative reputation score.

    Returns:
        The highest ``ReputationBadge`` earned, or ``None`` if below bronze.
    """
    for badge in sorted(BADGE_THRESHOLDS, key=BADGE_THRESHOLDS.get, reverse=True):
        if reputation_score >= BADGE_THRESHOLDS[badge]:
            return badge
    return None


def count_tier_completions(history: list[ReputationHistoryEntry]) -> dict[int, int]:
    """Count bounties completed per tier from history.

    Args:
        history: List of reputation history entries.

    Returns:
        Dictionary mapping tier number (1, 2, 3) to completion count.
    """
    counts = {1: 0, 2: 0, 3: 0}
    for entry in history:
        if entry.bounty_tier in counts:
            counts[entry.bounty_tier] += 1
    return counts


def determine_current_tier(tier_counts: dict[int, int]) -> ContributorTier:
    """Determine highest tier: T1 (anyone), T2 (4 T1s), T3 (3 T2s).

    Args:
        tier_counts: Dictionary from ``count_tier_completions()``.

    Returns:
        The contributor's current maximum access tier.
    """
    if (
        tier_counts.get(2, 0)
        >= TIER_REQUIREMENTS[ContributorTier.T3]["merged_bounties"]
    ):
        return ContributorTier.T3
    if (
        tier_counts.get(1, 0)
        >= TIER_REQUIREMENTS[ContributorTier.T2]["merged_bounties"]
    ):
        return ContributorTier.T2
    return ContributorTier.T1


def build_tier_progression(
    tier_counts: dict[int, int], current_tier: ContributorTier
) -> TierProgressionDetail:
    """Build tier progression breakdown with next-tier info.

    Args:
        tier_counts: Dictionary from ``count_tier_completions()``.
        current_tier: The contributor's current tier.

    Returns:
        A ``TierProgressionDetail`` with current and next tier data.
    """
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
    """Check if contributor is a veteran (4+ T1 bounties -> anti-farming).

    Args:
        history: The contributor's reputation history.

    Returns:
        ``True`` if the contributor has completed enough T1 bounties
        to trigger the anti-farming threshold.
    """
    return sum(1 for e in history if e.bounty_tier == 1) >= ANTI_FARMING_THRESHOLD


def _allowed_tier_for_contributor(history: list[ReputationHistoryEntry]) -> int:
    """Return the highest bounty tier a contributor is allowed to submit.

    Args:
        history: The contributor's reputation history.

    Returns:
        An integer (1, 2, or 3) indicating the max allowed tier.
    """
    tier_counts = count_tier_completions(history)
    current = determine_current_tier(tier_counts)
    return {"T1": 1, "T2": 2, "T3": 3}[current.value]


async def record_reputation(data: ReputationRecordCreate) -> ReputationHistoryEntry:
    """Record reputation earned from a completed bounty.

    Uses an ``asyncio.Lock`` for concurrency safety.  Rejects duplicates
    (same contributor_id + bounty_id) by returning the existing entry.
    Validates that the contributor has unlocked the requested tier.

    After recording, updates the contributor's ``reputation_score`` in
    PostgreSQL via ``contributor_service.update_reputation_score()``.

    Args:
        data: The reputation record payload.

    Returns:
        The created (or existing duplicate) ``ReputationHistoryEntry``.

    Raises:
        ContributorNotFoundError: If the contributor does not exist.
        TierNotUnlockedError: If the bounty tier is not yet unlocked.
    """
    async with _reputation_lock:
        contributor = await contributor_service.get_contributor_db(data.contributor_id)
        if contributor is None:
            raise ContributorNotFoundError(
                f"Contributor '{data.contributor_id}' not found"
            )

        history = _reputation_store.get(data.contributor_id, [])

        # Idempotency -- return existing entry on duplicate bounty_id
        for existing in history:
            if existing.bounty_id == data.bounty_id:
                return existing

        # Tier enforcement -- contributor must have unlocked the tier
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

        # Update reputation score in PostgreSQL
        total = sum(r.earned_reputation for r in _reputation_store[data.contributor_id])
        await contributor_service.update_reputation_score(
            data.contributor_id, round(total, 2)
        )

    # Await DB write outside the lock to avoid holding it during IO
    try:
        from app.services.pg_store import persist_reputation_entry

        await persist_reputation_entry(entry)
    except Exception as exc:
        logger.error("PostgreSQL reputation write failed: %s", exc)

    return entry


async def get_reputation(
    contributor_id: str, include_history: bool = True
) -> Optional[ReputationSummary]:
    """Build the full reputation summary for a contributor.

    Queries PostgreSQL for history data first, falling back to the
    in-memory cache when the database is unavailable.

    Args:
        contributor_id: The contributor to look up.
        include_history: When ``True``, attach recent history (max 10).

    Returns:
        ``ReputationSummary`` or ``None`` if the contributor does not exist.
    """
    contributor = await contributor_service.get_contributor_db(contributor_id)
    if contributor is None:
        return None

    # Try DB first for history
    db_reputation = await _load_reputation_from_db()
    if db_reputation is not None:
        history = db_reputation.get(contributor_id, [])
    else:
        history = _reputation_store.get(contributor_id, [])

    total = sum(e.earned_reputation for e in history)
    tier_counts = count_tier_completions(history)
    current_tier = determine_current_tier(tier_counts)
    average = (
        round(sum(e.review_score for e in history) / len(history), 2)
        if history
        else 0.0
    )

    recent_history: list[ReputationHistoryEntry] = []
    if include_history:
        recent_history = truncate_history(
            sorted(history, key=lambda e: e.created_at, reverse=True)
        )

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
        history=recent_history,
    )


async def get_reputation_leaderboard(
    limit: int = 20, offset: int = 0
) -> list[ReputationSummary]:
    """Get contributors ranked by reputation score descending.

    Builds lightweight summaries (no per-entry history) for performance.

    Args:
        limit: Maximum number of entries.
        offset: Pagination offset.

    Returns:
        Sorted list of ``ReputationSummary`` objects.
    """
    all_ids = await contributor_service.list_contributor_ids()
    summaries = []
    for contributor_id in all_ids:
        summary = await get_reputation(contributor_id, include_history=False)
        if summary is not None:
            summaries.append(summary)
    summaries.sort(key=lambda s: (-s.reputation_score, s.username))
    return summaries[offset : offset + limit]


async def get_history(contributor_id: str) -> list[ReputationHistoryEntry]:
    """Get per-bounty reputation history sorted newest-first.

    Queries PostgreSQL first, falling back to the in-memory store.

    Args:
        contributor_id: The contributor to look up.

    Returns:
        List of ``ReputationHistoryEntry`` sorted by ``created_at`` desc.
    """
    db_reputation = await _load_reputation_from_db()
    if db_reputation is not None:
        history = db_reputation.get(contributor_id, [])
    else:
        history = _reputation_store.get(contributor_id, [])
    return sorted(history, key=lambda e: e.created_at, reverse=True)
