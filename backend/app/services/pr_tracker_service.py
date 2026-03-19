"""PR Status Tracker service."""

from typing import List, Optional
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pr_tracker import (
    PRTrackerDB,
    PRTrackerCreate,
    PRTrackerUpdate,
    PRTrackerResponse,
    PRTrackerListItem,
    PRTrackerListResponse,
    PRStatus,
)


class PRTrackerService:
    """Service for PR status tracking operations."""
    
    VALID_STATUSES = {s.value for s in PRStatus}
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_pr(
        self,
        repository: str,
        pr_number: int,
    ) -> Optional[PRTrackerResponse]:
        """Get a PR tracker by repo and PR number."""
        query = select(PRTrackerDB).where(
            and_(
                PRTrackerDB.repository == repository,
                PRTrackerDB.pr_number == pr_number,
            )
        )
        
        result = await self.db.execute(query)
        tracker = result.scalar_one_or_none()
        
        if not tracker:
            return None
        
        return PRTrackerResponse.model_validate(tracker)
    
    async def list_prs(
        self,
        repository: Optional[str] = None,
        status: Optional[str] = None,
        author: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> PRTrackerListResponse:
        """List PR trackers with filters."""
        conditions = []
        
        if repository:
            conditions.append(PRTrackerDB.repository == repository)
        if status:
            conditions.append(PRTrackerDB.status == status)
        if author:
            conditions.append(PRTrackerDB.author == author)
        
        filter_condition = and_(*conditions) if conditions else None
        
        # Count query
        count_query = select(func.count(PRTrackerDB.id))
        if filter_condition is not None:
            count_query = count_query.where(filter_condition)
        
        # Main query
        query = select(PRTrackerDB).order_by(desc(PRTrackerDB.updated_at))
        if filter_condition is not None:
            query = query.where(filter_condition)
        query = query.offset(skip).limit(limit)
        
        # Execute
        result = await self.db.execute(query)
        trackers = result.scalars().all()
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        return PRTrackerListResponse(
            items=[PRTrackerListItem.model_validate(t) for t in trackers],
            total=total,
            skip=skip,
            limit=limit,
        )
    
    async def create_pr(self, data: PRTrackerCreate) -> PRTrackerDB:
        """Create a new PR tracker."""
        tracker = PRTrackerDB(
            pr_number=data.pr_number,
            repository=data.repository,
            title=data.title,
            author=data.author,
            bounty_id=data.bounty_id,
            opened_at=data.opened_at,
            status=PRStatus.OPEN.value,
        )
        
        self.db.add(tracker)
        return tracker
    
    async def update_pr(
        self,
        repository: str,
        pr_number: int,
        data: PRTrackerUpdate,
    ) -> Optional[PRTrackerDB]:
        """Update a PR tracker."""
        query = select(PRTrackerDB).where(
            and_(
                PRTrackerDB.repository == repository,
                PRTrackerDB.pr_number == pr_number,
            )
        )
        
        result = await self.db.execute(query)
        tracker = result.scalar_one_or_none()
        
        if not tracker:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tracker, key, value)
        
        return tracker
    
    async def delete_pr(self, repository: str, pr_number: int) -> bool:
        """Delete a PR tracker."""
        query = select(PRTrackerDB).where(
            and_(
                PRTrackerDB.repository == repository,
                PRTrackerDB.pr_number == pr_number,
            )
        )
        
        result = await self.db.execute(query)
        tracker = result.scalar_one_or_none()
        
        if not tracker:
            return False
        
        await self.db.delete(tracker)
        return True