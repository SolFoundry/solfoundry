"""Search service for bounties."""
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from app.models.bounty import Bounty
from app.config import settings


class SearchService:
    """Search service for bounties."""
    
    async def search_bounties(
        self,
        query: Optional[str] = None,
        tier: Optional[int] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        reward_min: Optional[float] = None,
        reward_max: Optional[float] = None,
        skills: Optional[List[str]] = None,
        sort_by: str = "newest",
        page: int = 1,
        page_size: int = 20,
        session: AsyncSession = None,
    ) -> tuple[List[Bounty], int]:
        """Search bounties with filters."""
        offset = (page - 1) * page_size
        
        # Build base query
        stmt = select(Bounty)
        
        # Apply filters
        if query:
            # Full-text search using PostgreSQL tsvector
            stmt = stmt.where(
                text("search_vector @@ plainto_tsquery('english', :query)")
            ).params(query=query)
        
        if tier is not None:
            stmt = stmt.where(Bounty.tier == tier)
        
        if category:
            stmt = stmt.where(Bounty.category == category)
        
        if status:
            stmt = stmt.where(Bounty.status == status)
        
        if reward_min is not None:
            stmt = stmt.where(Bounty.reward_min >= reward_min)
        
        if reward_max is not None:
            stmt = stmt.where(Bounty.reward_max <= reward_max)
        
        if skills:
            # Check if any of the skills match
            skill_filter = False
            for skill in skills:
                skill_filter = skill_filter | (Bounty.skills.contains([skill]))
            stmt = stmt.where(skill_filter)
        
        # Get total count before pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar()
        
        # Apply sorting
        if sort_by == "newest":
            stmt = stmt.order_by(Bounty.created_at.desc())
        elif sort_by == "reward_high":
            stmt = stmt.order_by(Bounty.reward_max.desc().nulls_last())
        elif sort_by == "reward_low":
            stmt = stmt.order_by(Bounty.reward_min.asc().nulls_last())
        elif sort_by == "deadline":
            stmt = stmt.order_by(Bounty.deadline.asc().nulls_last())
        elif sort_by == "popularity":
            # Could use a popularity score based on views/claims
            stmt = stmt.order_by(Bounty.created_at.desc())
        
        # Apply pagination
        stmt = stmt.offset(offset).limit(page_size)
        
        # Execute query
        result = await session.execute(stmt)
        bounties = result.scalars().all()
        
        return bounties, total
    
    async def get_autocomplete_suggestions(
        self,
        query: str,
        limit: int = 10,
        session: AsyncSession = None,
    ) -> List[str]:
        """Get autocomplete suggestions for search."""
        # Get matching titles
        stmt = (
            select(Bounty.title)
            .where(Bounty.title.ilike(f"%{query}%"))
            .limit(limit)
        )
        result = await session.execute(stmt)
        suggestions = [row[0] for row in result.all()]
        
        return suggestions
    
    async def initialize_search_vectors(self, session: AsyncSession):
        """Initialize full-text search vectors for existing bounties."""
        from sqlalchemy import text
        
        # Update search_vector for all bounties
        stmt = text("""
            UPDATE bounties SET search_vector = 
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B')
        """)
        await session.execute(stmt)
        await session.commit()
    
    async def create_search_index(self, session: AsyncSession):
        """Create GIN index for full-text search."""
        from sqlalchemy import text
        
        # Create GIN index
        stmt = text("""
            CREATE INDEX IF NOT EXISTS idx_bounties_search_vector 
            ON bounties USING GIN (search_vector)
        """)
        await session.execute(stmt)
        await session.commit()


search_service = SearchService()
