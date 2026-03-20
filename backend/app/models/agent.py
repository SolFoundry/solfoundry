"""Agent database and Pydantic models for AI Agent Marketplace."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, JSON, Float, Integer, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AgentRole(str, Enum):
    """Agent role types."""
    BACKEND = "backend"
    FRONTEND = "frontend"
    SECURITY = "security"
    SMART_CONTRACT = "smart_contract"
    DEVOPS = "devops"
    QA = "qa"
    GENERAL = "general"


class AgentStatus(str, Enum):
    """Agent availability status."""
    AVAILABLE = "available"
    WORKING = "working"
    OFFLINE = "offline"


class AgentDB(Base):
    """Database model for AI Agents."""
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    role = Column(SQLEnum(AgentRole), nullable=False, default=AgentRole.GENERAL)
    status = Column(SQLEnum(AgentStatus), nullable=False, default=AgentStatus.OFFLINE)
    bio = Column(Text, nullable=True)
    capabilities = Column(JSON, default=list, nullable=False)
    specializations = Column(JSON, default=list, nullable=False)
    pricing_hourly = Column(Float, nullable=True)
    pricing_fixed = Column(Float, nullable=True)
    
    # Performance metrics
    bounties_completed = Column(Integer, default=0, nullable=False)
    bounties_in_progress = Column(Integer, default=0, nullable=False)
    success_rate = Column(Float, default=0.0, nullable=False)
    avg_completion_time_hours = Column(Float, default=0.0, nullable=False)
    total_earnings = Column(Float, default=0.0, nullable=False)
    reputation_score = Column(Integer, default=0, nullable=False)
    
    # Links and metadata
    past_work_links = Column(JSON, default=list, nullable=False)
    owner_wallet = Column(String(100), nullable=True)
    sdk_version = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_active_at = Column(DateTime(timezone=True), nullable=True)


# ============================================================================
# Pydantic Models
# ============================================================================

class AgentBase(BaseModel):
    """Base agent model."""
    display_name: str = Field(..., min_length=1, max_length=100)
    avatar_url: Optional[str] = None
    role: AgentRole = AgentRole.GENERAL
    bio: Optional[str] = None
    capabilities: list[str] = []
    specializations: list[str] = []
    pricing_hourly: Optional[float] = None
    pricing_fixed: Optional[float] = None


class AgentCreate(AgentBase):
    """Model for creating a new agent."""
    name: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    owner_wallet: Optional[str] = None
    sdk_version: Optional[str] = None


class AgentUpdate(BaseModel):
    """Model for updating an agent."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None
    role: Optional[AgentRole] = None
    status: Optional[AgentStatus] = None
    bio: Optional[str] = None
    capabilities: Optional[list[str]] = None
    specializations: Optional[list[str]] = None
    pricing_hourly: Optional[float] = None
    pricing_fixed: Optional[float] = None


class AgentPerformanceStats(BaseModel):
    """Agent performance statistics."""
    bounties_completed: int = 0
    bounties_in_progress: int = 0
    success_rate: float = 0.0
    avg_completion_time_hours: float = 0.0
    total_earnings: float = 0.0
    reputation_score: int = 0


class PastWorkItem(BaseModel):
    """Past work item for an agent."""
    title: str
    bounty_id: Optional[str] = None
    pr_url: Optional[str] = None
    completed_at: Optional[datetime] = None
    reward: Optional[float] = None


class AgentResponse(AgentBase):
    """Full agent response with all details."""
    id: str
    name: str
    status: AgentStatus
    performance: AgentPerformanceStats
    past_work: list[PastWorkItem] = []
    owner_wallet: Optional[str] = None
    sdk_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_active_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class AgentListItem(BaseModel):
    """Agent list item for marketplace grid view."""
    id: str
    name: str
    display_name: str
    avatar_url: Optional[str] = None
    role: AgentRole
    status: AgentStatus
    bio: Optional[str] = None
    capabilities: list[str] = []
    performance: AgentPerformanceStats
    pricing_hourly: Optional[float] = None
    pricing_fixed: Optional[float] = None
    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    """Paginated list of agents."""
    items: list[AgentListItem]
    total: int
    skip: int
    limit: int


class AgentComparisonItem(BaseModel):
    """Agent comparison data."""
    id: str
    name: str
    display_name: str
    role: AgentRole
    status: AgentStatus
    capabilities: list[str]
    performance: AgentPerformanceStats
    pricing_hourly: Optional[float] = None
    pricing_fixed: Optional[float] = None


class AgentComparisonResponse(BaseModel):
    """Response for agent comparison."""
    agents: list[AgentComparisonItem]


class HireAgentRequest(BaseModel):
    """Request to hire an agent for a bounty."""
    agent_id: str
    bounty_id: str


class HireAgentResponse(BaseModel):
    """Response after hiring an agent."""
    success: bool
    message: str
    assignment_id: Optional[str] = None