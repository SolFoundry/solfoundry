"""Agent service layer for CRUD operations.

This module provides the service layer for agent registration and management.
Uses in-memory storage for development, designed to be replaced with database
persistence using the SQLAlchemy Agent model.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListItem,
    AgentListResponse,
    AgentRole,
)


# In-memory storage for agents (replace with database in production)
# Maps agent_id -> AgentResponse-like dict
_agent_store: dict[str, dict] = {}


def clear_store():
    """Clear the agent store (for testing)."""
    _agent_store.clear()


def create_agent(data: AgentCreate) -> AgentResponse:
    """Register a new agent.

    Args:
        data: Agent registration payload

    Returns:
        AgentResponse with created agent details
    """
    agent_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    agent_dict = {
        "id": agent_id,
        "name": data.name,
        "description": data.description,
        "role": data.role.value,
        "capabilities": data.capabilities,
        "languages": data.languages,
        "apis": data.apis,
        "operator_wallet": data.operator_wallet,
        "is_active": True,
        "availability": "available",
        "created_at": now,
        "updated_at": now,
    }

    _agent_store[agent_id] = agent_dict
    return AgentResponse(**agent_dict)


def get_agent(agent_id: str) -> Optional[AgentResponse]:
    """Get an agent by ID.

    Args:
        agent_id: Agent UUID string

    Returns:
        AgentResponse if found, None otherwise
    """
    agent_dict = _agent_store.get(agent_id)
    if not agent_dict:
        return None
    return AgentResponse(**agent_dict)


def list_agents(
    role: Optional[AgentRole] = None,
    available: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
) -> AgentListResponse:
    """List agents with optional filtering and pagination.

    Args:
        role: Filter by agent role
        available: Filter by availability (True = available only)
        page: Page number (1-indexed)
        limit: Items per page

    Returns:
        AgentListResponse with paginated results
    """
    # Filter agents
    filtered = list(_agent_store.values())

    if role is not None:
        filtered = [a for a in filtered if a["role"] == role.value]

    if available is not None:
        if available:
            filtered = [
                a
                for a in filtered
                if a["is_active"] and a["availability"] == "available"
            ]
        else:
            filtered = [
                a
                for a in filtered
                if not a["is_active"] or a["availability"] != "available"
            ]

    # Sort by created_at descending (newest first)
    filtered.sort(key=lambda x: x["created_at"], reverse=True)

    # Paginate
    total = len(filtered)
    start = (page - 1) * limit
    end = start + limit
    items = [AgentListItem(**a) for a in filtered[start:end]]

    return AgentListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


def update_agent(
    agent_id: str, data: AgentUpdate, operator_wallet: str
) -> tuple[Optional[AgentResponse], Optional[str]]:
    """Update an agent (only by the operator who registered it).

    Args:
        agent_id: Agent UUID string
        data: Update payload
        operator_wallet: Wallet address of the operator making the request

    Returns:
        Tuple of (AgentResponse, None) on success, or (None, error_message) on failure
    """
    agent_dict = _agent_store.get(agent_id)
    if not agent_dict:
        return None, "Agent not found"

    # Verify ownership
    if agent_dict["operator_wallet"] != operator_wallet:
        return (
            None,
            "Unauthorized: only the operator who registered this agent can update it",
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "role" and value is not None:
            agent_dict[key] = value.value
        else:
            agent_dict[key] = value

    agent_dict["updated_at"] = datetime.now(timezone.utc)

    return AgentResponse(**agent_dict), None


def deactivate_agent(agent_id: str, operator_wallet: str) -> tuple[bool, Optional[str]]:
    """Deactivate an agent (soft delete - sets is_active=False).

    Args:
        agent_id: Agent UUID string
        operator_wallet: Wallet address of the operator making the request

    Returns:
        Tuple of (success, error_message) - error_message is None on success
    """
    agent_dict = _agent_store.get(agent_id)
    if not agent_dict:
        return False, "Agent not found"

    # Verify ownership
    if agent_dict["operator_wallet"] != operator_wallet:
        return (
            False,
            "Unauthorized: only the operator who registered this agent can deactivate it",
        )

    agent_dict["is_active"] = False
    agent_dict["updated_at"] = datetime.now(timezone.utc)

    return True, None


def get_agent_by_wallet(operator_wallet: str) -> Optional[AgentResponse]:
    """Get an agent by operator wallet address.

    Args:
        operator_wallet: Solana wallet address

    Returns:
        AgentResponse if found, None otherwise
    """
    for agent_dict in _agent_store.values():
        if agent_dict["operator_wallet"] == operator_wallet:
            return AgentResponse(**agent_dict)
    return None
