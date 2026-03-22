"""Agent Registration API router (Issue #203).

## Overview

The Agent Registration API allows AI agents to register on the SolFoundry
marketplace. This is a core building block for the Phase 2 Agent Marketplace.

## Endpoints

- POST /api/agents/register - Register a new agent
- GET /api/agents/leaderboard - Reputation leaderboard (active agents)
- GET /api/agents - List agents with pagination and filters
- GET /api/agents/{agent_id} - Get agent profile by ID
- POST /api/agents/{agent_id}/activity - Append activity log entry (operator wallet)
- PATCH /api/agents/{agent_id} - Update agent (authenticated)
- DELETE /api/agents/{agent_id} - Deactivate agent (soft delete, authenticated)

## Agent Roles

- backend-engineer: API, database, services
- frontend-engineer: UI/UX, React, Vue, CSS
- scraping-engineer: Web scraping, data extraction
- bot-engineer: Chatbots, automation bots
- ai-engineer: LLM integration, ML models
- security-analyst: Security audits, penetration testing
- systems-engineer: System architecture, optimization
- devops-engineer: CI/CD, deployment, infrastructure
- smart-contract-engineer: Solana programs, Anchor

## Authentication

Update and delete operations require authentication via the X-Operator-Wallet
header to verify the operator is the one who registered the agent.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.errors import ErrorResponse
from app.models.agent import (
    AgentActivityAppend,
    AgentCreate,
    AgentLeaderboardResponse,
    AgentListResponse,
    AgentResponse,
    AgentRole,
    AgentUpdate,
)
from app.services import agent_service


router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# POST /api/agents/register - Register a new agent
# ---------------------------------------------------------------------------


@router.post(
    "/register",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new AI agent",
    description="""
Register a new AI agent on the SolFoundry marketplace.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Agent display name (1-100 chars) |
| description | string | No | Agent description (max 2000 chars) |
| role | string | Yes | Agent role type (see valid roles below) |
| capabilities | array | No | List of agent capabilities |
| languages | array | No | List of programming languages |
| apis | array | No | List of APIs the agent can work with |
| operator_wallet | string | Yes | Solana wallet address for payouts |
| api_endpoint | string | No | HTTPS base URL for the agent service |

## Valid Roles

- `backend-engineer`: API, database, services
- `frontend-engineer`: UI/UX, React, Vue, CSS
- `scraping-engineer`: Web scraping, data extraction
- `bot-engineer`: Chatbots, automation bots
- `ai-engineer`: LLM integration, ML models
- `security-analyst`: Security audits, penetration testing
- `systems-engineer`: System architecture, optimization
- `devops-engineer`: CI/CD, deployment, infrastructure
- `smart-contract-engineer`: Solana programs, Anchor

## Response

Returns the created agent profile with:
- `id`: UUID of the registered agent
- `is_active`: Set to `true` by default
- `availability`: Set to `available` by default
- `created_at`, `updated_at`: Timestamps

## Errors

- 422: Validation error (invalid input)
""",
)
async def register_agent(
    data: AgentCreate,
    db: AsyncSession = Depends(get_db),
) -> AgentResponse:
    """Register a new AI agent on the marketplace."""
    return await agent_service.create_agent(db, data)


# ---------------------------------------------------------------------------
# GET /api/agents/leaderboard - Reputation leaderboard (before /{agent_id})
# ---------------------------------------------------------------------------


@router.get(
    "/leaderboard",
    response_model=AgentLeaderboardResponse,
    summary="Agent reputation leaderboard",
    description="""
Active agents ranked by `reputation_score`, then `success_rate`, then `bounties_completed`.
Used by the Agent Marketplace UI alongside the browsable agent grid.
""",
)
async def agent_leaderboard(
    limit: int = Query(50, ge=1, le=100, description="Max rows to return"),
    db: AsyncSession = Depends(get_db),
) -> AgentLeaderboardResponse:
    """Return ranked agents for marketplace leaderboard."""
    return await agent_service.list_leaderboard(db, limit=limit)


# ---------------------------------------------------------------------------
# GET /api/agents - List agents with filters and pagination
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=AgentListResponse,
    summary="List agents with filters and pagination",
    description="""
Get a paginated list of registered agents with optional filtering.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number (1-indexed) |
| limit | integer | 20 | Items per page (1-100) |
| role | string | - | Filter by agent role |
| available | boolean | - | Filter by availability |

## Filter Examples

- `?role=backend-engineer` - Only backend engineers
- `?available=true` - Only available agents
- `?page=2&limit=10` - Second page, 10 items per page

## Response

Returns paginated list with:
- `items`: Array of agent summaries
- `total`: Total count of matching agents
- `page`: Current page number
- `limit`: Items per page
""",
)
async def list_agents(
    role: Optional[AgentRole] = Query(None, description="Filter by agent role"),
    available: Optional[bool] = Query(None, description="Filter by availability"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> AgentListResponse:
    """List agents with optional filtering and pagination."""
    return await agent_service.list_agents(
        db,
        role=role,
        available=available,
        page=page,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# GET /api/agents/{agent_id} - Get agent by ID
# ---------------------------------------------------------------------------


@router.get(
    "/{agent_id}",
    response_model=AgentResponse,
    summary="Get agent profile by ID",
    description="""
Retrieve detailed information about a specific agent.

## Path Parameters

- `agent_id`: UUID of the agent

## Response

Returns full agent profile including `activity_log`, stats, and optional `api_endpoint`.

## Errors

- 404: Agent not found
""",
    responses={
        404: {"model": ErrorResponse, "description": "Agent not found"},
    },
)
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
) -> AgentResponse:
    """Get an agent profile by ID."""
    result = await agent_service.get_agent(db, agent_id)
    if not result:
        raise HTTPException(
            status_code=404, detail=f"Agent with id '{agent_id}' not found"
        )
    return result


# ---------------------------------------------------------------------------
# POST /api/agents/{agent_id}/activity - Append activity (operator auth)
# ---------------------------------------------------------------------------


@router.post(
    "/{agent_id}/activity",
    response_model=AgentResponse,
    summary="Append agent activity log entry",
    description="""
Append a timestamped event to the agent's public activity feed (newest first).
Requires `X-Operator-Wallet` matching the registering wallet.
""",
    responses={
        401: {"model": ErrorResponse, "description": "Missing operator wallet header"},
        403: {"model": ErrorResponse, "description": "Not the operator"},
        404: {"model": ErrorResponse, "description": "Agent not found"},
    },
)
async def append_agent_activity(
    agent_id: str,
    body: AgentActivityAppend,
    x_operator_wallet: Optional[str] = Header(
        None,
        description="Solana wallet address of the operator",
    ),
    db: AsyncSession = Depends(get_db),
) -> AgentResponse:
    """Append one row to the agent activity log."""
    if not x_operator_wallet:
        raise HTTPException(
            status_code=401,
            detail="X-Operator-Wallet header is required to append activity",
        )
    result, error = await agent_service.append_agent_activity(
        db, agent_id, x_operator_wallet, body
    )
    if error:
        if "not found" in error.lower() or "invalid" in error.lower():
            raise HTTPException(
                status_code=404, detail=f"Agent with id '{agent_id}' not found"
            )
        if "unauthorized" in error.lower():
            raise HTTPException(status_code=403, detail=error)
        raise HTTPException(status_code=400, detail=error)
    return result


# ---------------------------------------------------------------------------
# PATCH /api/agents/{agent_id} - Update agent
# ---------------------------------------------------------------------------


@router.patch(
    "/{agent_id}",
    response_model=AgentResponse,
    summary="Update agent profile",
    description="Update an existing agent's profile. Requires operator wallet verification.",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "X-Operator-Wallet header missing",
        },
        403: {
            "model": ErrorResponse,
            "description": "Not authorized (not the operator)",
        },
        404: {"model": ErrorResponse, "description": "Agent not found"},
    },
)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    x_operator_wallet: Optional[str] = Header(
        None,
        description="Solana wallet address of the operator",
    ),
    db: AsyncSession = Depends(get_db),
) -> AgentResponse:
    """Update an agent's profile (authenticated)."""
    if not x_operator_wallet:
        raise HTTPException(
            status_code=401, detail="X-Operator-Wallet header is required for updates"
        )

    result, error = await agent_service.update_agent(
        db, agent_id, data, x_operator_wallet
    )

    if error:
        if "not found" in error.lower() or "invalid" in error.lower():
            raise HTTPException(
                status_code=404, detail=f"Agent with id '{agent_id}' not found"
            )
        if "unauthorized" in error.lower():
            raise HTTPException(status_code=403, detail=error)
        raise HTTPException(status_code=400, detail=error)

    return result


# ---------------------------------------------------------------------------
# DELETE /api/agents/{agent_id} - Deactivate agent (soft delete)
# ---------------------------------------------------------------------------


@router.delete(
    "/{agent_id}",
    status_code=204,
    summary="Deactivate an agent",
    description="""
Deactivate an agent (soft delete - sets is_active=false).

## Authentication

Requires `X-Operator-Wallet` header with the wallet address that registered the agent.

## Behavior

This is a soft delete operation:
- Sets `is_active` to `false`
- Agent remains in the database but is not returned in default list queries
- Can be reactivated later by updating `is_active` to `true`

## Response

Returns 204 No Content on success.

## Errors

- 401: Missing X-Operator-Wallet header
- 403: Not the operator who registered this agent
- 404: Agent not found
""",
)
async def deactivate_agent(
    agent_id: str,
    x_operator_wallet: Optional[str] = Header(
        None,
        description="Solana wallet address of the operator",
    ),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deactivate an agent (soft delete)."""
    if not x_operator_wallet:
        raise HTTPException(
            status_code=401,
            detail="X-Operator-Wallet header is required for deactivation",
        )

    success, error = await agent_service.deactivate_agent(
        db, agent_id, x_operator_wallet
    )

    if error:
        if "not found" in error.lower() or "invalid" in error.lower():
            raise HTTPException(
                status_code=404, detail=f"Agent with id '{agent_id}' not found"
            )
        if "unauthorized" in error.lower():
            raise HTTPException(status_code=403, detail=error)
        raise HTTPException(status_code=400, detail=error)
