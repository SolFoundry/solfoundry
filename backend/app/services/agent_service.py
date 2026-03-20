"""Agent service layer for CRUD operations.

This module provides the service layer for agent registration and management.
Uses SQLAlchemy database persistence with the Agent model.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import (
    Agent,
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListItem,
    AgentListResponse,
    AgentRole,
)


async def create_agent(db: AsyncSession, data: AgentCreate) -> AgentResponse:
    """Register a new agent.

    Args:
        db: Database session
        data: Agent registration payload

    Returns:
        AgentResponse with created agent details
    """
    now = datetime.now(timezone.utc)

    agent = Agent(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        role=data.role.value,
        capabilities=data.capabilities,
        languages=data.languages,
        apis=data.apis,
        operator_wallet=data.operator_wallet,
        is_active=True,
        availability="available",
        created_at=now,
        updated_at=now,
    )

    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        description=agent.description,
        role=agent.role,
        capabilities=agent.capabilities or [],
        languages=agent.languages or [],
        apis=agent.apis or [],
        operator_wallet=agent.operator_wallet,
        is_active=agent.is_active,
        availability=agent.availability,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


async def get_agent(db: AsyncSession, agent_id: str) -> Optional[AgentResponse]:
    """Get an agent by ID.

    Args:
        db: Database session
        agent_id: Agent UUID string

    Returns:
        AgentResponse if found, None otherwise
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return None

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return None

    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        description=agent.description,
        role=agent.role,
        capabilities=agent.capabilities or [],
        languages=agent.languages or [],
        apis=agent.apis or [],
        operator_wallet=agent.operator_wallet,
        is_active=agent.is_active,
        availability=agent.availability,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


async def list_agents(
    db: AsyncSession,
    role: Optional[AgentRole] = None,
    available: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
) -> AgentListResponse:
    """List agents with optional filtering and pagination.

    Args:
        db: Database session
        role: Filter by agent role
        available: Filter by availability (True = available only)
        page: Page number (1-indexed)
        limit: Items per page

    Returns:
        AgentListResponse with paginated results
    """
    # Build query conditions
    conditions = []

    if role is not None:
        conditions.append(Agent.role == role.value)

    if available is not None:
        if available:
            conditions.append(
                and_(Agent.is_active.is_(True), Agent.availability == "available")
            )
        else:
            conditions.append(
                and_(Agent.is_active.is_(False), Agent.availability != "available")
            )

    # Build base query
    base_query = select(Agent)
    if conditions:
        base_query = base_query.where(and_(*conditions))

    # Get total count
    from sqlalchemy import func

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results, sorted by created_at descending
    offset = (page - 1) * limit
    query = base_query.order_by(Agent.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    agents = result.scalars().all()

    items = [
        AgentListItem(
            id=str(a.id),
            name=a.name,
            role=a.role,
            capabilities=a.capabilities or [],
            is_active=a.is_active,
            availability=a.availability,
            operator_wallet=a.operator_wallet,
            created_at=a.created_at,
        )
        for a in agents
    ]

    return AgentListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


async def update_agent(
    db: AsyncSession, agent_id: str, data: AgentUpdate, operator_wallet: str
) -> tuple[Optional[AgentResponse], Optional[str]]:
    """Update an agent (only by the operator who registered it).

    Args:
        db: Database session
        agent_id: Agent UUID string
        data: Update payload
        operator_wallet: Wallet address of the operator making the request

    Returns:
        Tuple of (AgentResponse, None) on success, or (None, error_message) on failure
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return None, "Invalid agent ID format"

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return None, "Agent not found"

    # Verify ownership
    if agent.operator_wallet != operator_wallet:
        return (
            None,
            "Unauthorized: only the operator who registered this agent can update it",
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "role" and value is not None:
            setattr(agent, key, value.value)
        else:
            setattr(agent, key, value)

    agent.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(agent)

    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        description=agent.description,
        role=agent.role,
        capabilities=agent.capabilities or [],
        languages=agent.languages or [],
        apis=agent.apis or [],
        operator_wallet=agent.operator_wallet,
        is_active=agent.is_active,
        availability=agent.availability,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    ), None


async def deactivate_agent(
    db: AsyncSession, agent_id: str, operator_wallet: str
) -> tuple[bool, Optional[str]]:
    """Deactivate an agent (soft delete - sets is_active=False).

    Args:
        db: Database session
        agent_id: Agent UUID string
        operator_wallet: Wallet address of the operator making the request

    Returns:
        Tuple of (success, error_message) - error_message is None on success
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return False, "Invalid agent ID format"

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return False, "Agent not found"

    # Verify ownership
    if agent.operator_wallet != operator_wallet:
        return (
            False,
            "Unauthorized: only the operator who registered this agent can deactivate it",
        )

    agent.is_active = False
    agent.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return True, None


async def get_agent_by_wallet(
    db: AsyncSession, operator_wallet: str
) -> Optional[AgentResponse]:
    """Get an agent by operator wallet address.

    Args:
        db: Database session
        operator_wallet: Solana wallet address

    Returns:
        AgentResponse if found, None otherwise
    """
    result = await db.execute(
        select(Agent).where(Agent.operator_wallet == operator_wallet)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        return None

    return AgentResponse(
        id=str(agent.id),
        name=agent.name,
        description=agent.description,
        role=agent.role,
        capabilities=agent.capabilities or [],
        languages=agent.languages or [],
        apis=agent.apis or [],
        operator_wallet=agent.operator_wallet,
        is_active=agent.is_active,
        availability=agent.availability,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )
