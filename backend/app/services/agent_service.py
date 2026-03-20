"""Agent service for managing AI agents in the marketplace."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_for_update

from app.models.agent import (
    AgentDB,
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListItem,
    AgentListResponse,
    AgentRole,
    AgentStatus,
    AgentPerformanceStats,
    PastWorkItem,
    HireAgentRequest,
    HireAgentResponse,
)


class AgentService:
    """Service class for agent operations."""

    @staticmethod
    def _escape_like_pattern(pattern: str) -> str:
        """
        Escape special characters in LIKE pattern to prevent SQL injection.
        
        Args:
            pattern: The search pattern to escape
            
        Returns:
            Escaped pattern safe for LIKE queries
        """
        # Escape special LIKE characters: %, _, \
        escaped = pattern.replace('\\', '\\\\')
        escaped = escaped.replace('%', '\\%')
        escaped = escaped.replace('_', '\\_')
        return escaped

    @staticmethod
    async def create_agent(db: AsyncSession, agent_data: AgentCreate) -> AgentDB:
        """Create a new agent."""
        agent = AgentDB(
            name=agent_data.name,
            display_name=agent_data.display_name,
            avatar_url=agent_data.avatar_url,
            role=agent_data.role,
            bio=agent_data.bio,
            capabilities=agent_data.capabilities,
            specializations=agent_data.specializations,
            pricing_hourly=agent_data.pricing_hourly,
            pricing_fixed=agent_data.pricing_fixed,
            owner_wallet=agent_data.owner_wallet,
            sdk_version=agent_data.sdk_version,
            status=AgentStatus.OFFLINE,
        )
        db.add(agent)
        await db.commit()
        await db.refresh(agent)
        return agent

    @staticmethod
    async def get_agent_by_id(db: AsyncSession, agent_id: UUID) -> Optional[AgentDB]:
        """Get an agent by ID."""
        result = await db.execute(
            select(AgentDB).where(AgentDB.id == agent_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_agent_by_name(db: AsyncSession, name: str) -> Optional[AgentDB]:
        """Get an agent by name."""
        result = await db.execute(
            select(AgentDB).where(AgentDB.name == name)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_agent(
        db: AsyncSession, agent_id: UUID, update_data: AgentUpdate
    ) -> Optional[AgentDB]:
        """Update an agent's information."""
        agent = await AgentService.get_agent_by_id(db, agent_id)
        if not agent:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(agent, field, value)

        agent.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(agent)
        return agent

    @staticmethod
    async def list_agents(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        role: Optional[AgentRole] = None,
        status: Optional[AgentStatus] = None,
        min_success_rate: Optional[float] = None,
        search: Optional[str] = None,
    ) -> tuple[list[AgentDB], int]:
        """
        List agents with filtering and pagination.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            role: Filter by agent role
            status: Filter by agent status
            min_success_rate: Filter by minimum success rate
            search: Search term for name, display_name, or bio
            
        Returns:
            Tuple of (list of agents, total count)
        """
        query = select(AgentDB)
        count_query = select(func.count(AgentDB.id))

        # Apply filters
        conditions = []
        if role:
            conditions.append(AgentDB.role == role)
        if status:
            conditions.append(AgentDB.status == status)
        if min_success_rate is not None:
            conditions.append(AgentDB.success_rate >= min_success_rate)
        if search:
            # Escape special characters to prevent SQL injection
            escaped_search = AgentService._escape_like_pattern(search)
            search_term = f"%{escaped_search}%"
            conditions.append(
                or_(
                    AgentDB.name.ilike(search_term, escape='\\'),
                    AgentDB.display_name.ilike(search_term, escape='\\'),
                    AgentDB.bio.ilike(search_term, escape='\\'),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Get total count
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        query = query.order_by(AgentDB.reputation_score.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        agents = list(result.scalars().all())

        return agents, total

    @staticmethod
    async def compare_agents(
        db: AsyncSession, agent_ids: list[UUID]
    ) -> list[AgentDB]:
        """Get multiple agents for comparison."""
        result = await db.execute(
            select(AgentDB).where(AgentDB.id.in_(agent_ids))
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_agent_status(
        db: AsyncSession, agent_id: UUID, status: AgentStatus
    ) -> Optional[AgentDB]:
        """Update an agent's availability status."""
        agent = await AgentService.get_agent_by_id(db, agent_id)
        if not agent:
            return None

        agent.status = status
        if status == AgentStatus.AVAILABLE:
            agent.last_active_at = datetime.now(timezone.utc)
        agent.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(agent)
        return agent

    @staticmethod
    async def hire_agent_for_bounty(
        db: AsyncSession, hire_request: HireAgentRequest
    ) -> HireAgentResponse:
        """
        Assign an agent to a bounty with race condition protection.
        
        Uses SELECT FOR UPDATE to prevent TOCTOU (Time-Of-Check-Time-Of-Use) issues.
        This ensures atomic check-and-update operations in concurrent scenarios.
        
        Args:
            db: Database session
            hire_request: Request containing agent_id and bounty_id
            
        Returns:
            HireAgentResponse with success status and message
        """
        try:
            agent_id = UUID(hire_request.agent_id)
        except ValueError:
            return HireAgentResponse(
                success=False,
                message=f"Invalid agent ID format: {hire_request.agent_id}",
            )

        # Use SELECT FOR UPDATE to lock the row and prevent concurrent modifications
        # This fixes the TOCTOU race condition
        result = await db.execute(
            select(AgentDB)
            .where(AgentDB.id == agent_id)
            .with_for_update()
        )
        agent = result.scalar_one_or_none()

        if not agent:
            return HireAgentResponse(
                success=False,
                message=f"Agent {hire_request.agent_id} not found",
            )

        # Check status while holding the lock
        if agent.status == AgentStatus.WORKING:
            return HireAgentResponse(
                success=False,
                message=f"Agent {agent.name} is already working on another bounty",
            )

        if agent.status == AgentStatus.OFFLINE:
            return HireAgentResponse(
                success=False,
                message=f"Agent {agent.name} is currently offline",
            )

        # Update agent status atomically while still holding the lock
        agent.status = AgentStatus.WORKING
        agent.bounties_in_progress += 1
        agent.updated_at = datetime.now(timezone.utc)
        
        # Commit releases the lock
        await db.commit()

        return HireAgentResponse(
            success=True,
            message=f"Agent {agent.name} has been assigned to bounty {hire_request.bounty_id}",
            assignment_id=f"assignment-{agent.id}-{hire_request.bounty_id}",
        )

    @staticmethod
    def db_to_response(agent: AgentDB) -> AgentResponse:
        """Convert database model to response model."""
        performance = AgentPerformanceStats(
            bounties_completed=agent.bounties_completed,
            bounties_in_progress=agent.bounties_in_progress,
            success_rate=agent.success_rate,
            avg_completion_time_hours=agent.avg_completion_time_hours,
            total_earnings=agent.total_earnings,
            reputation_score=agent.reputation_score,
        )

        past_work = []
        for item in agent.past_work_links or []:
            past_work.append(PastWorkItem(**item))

        return AgentResponse(
            id=str(agent.id),
            name=agent.name,
            display_name=agent.display_name,
            avatar_url=agent.avatar_url,
            role=agent.role,
            status=agent.status,
            bio=agent.bio,
            capabilities=agent.capabilities,
            specializations=agent.specializations,
            pricing_hourly=agent.pricing_hourly,
            pricing_fixed=agent.pricing_fixed,
            performance=performance,
            past_work=past_work,
            owner_wallet=agent.owner_wallet,
            sdk_version=agent.sdk_version,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
            last_active_at=agent.last_active_at,
        )

    @staticmethod
    def db_to_list_item(agent: AgentDB) -> AgentListItem:
        """Convert database model to list item model."""
        performance = AgentPerformanceStats(
            bounties_completed=agent.bounties_completed,
            bounties_in_progress=agent.bounties_in_progress,
            success_rate=agent.success_rate,
            avg_completion_time_hours=agent.avg_completion_time_hours,
            total_earnings=agent.total_earnings,
            reputation_score=agent.reputation_score,
        )

        return AgentListItem(
            id=str(agent.id),
            name=agent.name,
            display_name=agent.display_name,
            avatar_url=agent.avatar_url,
            role=agent.role,
            status=agent.status,
            bio=agent.bio,
            capabilities=agent.capabilities,
            performance=performance,
            pricing_hourly=agent.pricing_hourly,
            pricing_fixed=agent.pricing_fixed,
        )