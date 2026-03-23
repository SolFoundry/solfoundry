"""Agent service layer for CRUD operations.

This module provides the service layer for agent registration and management.
Uses SQLAlchemy database persistence with the Agent model.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import (
    MAX_ACTIVITY_LOG,
    Agent,
    AgentActivityAppend,
    AgentCreate,
    AgentLeaderboardItem,
    AgentLeaderboardResponse,
    AgentListItem,
    AgentListResponse,
    AgentResponse,
    AgentRole,
    AgentUpdate,
)


def _agent_to_response(agent: Agent) -> AgentResponse:
    """Map ORM row to API response."""
    raw_log = agent.activity_log if isinstance(agent.activity_log, list) else []
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
        api_endpoint=agent.api_endpoint,
        verified=bool(agent.verified),
        reputation_score=float(agent.reputation_score or 0.0),
        success_rate=int(agent.success_rate or 0),
        bounties_completed=int(agent.bounties_completed or 0),
        activity_log=raw_log,
        completed_bounties=[],
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


def _agent_to_list_item(agent: Agent) -> AgentListItem:
    return AgentListItem(
        id=str(agent.id),
        name=agent.name,
        role=agent.role,
        capabilities=agent.capabilities or [],
        is_active=agent.is_active,
        availability=agent.availability,
        operator_wallet=agent.operator_wallet,
        verified=bool(agent.verified),
        reputation_score=float(agent.reputation_score or 0.0),
        success_rate=int(agent.success_rate or 0),
        bounties_completed=int(agent.bounties_completed or 0),
        api_endpoint=agent.api_endpoint,
        created_at=agent.created_at,
    )


async def create_agent(db: AsyncSession, data: AgentCreate) -> AgentResponse:
    """Register a new agent."""
    now = datetime.now(timezone.utc)
    welcome = [
        {
            "ts": now.isoformat(),
            "type": "registered",
            "message": f'Agent "{data.name}" registered on the marketplace',
        }
    ]

    agent = Agent(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        role=data.role.value,
        capabilities=data.capabilities,
        languages=data.languages,
        apis=data.apis,
        operator_wallet=data.operator_wallet,
        api_endpoint=data.api_endpoint,
        is_active=True,
        availability="available",
        verified=False,
        reputation_score=0.0,
        success_rate=0,
        bounties_completed=0,
        activity_log=welcome,
        created_at=now,
        updated_at=now,
    )

    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    return _agent_to_response(agent)


async def get_agent(db: AsyncSession, agent_id: str) -> Optional[AgentResponse]:
    """Get an agent by ID."""
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return None

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return None

    return _agent_to_response(agent)


async def list_agents(
    db: AsyncSession,
    role: Optional[AgentRole] = None,
    available: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
) -> AgentListResponse:
    """List agents with optional filtering and pagination."""
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

    base_query = select(Agent)
    if conditions:
        base_query = base_query.where(and_(*conditions))

    from sqlalchemy import func

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    offset = (page - 1) * limit
    query = base_query.order_by(Agent.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    agents = result.scalars().all()

    items = [_agent_to_list_item(a) for a in agents]

    return AgentListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


async def list_leaderboard(
    db: AsyncSession, limit: int = 50
) -> AgentLeaderboardResponse:
    """Active agents ranked by reputation, success rate, and completions."""
    lim = max(1, min(limit, 100))
    q = (
        select(Agent)
        .where(Agent.is_active.is_(True))
        .order_by(
            desc(Agent.reputation_score),
            desc(Agent.success_rate),
            desc(Agent.bounties_completed),
            desc(Agent.created_at),
        )
        .limit(lim)
    )
    result = await db.execute(q)
    rows = result.scalars().all()
    items = [
        AgentLeaderboardItem(
            rank=i + 1,
            id=str(a.id),
            name=a.name,
            role=a.role,
            reputation_score=float(a.reputation_score or 0.0),
            success_rate=int(a.success_rate or 0),
            bounties_completed=int(a.bounties_completed or 0),
            verified=bool(a.verified),
            availability=a.availability,
        )
        for i, a in enumerate(rows)
    ]
    return AgentLeaderboardResponse(items=items)


async def append_agent_activity(
    db: AsyncSession,
    agent_id: str,
    operator_wallet: str,
    payload: AgentActivityAppend,
) -> tuple[Optional[AgentResponse], Optional[str]]:
    """Prepend an activity entry (newest first), capped at MAX_ACTIVITY_LOG."""
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return None, "Invalid agent ID format"

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return None, "Agent not found"

    if agent.operator_wallet != operator_wallet:
        return (
            None,
            "Unauthorized: only the operator who registered this agent can append activity",
        )

    log = list(agent.activity_log) if isinstance(agent.activity_log, list) else []
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": payload.type,
        "message": payload.message,
    }
    log.insert(0, entry)
    agent.activity_log = log[:MAX_ACTIVITY_LOG]
    agent.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(agent)

    return _agent_to_response(agent), None


async def update_agent(
    db: AsyncSession, agent_id: str, data: AgentUpdate, operator_wallet: str
) -> tuple[Optional[AgentResponse], Optional[str]]:
    """Update an agent (only by the operator who registered it)."""
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return None, "Invalid agent ID format"

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return None, "Agent not found"

    if agent.operator_wallet != operator_wallet:
        return (
            None,
            "Unauthorized: only the operator who registered this agent can update it",
        )

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "role" and value is not None:
            setattr(agent, key, value.value)
        else:
            setattr(agent, key, value)

    agent.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(agent)

    return _agent_to_response(agent), None


async def deactivate_agent(
    db: AsyncSession, agent_id: str, operator_wallet: str
) -> tuple[bool, Optional[str]]:
    """Deactivate an agent (soft delete - sets is_active=False)."""
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return False, "Invalid agent ID format"

    result = await db.execute(select(Agent).where(Agent.id == agent_uuid))
    agent = result.scalar_one_or_none()

    if not agent:
        return False, "Agent not found"

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
    """Get an agent by operator wallet address."""
    result = await db.execute(
        select(Agent).where(Agent.operator_wallet == operator_wallet)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        return None

    return _agent_to_response(agent)
