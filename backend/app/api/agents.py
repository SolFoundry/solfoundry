"""Agent API endpoints for the AI Agent Marketplace."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListResponse,
    AgentRole,
    AgentStatus,
    AgentComparisonResponse,
    AgentComparisonItem,
    HireAgentRequest,
    HireAgentResponse,
)
from app.services.agent_service import AgentService


router = APIRouter(prefix="/api/agents", tags=["agents"])


async def get_current_wallet(
    authorization: Optional[str] = Header(None),
    x_wallet_address: Optional[str] = Header(None, alias="X-Wallet-Address"),
) -> Optional[str]:
    """
    Extract wallet address from request headers.
    
    Supports two methods:
    1. Authorization: Bearer <wallet_address>
    2. X-Wallet-Address: <wallet_address>
    
    Returns wallet address if authenticated, None otherwise.
    """
    if x_wallet_address:
        # Validate wallet address format (basic Solana address check)
        if len(x_wallet_address) >= 32 and len(x_wallet_address) <= 44:
            return x_wallet_address
    
    if authorization:
        if authorization.startswith("Bearer "):
            wallet = authorization[7:]
            if len(wallet) >= 32 and len(wallet) <= 44:
                return wallet
    
    return None


def require_auth(wallet: Optional[str] = Depends(get_current_wallet)) -> str:
    """
    Dependency that requires authentication.
    Raises 401 if no valid wallet address is provided.
    
    Returns the authenticated wallet address.
    """
    if not wallet:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please connect your wallet.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return wallet


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(
    agent_data: AgentCreate,
    db: AsyncSession = Depends(get_db),
    wallet: str = Depends(require_auth),
):
    """
    Register a new AI agent in the marketplace.
    
    **Authentication required**: Must provide valid wallet address via
    Authorization header (Bearer token) or X-Wallet-Address header.
    """
    # Set the owner wallet from authenticated user
    agent_data.owner_wallet = wallet
    
    existing = await AgentService.get_agent_by_name(db, agent_data.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Agent with name '{agent_data.name}' already exists")
    agent = await AgentService.create_agent(db, agent_data)
    return AgentService.db_to_response(agent)


@router.get("", response_model=AgentListResponse)
async def list_agents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[AgentRole] = Query(None),
    status: Optional[AgentStatus] = Query(None),
    min_success_rate: Optional[float] = Query(None, ge=0, le=1),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List AI agents with filtering and pagination."""
    agents, total = await AgentService.list_agents(
        db, skip=skip, limit=limit, role=role, status=status, 
        min_success_rate=min_success_rate, search=search
    )
    return AgentListResponse(
        items=[AgentService.db_to_list_item(a) for a in agents], 
        total=total, skip=skip, limit=limit
    )


@router.get("/compare", response_model=AgentComparisonResponse)
async def compare_agents(
    agent_ids: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Compare multiple agents side-by-side."""
    try:
        ids = [UUID(id.strip()) for id in agent_ids.split(",")]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid agent ID format: {str(e)}")
    
    if len(ids) < 2 or len(ids) > 3:
        raise HTTPException(status_code=400, detail="Please provide 2-3 agent IDs for comparison")
    
    agents = await AgentService.compare_agents(db, ids)
    
    if len(agents) != len(ids):
        found_ids = {str(a.id) for a in agents}
        missing = [str(id) for id in ids if str(id) not in found_ids]
        raise HTTPException(status_code=404, detail=f"Agents not found: {', '.join(missing)}")
    
    return AgentComparisonResponse(
        agents=[
            AgentComparisonItem(
                id=str(a.id),
                name=a.name,
                display_name=a.display_name,
                role=a.role,
                status=a.status,
                capabilities=a.capabilities,
                performance={
                    "bounties_completed": a.bounties_completed,
                    "bounties_in_progress": a.bounties_in_progress,
                    "success_rate": a.success_rate,
                    "avg_completion_time_hours": a.avg_completion_time_hours,
                    "total_earnings": a.total_earnings,
                    "reputation_score": a.reputation_score,
                },
                pricing_hourly=a.pricing_hourly,
                pricing_fixed=a.pricing_fixed
            ) for a in agents
        ]
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific agent."""
    try:
        uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid agent ID format: {agent_id}")
    
    agent = await AgentService.get_agent_by_id(db, uuid)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    
    return AgentService.db_to_response(agent)


@router.post("/hire", response_model=HireAgentResponse)
async def hire_agent(
    hire_request: HireAgentRequest,
    db: AsyncSession = Depends(get_db),
    wallet: str = Depends(require_auth),
):
    """
    Hire an agent for a bounty.
    
    **Authentication required**: Must provide valid wallet address via
    Authorization header (Bearer token) or X-Wallet-Address header.
    """
    response = await AgentService.hire_agent_for_bounty(db, hire_request)
    if not response.success:
        raise HTTPException(status_code=400, detail=response.message)
    return response