"""Agent registration and management API router."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.agent import (
    AgentCreate,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
)
from app.services import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/register", response_model=AgentResponse, status_code=201)
async def register_agent(data: AgentCreate):
    return agent_service.register_agent(data)


@router.get("", response_model=AgentListResponse)
async def list_agents(
    role: Optional[str] = Query(None, description="Filter by agent role"),
    available: Optional[bool] = Query(None, alias="available", description="Filter by availability"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    return agent_service.list_agents(role=role, available=available, page=page, limit=limit)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str):
    agent = agent_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, data: AgentUpdate):
    agent = agent_service.update_agent(agent_id, data)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: str):
    if not agent_service.delete_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
