"""
Data models for bounty description enhancement.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class EnhancementStatus(Enum):
    """Status of a bounty enhancement request."""
    PENDING = "pending"
    ANALYZING = "analyzing"
    ENHANCED = "enhanced"
    APPROVED = "approved"
    REJECTED = "rejected"


class LLMProvider(Enum):
    """Supported LLM providers."""
    CLAUDE = "claude"
    GPT = "gpt"  # Codex/GPT series
    GEMINI = "gemini"
    DEEPSEEK = "deepseek"


@dataclass
class BountyInput:
    """Input bounty description to be enhanced."""
    title: str
    description: str
    tags: list[str] = field(default_factory=list)
    repository: Optional[str] = None
    issue_number: Optional[int] = None


@dataclass
class LLMSuggestion:
    """A single LLM's enhancement suggestion."""
    provider: LLMProvider
    enhanced_title: str
    enhanced_description: str
    requirements: list[str]
    acceptance_criteria: list[str]
    examples: list[str]
    confidence_score: float  # 0.0 - 1.0
    reasoning: str
    processing_time_ms: float


@dataclass
class EnhancementResult:
    """Aggregated enhancement result from multiple LLMs."""
    bounty_id: str
    original: BountyInput
    suggestions: list[LLMSuggestion]
    final_title: str
    final_description: str
    final_requirements: list[str]
    final_acceptance_criteria: list[str]
    final_examples: list[str]
    status: EnhancementStatus
    created_at: datetime = field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    reviewer: Optional[str] = None
    review_notes: Optional[str] = None


@dataclass
class EnhancementRequest:
    """Request to enhance a bounty description."""
    bounty: BountyInput
    providers: list[LLMProvider] = field(default_factory=lambda: [
        LLMProvider.CLAUDE,
        LLMProvider.GPT,
        LLMProvider.GEMINI
    ])
    min_confidence: float = 0.7
    auto_approve: bool = False


@dataclass
class ApprovalRequest:
    """Request to approve/reject an enhancement."""
    bounty_id: str
    approved: bool
    reviewer: str
    notes: Optional[str] = None
    modifications: Optional[dict] = None  # Manual tweaks to the enhancement
