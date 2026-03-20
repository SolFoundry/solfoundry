"""Bounty search and filter service."""

from typing import List
from sqlalchemy import select, and_, func, desc, asc

from app.models.bounty import BountyDB, BountySearchParams, BountyListItem, BountyListResponse, AutocompleteSuggestion, AutocompleteResponse


class BountySearchService:
    """Service for bounty search and filtering.
    
    This service handles read operations only. Write operations (create/update)
    are handled by the API layer to ensure proper transaction management.
    
    The search_vector is automatically maintained by database triggers,
    ensuring consistency between title/description and the search index.
    """
    
    # Valid filter values
    VALID_CATEGORIES = {
        "frontend", "backend", "smart_contract", 
        "documentation", "testing", "infrastructure", "other"
    }
    VALID_STATUSES = {"open", "claimed", "completed", "cancelled"}
    VALID_SORTS = {"newest", "reward_high", "reward_low", "deadline", "popularity"}
    
    def __init__(self, db):
        self.db = db
    
    async def search_bounties(self, params: BountySearchParams) -> BountyListResponse:
        """
        Full-text search with filtering and sorting.
        
        Uses PostgreSQL tsvector for efficient full-text search.
        The search_vector is automatically maintained by database triggers.
        
        Args:
            params: Search parameters including query, filters, sort, and pagination.
            
        Returns:
            BountyListResponse with matching bounties and total count.
            
        Raises:
            ValueError: If filter parameters are invalid.
        """
        # Validate parameters
        self._validate_params(params)
        
        # Build filter conditions
        conditions = self._build_conditions(params)
        final_filter = and_(*conditions) if conditions else True
        
        # Add full-text search if query provided
        if params.q:
            ts_query = func.plainto_tsquery('english', params.q)
            search_condition = BountyDB.search_vector.op('@@')(ts_query)
            final_filter = and_(final_filter, search_condition)
        
        # Count query
        count_query = select(func.count(BountyDB.id)).where(final_filter)
        
        # Main query with sorting
        sort_column = self._get_sort_column(params.sort)
        
        query = (
            select(BountyDB)
            .where(final_filter)
            .order_by(sort_column)
            .offset(params.skip)
            .limit(params.limit)
        )
        
        # Execute queries
        result = await self.db.execute(query)
        bounties = result.scalars().all()
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        return BountyListResponse(
            items=[BountyListItem.model_validate(b) for b in bounties],
            total=total,
            skip=params.skip,
            limit=params.limit,
        )
    
    async def get_autocomplete_suggestions(self, query: str, limit: int = 10) -> AutocompleteResponse:
        """
        Get autocomplete suggestions for search.
        
        Returns matching bounty titles and skills for partial queries.
        Minimum query length is 2 characters.
        
        Args:
            query: Partial search query (min 2 chars).
            limit: Maximum number of suggestions to return.
            
        Returns:
            AutocompleteResponse with matching suggestions.
        """
        suggestions = []
        
        # Require minimum query length
        if not query or len(query.strip()) < 2:
            return AutocompleteResponse(suggestions=suggestions)
        
        query = query.strip()
        
        # Search in titles (case-insensitive)
        title_query = (
            select(BountyDB.title)
            .where(BountyDB.title.ilike(f"%{query}%"))
            .where(BountyDB.status == "open")
            .distinct()
            .limit(limit)
        )
        
        result = await self.db.execute(title_query)
        titles = result.scalars().all()
        
        for title in titles:
            suggestions.append(AutocompleteSuggestion(
                text=title,
                type="title"
            ))
        
        # Search in skills if we have room
        remaining = limit - len(suggestions)
        if remaining > 0:
            # Use jsonb_array_elements_text to search within skills array
            skill_subquery = (
                select(func.distinct(func.jsonb_array_elements_text(BountyDB.skills)))
                .where(BountyDB.status == "open")
                .where(func.jsonb_array_elements_text(BountyDB.skills).ilike(f"{query}%"))
                .limit(remaining)
            )
            
            result = await self.db.execute(skill_subquery)
            skills = result.scalars().all()
            
            for skill in skills:
                if skill:
                    suggestions.append(AutocompleteSuggestion(
                        text=skill,
                        type="skill"
                    ))
        
        return AutocompleteResponse(suggestions=suggestions)
    
    def _validate_params(self, params: BountySearchParams) -> None:
        """Validate search parameters and raise ValueError if invalid."""
        
        if params.tier is not None and params.tier not in {1, 2, 3}:
            raise ValueError(f"Invalid tier: {params.tier}. Must be 1, 2, or 3.")
        
        if params.category and params.category not in self.VALID_CATEGORIES:
            raise ValueError(f"Invalid category: {params.category}")
        
        if params.status and params.status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status: {params.status}")
        
        if params.reward_min is not None and params.reward_min < 0:
            raise ValueError("reward_min cannot be negative")
        
        if params.reward_max is not None and params.reward_max < 0:
            raise ValueError("reward_max cannot be negative")
        
        if (params.reward_min is not None and params.reward_max is not None 
            and params.reward_max < params.reward_min):
            raise ValueError("reward_max cannot be less than reward_min")
        
        if params.sort not in self.VALID_SORTS:
            raise ValueError(f"Invalid sort: {params.sort}")
    
    def _build_conditions(self, params: BountySearchParams) -> List:
        """Build filter conditions from parameters."""
        conditions = []
        
        # Default to open bounties
        if params.status:
            conditions.append(BountyDB.status == params.status)
        else:
            conditions.append(BountyDB.status == "open")
        
        if params.tier is not None:
            conditions.append(BountyDB.tier == params.tier)
        
        if params.category:
            conditions.append(BountyDB.category == params.category)
        
        if params.reward_min is not None:
            conditions.append(BountyDB.reward_amount >= params.reward_min)
        
        if params.reward_max is not None:
            conditions.append(BountyDB.reward_amount <= params.reward_max)
        
        # Parse and filter by skills
        skills_list = params.get_skills_list()
        if skills_list:
            for skill in skills_list:
                # PostgreSQL JSONB ? operator checks if element exists in array
                conditions.append(BountyDB.skills.op('?')(skill))
        
        return conditions
    
    def _get_sort_column(self, sort: str):
        """Get the appropriate sort column for the given sort option."""
        return {
            "newest": desc(BountyDB.created_at),
            "reward_high": desc(BountyDB.reward_amount),
            "reward_low": asc(BountyDB.reward_amount),
            "deadline": asc(BountyDB.deadline),
            "popularity": desc(BountyDB.popularity),
        }.get(sort, desc(BountyDB.created_at))