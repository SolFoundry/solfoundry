"""Reputation service with PostgreSQL write-through persistence (Issue #162).

Calculates reputation from review scores and bounty tier.  Manages tier
progression, anti-farming, score history, and badges.  On startup
``hydrate_from_database`` loads history from PostgreSQL; new entries are
written through so the database is the durable source of truth.
"""

import asyncio
import logging
import threading
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
_reputation_lock = threading.Lock()


async def hydrate_from_database() -> None:
    """Load reputation history from PostgreSQL into in-memory cache.

    Called once during application startup.  Errors propagate so the
    lifespan handler can log them and decide on fallback behaviour.
    """
    from app.services.pg_store import load_reputation

    loaded = await load_reputation()
    if loaded:
        with _reputation_lock:
            _reputation_store.update(loaded)


def _fire_reputation_write(entry: ReputationHistoryEntry) -> None:
    """Schedule an async write of a reputation entry to PostgreSQL.

    Logs errors via a done-callback so failures are never silent.
    """
    try:
        loop = asyncio.get_running_loop()
        from app.services.pg_store import insert_reputation_entry
        task = loop.create_task(insert_reputation_entry(entry))
        task.add_done_callback(
            lambda t: logger.error("pg_store reputation write failed", exc_info=t.exception())
            if t.exception() else None
        )
    except RuntimeError:
        pass  # No event loop (sync tests)


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
    """Return the highest badge earned for the given score.

    Iterates thresholds in descending order so the first match is the
    highest earned badge, independent of enum declaration order.
    """
    for badge in sorted(BADGE_THRESHOLDS, key=BADGE_THRESHOLDS.get, reverse=True):
        if reputation_score >= BADGE_THRESHOLDS[badge]:
            return badge
    return None


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

    Thread-safe. Acquires the lock before checking contributor existence
    to avoid TOCTOU races. Rejects duplicates (same contributor_id +
    bounty_id) by returning the existing entry. Validates that the
    contributor has unlocked the requested bounty tier before recording.

    Raises:
        ContributorNotFoundError: If the contributor does not exist.
        TierNotUnlockedError: If the bounty tier is not yet unlocked.
    """
    with _reputation_lock:
        contributor = contributor_service.get_contributor_db(data.contributor_id)
        if contributor is None:
            raise ContributorNotFoundError(
                f"Contributor '{data.contributor_id}' not found"
            )

        history = _reputation_store.get(data.contributor_id, [])

        # Idempotency — return existing entry on duplicate bounty_id
        for existing in history:
            if existing.bounty_id == data.bounty_id:
                return existing

        # Tier enforcement — contributor must have unlocked the tier
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

        # Consistent precision — use round(total, 2) everywhere
        total = sum(r.earned_reputation for r in _reputation_store[data.contributor_id])
        contributor_service.update_reputation_score(
            data.contributor_id, round(total, 2)
        )

    _fire_reputation_write(entry)
    return entry


def get_reputation(
    contributor_id: str, include_history: bool = True
) -> Optional[ReputationSummary]:
    """Get the full reputation summary for a contributor.

    Args:
        contributor_id: The contributor to look up.
        include_history: When True, attach recent history (max 10 entries).
            Set to False for lightweight summaries (e.g. leaderboard).

    Returns:
        ReputationSummary or None if the contributor does not exist.

    PostgreSQL migration: replace in-memory dict with
    ``SELECT … FROM reputation_history WHERE contributor_id = :cid``.
    """
    contributor = contributor_service.get_contributor_db(contributor_id)
    if contributor is None:
        return None

    history = _reputation_store.get(contributor_id, [])
    total = sum(e.earned_reputation for e in history)
    tier_counts = count_tier_completions(history)
    current_tier = determine_current_tier(tier_counts)
    average = round(
        sum(e.review_score for e in history) / len(history), 2
    ) if history else 0.0

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


def get_reputation_leaderboard(limit: int = 20, offset: int = 0) -> list[ReputationSummary]:
    """Get contributors ranked by reputation score descending.

    Builds lightweight summaries (no per-entry history) for performance.
    Use the ``/contributors/{id}/reputation/history`` endpoint for full
    records.

    TODO: PostgreSQL migration — ``ORDER BY reputation_score DESC LIMIT
    :limit OFFSET :offset`` with indexed column.
    """
    all_ids = contributor_service.list_contributor_ids()
    summaries = [
        s for cid in all_ids
        if (s := get_reputation(cid, include_history=False)) is not None
    ]
    summaries.sort(key=lambda s: (-s.reputation_score, s.username))
    return summaries[offset: offset + limit]


def get_history(contributor_id: str) -> list[ReputationHistoryEntry]:
    """Get per-bounty reputation history sorted newest-first."""
    history = _reputation_store.get(contributor_id, [])
    return sorted(history, key=lambda e: e.created_at, reverse=True)
