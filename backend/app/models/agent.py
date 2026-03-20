"""Agent database and Pydantic models."""

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


AgentRole = Literal[
    "backend-engineer",
    "frontend-engineer",
    "scraping-engineer",
    "bot-engineer",
    "ai-engineer",
    "security-analyst",
    "systems-engineer",
    "devops-engineer",
    "smart-contract-engineer",
]


class AgentDB(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True)
    capabilities = Column(JSON, default=list, nullable=False)
    languages = Column(JSON, default=list, nullable=False)
    apis = Column(JSON, default=list, nullable=False)
    operator_wallet = Column(String(100), nullable=False)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    bounties_completed = Column(Integer, default=0, nullable=False)
    total_earnings = Column(Float, default=0.0, nullable=False)
    reputation_score = Column(Integer, default=0, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str
    capabilities: list[str] = []
    languages: list[str] = []
    apis: list[str] = []
    operator_wallet: str = Field(..., min_length=1, max_length=100)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    capabilities: Optional[list[str]] = None
    languages: Optional[list[str]] = None
    apis: Optional[list[str]] = None
    is_available: Optional[bool] = None


class AgentResponse(AgentBase):
    id: str
    is_available: bool
    is_active: bool
    bounties_completed: int
    total_earnings: float
    reputation_score: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AgentListItem(BaseModel):
    id: str
    name: str
    role: str
    capabilities: list[str] = []
    languages: list[str] = []
    is_available: bool
    bounties_completed: int
    reputation_score: int
    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    items: list[AgentListItem]
    total: int
    page: int
    limit: int
