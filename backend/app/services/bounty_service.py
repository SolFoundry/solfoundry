"""Bounty service layer."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, asc, desc, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bounty import (
    AutocompleteResponse,
    AutocompleteSuggestion,
    BountyCreate,
    BountyDB,
    BountyListItem,
    BountyListResponse,
    BountySearchParams,
    BountyUpdate,
)


class BountyService:
    """Service for bounty CRUD, listing, and search."""

    VALID_CATEGORIES = {
        "frontend",
        "backend",
        "smart_contract",
        "documentation",
        "testing",
        "infrastructure",
        "other",
    }
    VALID_STATUSES = {"open", "claimed", "completed", "cancelled"}
    VALID_SORTS = {"newest", "reward_high", "reward_low", "deadline", "popularity"}

    def __init__(self, db: AsyncSession):
        self.db = db
        self.dialect = db.bind.dialect.name if db.bind else ""

    async def get_bounty_by_id(self, bounty_id: UUID) -> Optional[BountyDB]:
        result = await self.db.execute(select(BountyDB).where(BountyDB.id == bounty_id))
        return result.scalar_one_or_none()

    async def create_bounty(self, data: BountyCreate) -> BountyDB:
        bounty = BountyDB(**data.model_dump())
        self.db.add(bounty)
        await self.db.commit()
        await self.db.refresh(bounty)
        return bounty

    async def update_bounty(self, bounty: BountyDB, data: BountyUpdate) -> BountyDB:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(bounty, field, value)

        await self.db.commit()
        await self.db.refresh(bounty)
        return bounty

    async def delete_bounty(self, bounty: BountyDB) -> None:
        await self.db.delete(bounty)
        await self.db.commit()

    async def search_bounties(self, params: BountySearchParams) -> BountyListResponse:
        self._validate_params(params)

        conditions = self._build_conditions(params)
        final_filter = and_(*conditions) if conditions else literal(True)

        if params.q:
            final_filter = and_(final_filter, self._build_query_condition(params.q))

        count_query = select(func.count(BountyDB.id)).where(final_filter)
        query = (
            select(BountyDB)
            .where(final_filter)
            .order_by(self._get_sort_column(params.sort))
            .offset(params.skip)
            .limit(params.limit)
        )

        result = await self.db.execute(query)
        count_result = await self.db.execute(count_query)

        bounties = result.scalars().all()
        total = count_result.scalar() or 0

        return BountyListResponse(
            items=[BountyListItem.model_validate(bounty) for bounty in bounties],
            total=total,
            skip=params.skip,
            limit=params.limit,
        )

    async def get_autocomplete_suggestions(self, query: str, limit: int = 10) -> AutocompleteResponse:
        suggestions: List[AutocompleteSuggestion] = []
        normalized_query = query.strip()

        if len(normalized_query) < 2:
            return AutocompleteResponse(suggestions=suggestions)

        title_query = (
            select(BountyDB.title)
            .where(BountyDB.status == "open")
            .where(BountyDB.title.ilike(f"%{normalized_query}%"))
            .distinct()
            .order_by(BountyDB.title.asc())
            .limit(limit)
        )
        title_result = await self.db.execute(title_query)
        for title in title_result.scalars().all():
            suggestions.append(AutocompleteSuggestion(text=title, type="title"))

        remaining = limit - len(suggestions)
        if remaining <= 0:
            return AutocompleteResponse(suggestions=suggestions[:limit])

        skill_result = await self.db.execute(
            select(BountyDB.skills).where(BountyDB.status == "open")
        )
        seen_titles = {item.text.lower() for item in suggestions}
        for skill_list in skill_result.scalars().all():
            for skill in skill_list or []:
                if not skill.lower().startswith(normalized_query.lower()):
                    continue
                if skill.lower() in seen_titles:
                    continue
                suggestions.append(AutocompleteSuggestion(text=skill, type="skill"))
                seen_titles.add(skill.lower())
                if len(suggestions) >= limit:
                    return AutocompleteResponse(suggestions=suggestions)

        return AutocompleteResponse(suggestions=suggestions)

    def _validate_params(self, params: BountySearchParams) -> None:
        if params.category and params.category not in self.VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {params.category}")

        if params.status and params.status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status: {params.status}")

        if (
            params.reward_min is not None
            and params.reward_max is not None
            and params.reward_max < params.reward_min
        ):
            raise ValueError("reward_max cannot be less than reward_min")

        if params.sort not in self.VALID_SORTS:
            raise ValueError(f"Invalid sort: {params.sort}")

    def _build_conditions(self, params: BountySearchParams) -> List:
        conditions = [BountyDB.status == params.status] if params.status else [BountyDB.status == "open"]

        if params.tier is not None:
            conditions.append(BountyDB.tier == params.tier)

        if params.category:
            conditions.append(BountyDB.category == params.category)

        if params.reward_min is not None:
            conditions.append(BountyDB.reward_amount >= params.reward_min)

        if params.reward_max is not None:
            conditions.append(BountyDB.reward_amount <= params.reward_max)

        skills_list = params.get_skills_list()
        if skills_list:
            conditions.extend(self._build_skills_conditions(skills_list))

        return conditions

    def _build_query_condition(self, query: str):
        if self.dialect == "postgresql":
            ts_query = func.plainto_tsquery("english", query)
            return BountyDB.search_vector.op("@@")(ts_query)

        like_value = f"%{query}%"
        return or_(BountyDB.title.ilike(like_value), BountyDB.description.ilike(like_value))

    def _build_skills_conditions(self, skills: List[str]) -> List:
        if self.dialect == "postgresql":
            return [BountyDB.skills.contains([skill]) for skill in skills]

        conditions = []
        for skill in skills:
            conditions.append(func.lower(func.cast(BountyDB.skills, String)).like(f'%"{skill.lower()}"%'))
        return conditions

    def _get_sort_column(self, sort: str):
        return {
            "newest": desc(BountyDB.created_at),
            "reward_high": desc(BountyDB.reward_amount),
            "reward_low": asc(BountyDB.reward_amount),
            "deadline": asc(BountyDB.deadline).nulls_last(),
            "popularity": desc(BountyDB.popularity),
        }.get(sort, desc(BountyDB.created_at))


# Backwards-compatible alias for existing imports/tests.
BountySearchService = BountyService
