"""
FastAPI routes for the AI Bounty Description Enhancer.
"""

import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .enhancer import BountyEnhancer
from .models import EnhancementStatus, LLMProvider


router = APIRouter(prefix="/api/v1/enhance", tags=["bounty-enhancement"])


def _get_api_keys() -> dict[LLMProvider, str]:
    """Load API keys from environment variables."""
    return {
        LLMProvider.CLAUDE: os.getenv("CLAUDE_API_KEY", ""),
        LLMProvider.GPT: os.getenv("OPENAI_API_KEY", ""),
        LLMProvider.GEMINI: os.getenv("GEMINI_API_KEY", ""),
        LLMProvider.DEEPSEEK: os.getenv("DEEPSEEK_API_KEY", ""),
    }


def _get_enhancer() -> BountyEnhancer:
    """Get or create the singleton BountyEnhancer instance."""
    if not hasattr(_get_enhancer, "_instance"):
        _get_enhancer._instance = BountyEnhancer(_get_api_keys())
    return _get_enhancer._instance


# ── Request/Response Models ─────────────────────────────────────────────────


class BountyInputRequest(BaseModel):
    """API request body for bounty input."""
    title: str = Field(..., min_length=3, description="Bounty title")
    description: str = Field(..., min_length=10, description="Bounty description")
    tags: list[str] = Field(default_factory=list)
    repository: Optional[str] = None
    issue_number: Optional[int] = None


class EnhanceRequest(BaseModel):
    """API request to enhance a bounty."""
    bounty: BountyInputRequest
    providers: list[str] = Field(
        default=["claude", "gpt", "gemini"],
        description="LLM providers to use",
    )
    min_confidence: float = Field(default=0.7, ge=0.0, le=1.0)
    auto_approve: bool = Field(default=False)


class ApprovalRequestAPI(BaseModel):
    """API request to approve/reject an enhancement."""
    bounty_id: str
    approved: bool
    reviewer: str = Field(..., min_length=1)
    notes: Optional[str] = None
    modifications: Optional[dict] = None


class SuggestionResponse(BaseModel):
    """Response for a single LLM suggestion."""
    provider: str
    enhanced_title: str
    enhanced_description: str
    requirements: list[str]
    acceptance_criteria: list[str]
    examples: list[str]
    confidence_score: float
    reasoning: str
    processing_time_ms: float


class EnhancementResponse(BaseModel):
    """Response for an enhancement result."""
    bounty_id: str
    original_title: str
    original_description: str
    final_title: str
    final_description: str
    final_requirements: list[str]
    final_acceptance_criteria: list[str]
    final_examples: list[str]
    status: str
    suggestions: list[SuggestionResponse]


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/bounty", response_model=EnhancementResponse)
async def enhance_bounty(request: EnhanceRequest):
    """Enhance a bounty description using multi-LLM analysis.

    Analyzes the input bounty across multiple AI providers and returns
    an improved version with clearer requirements and acceptance criteria.
    """
    from .models import BountyInput, EnhancementRequest

    # Parse providers
    try:
        providers = [LLMProvider(p) for p in request.providers]
    except ValueError as e:
        raise HTTPException(400, f"Invalid provider: {e}")

    bounty = BountyInput(
        title=request.bounty.title,
        description=request.bounty.description,
        tags=request.bounty.tags,
        repository=request.bounty.repository,
        issue_number=request.bounty.issue_number,
    )

    enhancement_req = EnhancementRequest(
        bounty=bounty,
        providers=providers,
        min_confidence=request.min_confidence,
        auto_approve=request.auto_approve,
    )

    try:
        enhancer = _get_enhancer()
        result = await enhancer.enhance(enhancement_req)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Enhancement failed: {e}")

    return EnhancementResponse(
        bounty_id=result.bounty_id,
        original_title=result.original.title,
        original_description=result.original.description,
        final_title=result.final_title,
        final_description=result.final_description,
        final_requirements=result.final_requirements,
        final_acceptance_criteria=result.final_acceptance_criteria,
        final_examples=result.final_examples,
        status=result.status.value,
        suggestions=[
            SuggestionResponse(
                provider=s.provider.value,
                enhanced_title=s.enhanced_title,
                enhanced_description=s.enhanced_description,
                requirements=s.requirements,
                acceptance_criteria=s.acceptance_criteria,
                examples=s.examples,
                confidence_score=s.confidence_score,
                reasoning=s.reasoning,
                processing_time_ms=s.processing_time_ms,
            )
            for s in result.suggestions
        ],
    )


@router.post("/approve")
async def approve_enhancement(request: ApprovalRequestAPI):
    """Approve or reject an enhancement.

    Maintainer workflow: review the enhanced description and either approve
    for publishing or reject with feedback.
    """
    from .models import ApprovalRequest

    enhancer = _get_enhancer()

    try:
        approval = ApprovalRequest(
            bounty_id=request.bounty_id,
            approved=request.approved,
            reviewer=request.reviewer,
            notes=request.notes,
            modifications=request.modifications,
        )
        result = enhancer.review(approval)
    except KeyError:
        raise HTTPException(404, f"Bounty {request.bounty_id} not found")
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {
        "bounty_id": result.bounty_id,
        "status": result.status.value,
        "reviewed_at": result.reviewed_at.isoformat() if result.reviewed_at else None,
        "reviewer": result.reviewer,
        "final_title": result.final_title,
        "final_description": result.final_description,
    }


@router.get("/pending")
async def list_pending():
    """List all enhancements awaiting maintainer review."""
    enhancer = _get_enhancer()
    pending = enhancer.list_pending()
    return {
        "count": len(pending),
        "items": [
            {
                "bounty_id": r.bounty_id,
                "original_title": r.original.title,
                "final_title": r.final_title,
                "suggestions_count": len(r.suggestions),
                "created_at": r.created_at.isoformat(),
            }
            for r in pending
        ],
    }


@router.get("/result/{bounty_id}")
async def get_result(bounty_id: str):
    """Get enhancement result by ID."""
    enhancer = _get_enhancer()
    result = enhancer.get_result(bounty_id)
    if result is None:
        raise HTTPException(404, f"Bounty {bounty_id} not found")

    return {
        "bounty_id": result.bounty_id,
        "status": result.status.value,
        "original": {
            "title": result.original.title,
            "description": result.original.description,
        },
        "enhanced": {
            "title": result.final_title,
            "description": result.final_description,
            "requirements": result.final_requirements,
            "acceptance_criteria": result.final_acceptance_criteria,
            "examples": result.final_examples,
        },
        "suggestions_count": len(result.suggestions),
    }
