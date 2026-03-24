"""Bounty search service with PostgreSQL full-text search and in-memory fallback.

Uses tsvector/tsquery for ranked text search when PostgreSQL is available.
Falls back to Python-based filtering against the in-memory store for dev/test.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bounty import (
    BountySearchParams,
    BountySearchResult,
    BountySearchResponse,
    AutocompleteItem,
    AutocompleteResponse,
    BountyStatus,
)
from app.services.bounty_service import _bounty_store, BountyDB

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PostgreSQL full-text search
# ---------------------------------------------------------------------------

_SORT_SQL = {
    "newest": "b.created_at DESC",
    "oldest": "b.created_at ASC",
    "reward_high": "b.reward_amount DESC",
    "reward_low": "b.reward_amount ASC",
    "tier_high": "b.tier DESC",
    "deadline": "b.deadline ASC NULLS LAST",
    "submissions": "b.submission_count DESC",
    "best_match": "rank DESC, b.created_at DESC",
}


async def search_bounties_db(
    session: AsyncSession, params: BountySearchParams
) -> BountySearchResponse:
    """Search bounties using PostgreSQL full-text search."""
    conditions: list[str] = []
    binds: dict = {}

    has_query = bool(params.q.strip())
    if has_query:
        conditions.append("b.search_vector @@ plainto_tsquery('english', :query)")
        binds["query"] = params.q.strip()

    if params.status is not None:
        conditions.append("b.status = :status")
        binds["status"] = params.status.value
    if params.tier is not None:
        conditions.append("b.tier = :tier")
        binds["tier"] = params.tier
    if params.skills:
        op = "?&" if params.skills_logic == "all" else "?|"
        conditions.append(f"b.skills {op} :skills")
        binds["skills"] = params.skills
    if params.category:
        conditions.append("b.category = :category")
        binds["category"] = params.category
    if params.creator_type:
        conditions.append("b.creator_type = :creator_type")
        binds["creator_type"] = params.creator_type
    if params.creator_id:
        conditions.append("b.created_by = :creator_id")
        binds["creator_id"] = params.creator_id
    if params.reward_min is not None:
        conditions.append("b.reward_amount >= :reward_min")
        binds["reward_min"] = params.reward_min
    if params.reward_max is not None:
        conditions.append("b.reward_amount <= :reward_max")
        binds["reward_max"] = params.reward_max
    if params.deadline_before is not None:
        conditions.append("b.deadline <= :deadline_before")
        binds["deadline_before"] = params.deadline_before

    where = " AND ".join(conditions) if conditions else "TRUE"

    rank_expr = (
        "ts_rank_cd(b.search_vector, plainto_tsquery('english', :query))"
        if has_query
        else "0"
    )

    # Elite Hot-Relevance: Combined rank with popularity and reward log-scale
    # Formula: Rank + ln(1+pop)*0.15 + ln(1+reward)*0.10
    elite_rank = f"({rank_expr} + LN(1+COALESCE(b.popularity,0))*0.15 + LN(1+COALESCE(b.reward_amount,0))*0.10)"

    sort_sql = _SORT_SQL.copy()
    sort_sql["best_match"] = f"{elite_rank} DESC, b.created_at DESC"

    sort = sort_sql.get(params.sort, sort_sql["newest"])
    if params.sort == "best_match" and not has_query:
        sort = sort_sql["newest"]

    offset = (params.page - 1) * params.per_page

    count_sql = f"SELECT COUNT(*) FROM bounties b WHERE {where}"
    result = await session.execute(text(count_sql), binds)
    total = result.scalar() or 0

    select_sql = f"""
        SELECT
            b.id::text, b.title, b.project_name, b.description, b.tier, b.reward_amount,
            b.status, b.category, b.creator_type, b.skills, b.github_issue_url, b.deadline,
            b.created_by, b.submission_count, b.created_at,
            {rank_expr} AS rank
        FROM bounties b
        WHERE {where}
        ORDER BY {sort}
        LIMIT :limit OFFSET :offset
    """
    binds["limit"] = params.per_page
    binds["offset"] = offset

    rows = await session.execute(text(select_sql), binds)
    items = []
    user_skill_set = {s.lower() for s in params.skills}
    for row in rows:
        bounty_skills = row.skills if isinstance(row.skills, list) else []
        match_count = (
            len(user_skill_set & {s.lower() for s in bounty_skills})
            if user_skill_set
            else 0
        )
        items.append(
            BountySearchResult(
                id=row.id,
                title=row.title,
                project_name=getattr(row, "project_name", None),
                description=row.description or "",
                tier=row.tier,
                category=getattr(row, "category", None),
                reward_amount=row.reward_amount,
                status=BountyStatus(row.status),
                creator_type=getattr(row, "creator_type", "platform"),
                required_skills=bounty_skills,
                github_issue_url=row.github_issue_url,
                deadline=row.deadline,
                created_by=row.created_by,
                submission_count=row.submission_count or 0,
                created_at=row.created_at,
                relevance_score=float(row.rank) if row.rank else 0.0,
                skill_match_count=match_count,
            )
        )

    return BountySearchResponse(
        items=items,
        total=total,
        page=params.page,
        per_page=params.per_page,
        query=params.q,
    )


async def autocomplete_db(
    session: AsyncSession, q: str, limit: int = 8
) -> AutocompleteResponse:
    """Autocomplete using PostgreSQL prefix matching."""
    if len(q.strip()) < 2:
        return AutocompleteResponse(suggestions=[])

    prefix = q.strip()
    suggestions: list[AutocompleteItem] = []

    title_sql = """
        SELECT id::text, title FROM bounties
        WHERE title ILIKE :pattern AND status IN ('open', 'in_progress')
        ORDER BY popularity DESC, created_at DESC
        LIMIT :limit
    """
    rows = await session.execute(
        text(title_sql), {"pattern": f"%{prefix}%", "limit": limit}
    )
    for row in rows:
        suggestions.append(
            AutocompleteItem(text=row.title, type="title", bounty_id=row.id)
        )

    skill_sql = """
        SELECT DISTINCT skill FROM (
            SELECT jsonb_array_elements_text(skills) AS skill FROM bounties
            WHERE status IN ('open', 'in_progress')
        ) sub
        WHERE skill ILIKE :pattern
        LIMIT :limit
    """
    rows = await session.execute(
        text(skill_sql), {"pattern": f"%{prefix}%", "limit": limit}
    )
    for row in rows:
        suggestions.append(AutocompleteItem(text=row.skill, type="skill"))

    return AutocompleteResponse(suggestions=suggestions[:limit])


async def get_hot_bounties_db(
    session: AsyncSession, limit: int = 6
) -> list[BountySearchResult]:
    """Return bounties with highest activity in the last 24 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    sql = """
        SELECT
            b.id::text, b.title, b.project_name, b.description, b.tier, b.reward_amount,
            b.status, b.category, b.creator_type, b.skills, b.github_issue_url, b.deadline,
            b.created_by, b.submission_count, b.created_at, b.popularity
        FROM bounties b
        WHERE b.status IN ('open', 'in_progress')
          AND (b.updated_at >= :cutoff OR b.created_at >= :cutoff)
        ORDER BY b.popularity DESC, b.submission_count DESC, b.created_at DESC
        LIMIT :limit
    """
    rows = await session.execute(text(sql), {"cutoff": cutoff, "limit": limit})
    return [
        BountySearchResult(
            id=row.id,
            title=row.title,
            project_name=getattr(row, "project_name", None),
            description=row.description or "",
            tier=row.tier,
            category=getattr(row, "category", None),
            reward_amount=row.reward_amount,
            status=BountyStatus(row.status),
            creator_type=getattr(row, "creator_type", "platform"),
            required_skills=row.skills if isinstance(row.skills, list) else [],
            github_issue_url=row.github_issue_url,
            deadline=row.deadline,
            created_by=row.created_by,
            submission_count=row.submission_count or 0,
            created_at=row.created_at,
            relevance_score=0.0,
            skill_match_count=0,
        )
        for row in rows
    ]


async def get_recommended_bounties_db(
    session: AsyncSession,
    user_skills: list[str],
    completed_bounty_ids: list[str],
    limit: int = 6,
) -> list[BountySearchResult]:
    """Recommend bounties matching the user's skills, excluding already completed."""
    if not user_skills:
        return []

    sql = """
        SELECT
            b.id::text, b.title, b.project_name, b.description, b.tier, b.reward_amount,
            b.status, b.category, b.creator_type, b.skills, b.github_issue_url, b.deadline,
            b.created_by, b.submission_count, b.created_at
        FROM bounties b
        WHERE b.status = 'open'
          AND b.skills ?| :skills
          AND NOT (b.id::text = ANY(:excluded))
        ORDER BY
            (SELECT COUNT(*) FROM jsonb_array_elements_text(b.skills) s
             WHERE LOWER(s) = ANY(:skills_lower)) DESC,
            b.reward_amount DESC
        LIMIT :limit
    """
    binds = {
        "skills": user_skills,
        "skills_lower": [s.lower() for s in user_skills],
        "excluded": completed_bounty_ids or ["__none__"],
        "limit": limit,
    }
    rows = await session.execute(text(sql), binds)
    skill_set = {s.lower() for s in user_skills}
    return [
        BountySearchResult(
            id=row.id,
            title=row.title,
            project_name=getattr(row, "project_name", None),
            description=row.description or "",
            tier=row.tier,
            category=getattr(row, "category", None),
            reward_amount=row.reward_amount,
            status=BountyStatus(row.status),
            creator_type=getattr(row, "creator_type", "platform"),
            required_skills=row.skills if isinstance(row.skills, list) else [],
            github_issue_url=row.github_issue_url,
            deadline=row.deadline,
            created_by=row.created_by,
            submission_count=row.submission_count or 0,
            created_at=row.created_at,
            relevance_score=0.0,
            skill_match_count=len(
                skill_set
                & {
                    s.lower()
                    for s in (row.skills if isinstance(row.skills, list) else [])
                }
            ),
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# In-memory fallback (works without PostgreSQL)
# ---------------------------------------------------------------------------


def _match_text(query: str, *fields: str) -> float:
    """Simple text relevance score: fraction of query words found in fields."""
    if not query.strip():
        return 0.0
    words = query.lower().split()
    combined = " ".join(f.lower() for f in fields if f)
    matched = sum(1 for w in words if w in combined)
    return matched / len(words) if words else 0.0


def _sort_key(b: BountyDB, sort: str, query: str):
    """Return a sort key tuple for the given sort mode."""
    if sort == "reward_high":
        return (-b.reward_amount,)
    if sort == "reward_low":
        return (b.reward_amount,)
    if sort == "tier_high":
        return (-int(b.tier),)
    if sort == "deadline":
        dl = b.deadline.timestamp() if b.deadline else float("inf")
        return (dl,)
    if sort == "submissions":
        return (-len(b.submissions),)
    if sort == "best_match":
        return (-_match_text(query, b.title, b.description),)
    if sort == "oldest":
        return (b.created_at.timestamp(),)
    return (-b.created_at.timestamp(),)


def search_bounties_memory(params: BountySearchParams) -> BountySearchResponse:
    """Search the in-memory bounty store."""
    results = list(_bounty_store.values())

    if params.status is not None:
        results = [b for b in results if b.status == params.status]
    if params.tier is not None:
        results = [b for b in results if b.tier == params.tier]
    if params.skills:
        skill_set = {s.lower() for s in params.skills}
        if params.skills_logic == "all":
            results = [
                b
                for b in results
                if skill_set.issubset({s.lower() for s in b.required_skills})
            ]
        else:
            results = [
                b for b in results if skill_set & {s.lower() for s in b.required_skills}
            ]
    if params.creator_type:
        results = [
            b
            for b in results
            if getattr(b, "creator_type", None) == params.creator_type
        ]
    if params.creator_id:
        results = [b for b in results if b.created_by == params.creator_id]
    if params.reward_min is not None:
        results = [b for b in results if b.reward_amount >= params.reward_min]
    if params.reward_max is not None:
        results = [b for b in results if b.reward_amount <= params.reward_max]
    if params.deadline_before is not None:
        results = [
            b for b in results if b.deadline and b.deadline <= params.deadline_before
        ]

    q = params.q.strip()
    if q:
        scored = []
        for b in results:
            score = _match_text(q, b.title, b.description)
            if score > 0:
                scored.append((b, score))
        results = [b for b, _ in scored]

    results.sort(key=lambda b: _sort_key(b, params.sort, q))
    total = len(results)
    start = (params.page - 1) * params.per_page
    page = results[start : start + params.per_page]

    user_skill_set = {s.lower() for s in params.skills}
    items = []
    for b in page:
        match_count = (
            len(user_skill_set & {s.lower() for s in b.required_skills})
            if user_skill_set
            else 0
        )
        items.append(
            BountySearchResult(
                id=b.id,
                title=b.title,
                project_name=getattr(b, "project_name", None),
                description=b.description,
                tier=b.tier,
                category=getattr(b, "category", None),
                reward_amount=b.reward_amount,
                status=b.status,
                creator_type=getattr(b, "creator_type", "platform"),
                required_skills=b.required_skills,
                github_issue_url=b.github_issue_url,
                deadline=b.deadline,
                created_by=b.created_by,
                submission_count=len(b.submissions),
                created_at=b.created_at,
                relevance_score=_match_text(q, b.title, b.description),
                skill_match_count=match_count,
            )
        )

    return BountySearchResponse(
        items=items,
        total=total,
        page=params.page,
        per_page=params.per_page,
        query=params.q,
    )


def autocomplete_memory(q: str, limit: int = 8) -> AutocompleteResponse:
    """In-memory autocomplete."""
    if len(q.strip()) < 2:
        return AutocompleteResponse(suggestions=[])

    prefix = q.strip().lower()
    suggestions: list[AutocompleteItem] = []

    for b in _bounty_store.values():
        if prefix in b.title.lower():
            suggestions.append(
                AutocompleteItem(text=b.title, type="title", bounty_id=b.id)
            )

    seen_skills: set[str] = set()
    for b in _bounty_store.values():
        for skill in b.required_skills:
            if prefix in skill.lower() and skill.lower() not in seen_skills:
                seen_skills.add(skill.lower())
                suggestions.append(AutocompleteItem(text=skill, type="skill"))

    return AutocompleteResponse(suggestions=suggestions[:limit])


def get_hot_bounties_memory(limit: int = 6) -> list[BountySearchResult]:
    """Return recently active bounties from the in-memory store."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    active = [
        b
        for b in _bounty_store.values()
        if b.status in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS)
        and (getattr(b, "updated_at", b.created_at) >= cutoff or b.created_at >= cutoff)
    ]
    active.sort(key=lambda b: (-len(b.submissions), -b.created_at.timestamp()))
    return [
        BountySearchResult(
            id=b.id,
            title=b.title,
            project_name=getattr(b, "project_name", None),
            description=b.description,
            tier=b.tier,
            category=getattr(b, "category", None),
            reward_amount=b.reward_amount,
            status=b.status,
            creator_type=getattr(b, "creator_type", "platform"),
            required_skills=b.required_skills,
            github_issue_url=b.github_issue_url,
            deadline=b.deadline,
            created_by=b.created_by,
            submission_count=len(b.submissions),
            created_at=b.created_at,
            relevance_score=0.0,
            skill_match_count=0,
        )
        for b in active[:limit]
    ]


def get_recommended_memory(
    user_skills: list[str],
    completed_bounty_ids: list[str],
    limit: int = 6,
) -> list[BountySearchResult]:
    """In-memory recommendation based on skill overlap."""
    if not user_skills:
        return []

    skill_set = {s.lower() for s in user_skills}
    excluded = set(completed_bounty_ids)
    candidates = []
    for b in _bounty_store.values():
        if b.status != BountyStatus.OPEN or b.id in excluded:
            continue
        overlap = len(skill_set & {s.lower() for s in b.required_skills})
        if overlap > 0:
            candidates.append((b, overlap))

    candidates.sort(key=lambda x: (-x[1], -x[0].reward_amount))
    return [
        BountySearchResult(
            id=b.id,
            title=b.title,
            project_name=getattr(b, "project_name", None),
            description=b.description,
            tier=b.tier,
            category=getattr(b, "category", None),
            reward_amount=b.reward_amount,
            status=b.status,
            creator_type=getattr(b, "creator_type", "platform"),
            required_skills=b.required_skills,
            github_issue_url=b.github_issue_url,
            deadline=b.deadline,
            created_by=b.created_by,
            submission_count=len(b.submissions),
            created_at=b.created_at,
            relevance_score=0.0,
            skill_match_count=overlap,
        )
        for b, overlap in candidates[:limit]
    ]


# ---------------------------------------------------------------------------
# Unified interface — tries DB, falls back to memory
# ---------------------------------------------------------------------------


class BountySearchService:
    """Unified search interface. Uses PostgreSQL when available, memory otherwise."""

    def __init__(self, session: Optional[AsyncSession] = None):
        """Initialize the instance."""
        self._session = session

    async def _has_db(self) -> bool:
        """Check if a working PostgreSQL connection is available."""
        if self._session is None:
            return False
        try:
            await self._session.execute(text("SELECT 1 FROM bounties LIMIT 0"))
            return True
        except Exception:
            return False

    async def search(self, params: BountySearchParams) -> BountySearchResponse:
        """Search bounties using DB when available, else memory."""
        if await self._has_db():
            return await search_bounties_db(self._session, params)
        return search_bounties_memory(params)

    async def autocomplete(self, q: str, limit: int = 8) -> AutocompleteResponse:
        """Return autocomplete suggestions."""
        if await self._has_db():
            return await autocomplete_db(self._session, q, limit)
        return autocomplete_memory(q, limit)

    async def hot_bounties(self, limit: int = 6) -> list[BountySearchResult]:
        """Return trending bounties from recent activity."""
        if await self._has_db():
            return await get_hot_bounties_db(self._session, limit)
        return get_hot_bounties_memory(limit)

    async def recommended(
        self,
        user_skills: list[str],
        completed_bounty_ids: Optional[list[str]] = None,
        limit: int = 6,
    ) -> list[BountySearchResult]:
        """Return skill-matched bounty recommendations."""
        if await self._has_db():
            return await get_recommended_bounties_db(
                self._session, user_skills, completed_bounty_ids or [], limit
            )
        return get_recommended_memory(user_skills, completed_bounty_ids or [], limit)
