"""Pydantic models for the AI Bounty Description Enhancer (Issue #848).

Defines the request/response schemas for:
- Triggering AI-powered description enhancement
- Viewing enhancement history
- Approving/rejecting enhancements
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class EnhancementStatus(str, Enum):
    """Lifecycle status of a bounty description enhancement."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LLMProvider(str, Enum):
    """Supported LLM providers for description enhancement."""

    CLAUDE = "claude"
    CODEX = "codex"
    GEMINI = "gemini"


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class EnhanceRequest(BaseModel):
    """Payload for requesting an AI-powered bounty description enhancement.

    The enhancer will analyze the current description and generate improved
    versions with clearer requirements, acceptance criteria, and examples.
    """

    providers: list[LLMProvider] = Field(
        default_factory=lambda: [LLMProvider.CLAUDE, LLMProvider.CODEX, LLMProvider.GEMINI],
        description="List of LLM providers to use for enhancement",
        max_length=5,
    )
    custom_prompt: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional custom instructions for the enhancement prompt",
    )


class EnhanceApproval(BaseModel):
    """Payload for approving or rejecting an enhancement result."""

    action: str = Field(
        ...,
        pattern=r"^(approve|reject)$",
        description="'approve' to accept the enhancement and update the bounty description, or 'reject' to decline",
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class LLMEnhancementResult(BaseModel):
    """Enhancement result from a single LLM provider."""

    provider: LLMProvider
    enhanced_title: str = Field(
        ..., max_length=200, description="The provider's suggested improved title"
    )
    enhanced_description: str = Field(
        ...,
        max_length=5000,
        description="The provider's suggested improved description with structured sections",
    )
    changes_summary: str = Field(
        ...,
        max_length=500,
        description="Brief summary of what was improved (e.g., 'Added acceptance criteria, clarified requirements, added examples')",
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Provider's confidence in the enhancement quality (0.0 to 1.0)",
    )
    error: Optional[str] = Field(
        None,
        description="Error message if the provider failed to generate an enhancement",
    )


class EnhancementRecord(BaseModel):
    """A single bounty description enhancement record."""

    id: str = Field(
        ..., description="Unique identifier for this enhancement record"
    )
    bounty_id: str = Field(
        ..., description="The bounty ID this enhancement belongs to"
    )
    original_title: str = Field(
        ..., max_length=200, description="The original bounty title before enhancement"
    )
    original_description: str = Field(
        ...,
        max_length=5000,
        description="The original bounty description before enhancement",
    )
    results: list[LLMEnhancementResult] = Field(
        default_factory=list,
        description="Enhancement results from each LLM provider",
    )
    selected_result: Optional[LLMEnhancementResult] = Field(
        None,
        description="The enhancement result that was approved (if any)",
    )
    status: EnhancementStatus = Field(
        default=EnhancementStatus.PENDING,
        description="Current status of this enhancement request",
    )
    created_by: str = Field(
        ..., description="User or agent that triggered the enhancement"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the enhancement was requested",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When the enhancement was last updated",
    )


class EnhanceResponse(BaseModel):
    """Response after triggering a bounty description enhancement."""

    enhancement_id: str = Field(
        ..., description="ID of the created enhancement record"
    )
    bounty_id: str = Field(
        ..., description="The bounty ID that was enhanced"
    )
    results: list[LLMEnhancementResult] = Field(
        ...,
        description="Enhancement results from each requested LLM provider",
    )
    status: EnhancementStatus = Field(
        ..., description="Current status of this enhancement request"
    )
    created_at: datetime = Field(
        ..., description="When the enhancement was requested"
    )
    message: str = Field(
        ...,
        description="Human-readable summary of what happened",
    )


class EnhancementListResponse(BaseModel):
    """Paginated list of enhancement records for a bounty."""

    items: list[EnhancementRecord]
    total: int
    bounty_id: str