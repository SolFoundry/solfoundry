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


class BountyClaimService:
    """Service for bounty claim operations.
    
    Handles claiming, unclaiming, and claim history for bounties.
    """
    
    # Statuses that allow claiming
    CLAIMABLE_STATUSES = {"open"}
    # Statuses that indicate a bounty is already claimed
    CLAIMED_STATUSES = {"claimed", "in_progress"}
    
    def __init__(self, db):
        self.db = db
    
    async def claim_bounty(
        self, 
        bounty_id: str, 
        claimant_id: str
    ) -> tuple[BountyDB, "BountyClaimHistoryDB"]:
        """
        Claim a bounty for a contributor.
        
        Args:
            bounty_id: UUID of the bounty to claim.
            claimant_id: UUID of the contributor claiming the bounty.
            
        Returns:
            Tuple of (updated bounty, claim history record).
            
        Raises:
            ValueError: If bounty not found, already claimed, or not open.
        """
        from app.models.bounty import BountyClaimHistoryDB
        
        # Get the bounty
        query = select(BountyDB).where(BountyDB.id == bounty_id)
        result = await self.db.execute(query)
        bounty = result.scalar_one_or_none()
        
        if not bounty:
            raise ValueError(f"Bounty {bounty_id} not found")
        
        # Check if bounty can be claimed
        if bounty.status not in self.CLAIMABLE_STATUSES:
            raise ValueError(
                f"Cannot claim bounty with status '{bounty.status}'. "
                f"Only bounties with status 'open' can be claimed."
            )
        
        # Check if already claimed
        if bounty.claimant_id is not None:
            raise ValueError(
                f"Bounty {bounty_id} is already claimed by {bounty.claimant_id}"
            )
        
        # Update bounty status and claimant
        bounty.status = "in_progress"
        bounty.claimant_id = claimant_id
        
        # Create claim history record
        history = BountyClaimHistoryDB(
            bounty_id=bounty_id,
            claimant_id=claimant_id,
            action="claimed"
        )
        
        self.db.add(history)
        await self.db.flush()
        await self.db.refresh(bounty)
        
        return bounty, history
    
    async def unclaim_bounty(
        self, 
        bounty_id: str, 
        claimant_id: str,
        reason: str = None
    ) -> tuple[BountyDB, "BountyClaimHistoryDB"]:
        """
        Release a claimed bounty.
        
        Args:
            bounty_id: UUID of the bounty to unclaim.
            claimant_id: UUID of the current claimant.
            reason: Optional reason for unclaiming.
            
        Returns:
            Tuple of (updated bounty, claim history record).
            
        Raises:
            ValueError: If bounty not found, not claimed, or claimant mismatch.
        """
        from app.models.bounty import BountyClaimHistoryDB
        
        # Get the bounty
        query = select(BountyDB).where(BountyDB.id == bounty_id)
        result = await self.db.execute(query)
        bounty = result.scalar_one_or_none()
        
        if not bounty:
            raise ValueError(f"Bounty {bounty_id} not found")
        
        # Check if bounty is claimed
        if bounty.status not in self.CLAIMED_STATUSES:
            raise ValueError(
                f"Cannot unclaim bounty with status '{bounty.status}'. "
                f"Only claimed bounties can be released."
            )
        
        # Check if claimant matches
        if str(bounty.claimant_id) != str(claimant_id):
            raise ValueError(
                f"Only the current claimant can unclaim this bounty. "
                f"Current claimant: {bounty.claimant_id}"
            )
        
        # Update bounty status and clear claimant
        bounty.status = "open"
        bounty.claimant_id = None
        
        # Create unclaim history record
        history = BountyClaimHistoryDB(
            bounty_id=bounty_id,
            claimant_id=claimant_id,
            action="unclaimed",
            reason=reason
        )
        
        self.db.add(history)
        await self.db.flush()
        await self.db.refresh(bounty)
        
        return bounty, history
    
    async def get_claimant(self, bounty_id: str) -> dict:
        """
        Get the current claimant of a bounty.
        
        Args:
            bounty_id: UUID of the bounty.
            
        Returns:
            Dict with claimant info or None if not claimed.
            
        Raises:
            ValueError: If bounty not found.
        """
        from app.models.bounty import BountyClaimantResponse
        
        # Get the bounty
        query = select(BountyDB).where(BountyDB.id == bounty_id)
        result = await self.db.execute(query)
        bounty = result.scalar_one_or_none()
        
        if not bounty:
            raise ValueError(f"Bounty {bounty_id} not found")
        
        if bounty.claimant_id is None:
            return None
        
        # Get the claim time from the most recent claim history
        from app.models.bounty import BountyClaimHistoryDB
        history_query = (
            select(BountyClaimHistoryDB)
            .where(BountyClaimHistoryDB.bounty_id == bounty_id)
            .where(BountyClaimHistoryDB.claimant_id == bounty.claimant_id)
            .where(BountyClaimHistoryDB.action == "claimed")
            .order_by(desc(BountyClaimHistoryDB.created_at))
            .limit(1)
        )
        history_result = await self.db.execute(history_query)
        claim_history = history_result.scalar_one_or_none()
        
        claimed_at = claim_history.created_at if claim_history else bounty.updated_at
        
        return {
            "bounty_id": str(bounty.id),
            "claimant_id": str(bounty.claimant_id),
            "claimed_at": claimed_at,
            "status": bounty.status
        }
    
    async def get_claim_history(
        self,
        bounty_id: str = None,
        claimant_id: str = None,
        skip: int = 0,
        limit: int = 20
    ) -> tuple[list, int]:
        """
        Get claim history with optional filters.
        
        Args:
            bounty_id: Filter by bounty ID.
            claimant_id: Filter by claimant ID.
            skip: Pagination offset.
            limit: Number of results.
            
        Returns:
            Tuple of (list of history items, total count).
        """
        from app.models.bounty import BountyClaimHistoryDB
        
        # Build query conditions
        conditions = []
        if bounty_id:
            conditions.append(BountyClaimHistoryDB.bounty_id == bounty_id)
        if claimant_id:
            conditions.append(BountyClaimHistoryDB.claimant_id == claimant_id)
        
        # Count query
        count_query = select(func.count(BountyClaimHistoryDB.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        
        # Main query
        query = select(BountyClaimHistoryDB)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(desc(BountyClaimHistoryDB.created_at))
        query = query.offset(skip).limit(limit)
        
        # Execute queries
        result = await self.db.execute(query)
        items = result.scalars().all()
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        return list(items), total