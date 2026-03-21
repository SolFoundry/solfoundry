"""Agent model for the Agent Marketplace.

This module defines the Agent SQLAlchemy model and Pydantic schemas
for the Agent Registration API (Issue #203).

Agent roles match SolFoundry's agent types:
- backend-engineer
- frontend-engineer
- scraping-engineer
- bot-engineer
- ai-engineer
- security-analyst
- systems-engineer
- devops-engineer
- smart-contract-engineer
"""

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, Boolean, Text, JSON, UUID

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class AgentRole(str, Enum):
    """Valid agent roles in the SolFoundry marketplace."""

    BACKEND_ENGINEER = "backend-engineer"
    FRONTEND_ENGINEER = "frontend-engineer"
    SCRAPING_ENGINEER = "scraping-engineer"
    BOT_ENGINEER = "bot-engineer"
    AI_ENGINEER = "ai-engineer"
    SECURITY_ANALYST = "security-analyst"
    SYSTEMS_ENGINEER = "systems-engineer"
    DEVOPS_ENGINEER = "devops-engineer"
    SMART_CONTRACT_ENGINEER = "smart-contract-engineer"


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------

NAME_MIN_LENGTH = 1
NAME_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 2000
MAX_CAPABILITIES = 50
MAX_LANGUAGES = 20
MAX_APIS = 30
WALLET_ADDRESS_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


# ---------------------------------------------------------------------------
# SQLAlchemy Model
# ---------------------------------------------------------------------------


class Agent(Base):
    """SQLAlchemy model for Agent table.

    Attributes:
        id: UUID primary key
        name: Agent display name
        description: Agent description
        role: Agent role type
        capabilities: List of agent capabilities (JSON array)
        languages: List of programming languages (JSON array)
        apis: List of APIs the agent can work with (JSON array)
        operator_wallet: Solana wallet address of the operator
        is_active: Whether the agent is active
        availability: Agent availability status
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(NAME_MAX_LENGTH), nullable=False)
    description = Column(Text, nullable=True)
    role = Column(String(64), nullable=False, index=True)
    capabilities = Column(JSON, nullable=False, default=list)
    languages = Column(JSON, nullable=False, default=list)
    apis = Column(JSON, nullable=False, default=list)
    operator_wallet = Column(String(64), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    availability = Column(String(32), default="available", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------


def _validate_wallet_address(v: str) -> str:
    """Validate Solana wallet address format."""
    if not WALLET_ADDRESS_PATTERN.match(v):
        raise ValueError(
            "Invalid Solana wallet address format. "
            "Must be a valid base58 encoded address (32-44 characters)."
        )
    return v


def _validate_list_items(
    items: list[str], max_items: int, field_name: str
) -> list[str]:
    """Validate and normalize a list of strings."""
    if len(items) > max_items:
        raise ValueError(f"Too many {field_name} (max {max_items})")
    # Normalize: strip whitespace, remove empty, lowercase
    normalized = [item.strip().lower() for item in items if item and item.strip()]
    return normalized


class AgentCreate(BaseModel):
    """Payload for registering a new agent."""

    name: str = Field(..., min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH, description="Agent display name", examples=["RustBot 3000"])
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX_LENGTH, description="Detailed agent profile and expertise", examples=["Expert Rust and Anchor developer with 5+ years experience."])
    role: AgentRole = Field(..., description="The primary role of the agent", examples=[AgentRole.SMART_CONTRACT_ENGINEER])
    capabilities: list[str] = Field(
        default_factory=list, description="List of technical capabilities", examples=[["Anchor", "Security Audit", "Performance Optimization"]]
    )
    languages: list[str] = Field(
        default_factory=list, description="Programming languages supported", examples=[["rust", "typescript", "c++"]]
    )
    apis: list[str] = Field(
        default_factory=list, description="Supported APIs or protocols", examples=[["solana-rpc", "metaplex", "jupiter"]]
    )
    operator_wallet: str = Field(
        ..., min_length=32, max_length=64, description="Solana wallet address for ownership and payouts", examples=["7Pq6..."]
    )

    @field_validator("operator_wallet")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        """Validate wallet."""
        return _validate_wallet_address(v)

    @field_validator("capabilities")
    @classmethod
    def validate_capabilities(cls, v: list[str]) -> list[str]:
        """Validate capabilities."""
        return _validate_list_items(v, MAX_CAPABILITIES, "capabilities")

    @field_validator("languages")
    @classmethod
    def validate_languages(cls, v: list[str]) -> list[str]:
        """Validate languages."""
        return _validate_list_items(v, MAX_LANGUAGES, "languages")

    @field_validator("apis")
    @classmethod
    def validate_apis(cls, v: list[str]) -> list[str]:
        """Validate apis."""
        return _validate_list_items(v, MAX_APIS, "apis")


class AgentUpdate(BaseModel):
    """Payload for partially updating an agent (PATCH semantics)."""

    name: Optional[str] = Field(
        None, min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH
    )
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX_LENGTH)
    role: Optional[AgentRole] = None
    capabilities: Optional[list[str]] = None
    languages: Optional[list[str]] = None
    apis: Optional[list[str]] = None
    availability: Optional[str] = Field(None, max_length=32)

    @field_validator("capabilities")
    @classmethod
    def validate_capabilities(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """Validate capabilities."""
        if v is None:
            return v
        return _validate_list_items(v, MAX_CAPABILITIES, "capabilities")

    @field_validator("languages")
    @classmethod
    def validate_languages(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """Validate languages."""
        if v is None:
            return v
        return _validate_list_items(v, MAX_LANGUAGES, "languages")

    @field_validator("apis")
    @classmethod
    def validate_apis(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """Validate apis."""
        if v is None:
            return v
        return _validate_list_items(v, MAX_APIS, "apis")


class AgentResponse(BaseModel):
    """Full agent detail returned by GET /agents/{id} and mutations."""

    id: str = Field(..., description="Unique UUID for the agent", examples=["550e8400-e29b-41d4-a716-446655440000"])
    name: str = Field(..., description="Agent display name")
    description: Optional[str] = None
    role: str = Field(..., description="Agent role type")
    capabilities: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    apis: list[str] = Field(default_factory=list)
    operator_wallet: str = Field(..., description="Solana wallet address of the operator")
    is_active: bool = Field(True, description="Whether the agent is currently active in the marketplace")
    availability: str = Field("available", description="Current availability status")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentListItem(BaseModel):
    """Compact agent representation for list endpoints."""

    id: str
    name: str
    role: str
    capabilities: list[str] = Field(default_factory=list)
    is_active: bool = True
    availability: str = "available"
    operator_wallet: str
    created_at: datetime


class AgentListResponse(BaseModel):
    """Paginated list of agents."""

    items: list[AgentListItem]
    total: int
    page: int
    limit: int
