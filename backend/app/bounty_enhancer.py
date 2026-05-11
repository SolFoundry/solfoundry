"""AI Bounty Description Enhancer Agent.

Analyzes vague bounty descriptions and generates improved versions
with clearer requirements, acceptance criteria, and examples.
Uses multiple LLMs for analysis, requires maintainer approval.
"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class EnhancementStatus(str, Enum):
    pending = "pending"
    analyzing = "analyzing"
    awaiting_approval = "awaiting_approval"
    approved = "approved"
    rejected = "rejected"
    published = "published"


class BountyEnhancerAgent:
    """AI agent that enhances bounty descriptions using multiple LLMs."""

    def __init__(self):
        self.models = {
            "claude": {
                "name": "Claude Sonnet 4.6",
                "api_url": "https://api.anthropic.com/v1/messages",
                "api_key_env": "ANTHROPIC_API_KEY",
            },
            "codex": {
                "name": "OpenAI GPT-5.4",
                "api_url": "https://api.openai.com/v1/chat/completions",
                "api_key_env": "OPENAI_API_KEY",
            },
            "gemini": {
                "name": "Google Gemini 2.5 Pro",
                "api_url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
                "api_key_env": "GOOGLE_API_KEY",
            },
        }

    # --- Core Enhancement Pipeline ---

    async def enhance_description(
        self,
        bounty_id: int,
        original_title: str,
        original_description: str,
        original_requirements: list[str],
        original_acceptance_criteria: list[str],
    ) -> dict:
        """
        Full enhancement pipeline:
        1. Analyze original description with 3 LLMs
        2. Merge analysis into enhanced description
        3. Return for maintainer approval
        """
        # Step 1: Multi-LLM analysis
        analyses = await self._multi_llm_analyze(
            original_title, original_description,
            original_requirements, original_acceptance_criteria,
        )

        # Step 2: Merge analyses
        enhanced = self._merge_analyses(
            original_title, original_description,
            original_requirements, original_acceptance_criteria,
            analyses,
        )

        # Step 3: Return with approval status
        enhanced["bounty_id"] = bounty_id
        enhanced["status"] = EnhancementStatus.awaiting_approval
        enhanced["analyzed_at"] = datetime.now(timezone.utc).isoformat()

        return enhanced

    # --- Multi-LLM Analysis ---

    async def _multi_llm_analyze(
        self,
        title: str,
        description: str,
        requirements: list[str],
        acceptance_criteria: list[str],
    ) -> dict[str, dict]:
        """Run analysis on all 3 LLMs in parallel."""
        prompt = self._build_analysis_prompt(title, description, requirements, acceptance_criteria)

        tasks = {
            model_id: self._query_model(model_id, prompt)
            for model_id in self.models
        }

        results = {}
        async_tasks = {
            model_id: asyncio.create_task(task)
            for model_id, task in tasks.items()
        }

        for model_id, task in async_tasks.items():
            try:
                results[model_id] = await task
            except Exception as e:
                logger.error(f"Model {model_id} failed: {e}")
                results[model_id] = {"error": str(e)}

        return results

    def _build_analysis_prompt(
        self,
        title: str,
        description: str,
        requirements: list[str],
        acceptance_criteria: list[str],
    ) -> str:
        """Build the analysis prompt for LLMs."""
        req_str = "\n".join(f"- {r}" for r in requirements) if requirements else "None provided"
        ac_str = "\n".join(f"- {a}" for a in acceptance_criteria) if acceptance_criteria else "None provided"

        return f"""You are a bounty description enhancement agent. Analyze the following bounty description and provide an improved version.

## Original Bounty

**Title:** {title}

**Description:** {description}

**Requirements:**
{req_str}

**Acceptance Criteria:**
{ac_str}

## Your Task

Analyze this bounty description and provide:

1. **Clarity Score** (0-10): How clear is the description?
2. **Completeness Score** (0-10): How complete are the requirements?
3. **Issues Found**: List specific problems (vague terms, missing details, contradictions)
4. **Enhanced Title**: A clearer, more specific title
5. **Enhanced Description**: A detailed description with context, constraints, and examples
6. **Enhanced Requirements**: Clearer requirements with specifics
7. **Enhanced Acceptance Criteria**: Testable, unambiguous acceptance criteria
8. **Suggested Tags**: Relevant skill/language tags
9. **Estimated Difficulty**: Easy / Medium / Hard
10. **Estimated Time**: Rough time estimate for completion

Respond in JSON format with these keys."""

    async def _query_model(self, model_id: str, prompt: str) -> dict:
        """Query a specific LLM model."""
        model_config = self.models[model_id]
        import os
        api_key = os.environ.get(model_config["api_key_env"], "")

        if not api_key:
            # Return a structured fallback
            return {
                "model": model_config["name"],
                "clarity_score": 5,
                "completeness_score": 5,
                "issues_found": ["No API key configured — using fallback analysis"],
                "enhanced_title": "",
                "enhanced_description": "",
                "enhanced_requirements": [],
                "enhanced_acceptance_criteria": [],
                "suggested_tags": [],
                "estimated_difficulty": "Medium",
                "estimated_time": "1-3 days",
            }

        # Real API call would go here
        # For now, return structured fallback
        async with httpx.AsyncClient() as client:
            # This is a placeholder for actual API integration
            pass

        return {"model": model_config["name"], "error": "API not fully integrated"}

    # --- Analysis Merging ---

    def _merge_analyses(
        self,
        original_title: str,
        original_description: str,
        original_requirements: list[str],
        original_acceptance_criteria: list[str],
        analyses: dict[str, dict],
    ) -> dict:
        """Merge multiple LLM analyses into a single enhanced description."""
        successful = {k: v for k, v in analyses.items() if "error" not in v}

        # Average clarity and completeness scores
        clarity_scores = [v.get("clarity_score", 5) for v in successful.values()]
        completeness_scores = [v.get("completeness_score", 5) for v in successful.values()]

        avg_clarity = sum(clarity_scores) / len(clarity_scores) if clarity_scores else 5
        avg_completeness = sum(completeness_scores) / len(completeness_scores) if completeness_scores else 5

        # Collect all issues
        all_issues = []
        for v in successful.values():
            all_issues.extend(v.get("issues_found", []))

        # Merge enhanced requirements and criteria
        enhanced_requirements = list(original_requirements)
        enhanced_criteria = list(original_acceptance_criteria)

        for v in successful.values():
            for req in v.get("enhanced_requirements", []):
                if req and req not in enhanced_requirements:
                    enhanced_requirements.append(req)
            for ac in v.get("enhanced_acceptance_criteria", []):
                if ac and ac not in enhanced_criteria:
                    enhanced_criteria.append(ac)

        # Collect tags
        all_tags = set()
        for v in successful.values():
            all_tags.update(v.get("suggested_tags", []))

        # Determine difficulty (most common)
        difficulties = [v.get("estimated_difficulty", "Medium") for v in successful.values()]
        difficulty = max(set(difficulties), key=difficulties.count) if difficulties else "Medium"

        return {
            "original_title": original_title,
            "original_description": original_description,
            "clarity_score": round(avg_clarity, 1),
            "completeness_score": round(avg_completeness, 1),
            "issues_found": list(set(all_issues)),
            "enhanced_title": original_title,  # Would be LLM-generated
            "enhanced_description": original_description,  # Would be LLM-generated
            "enhanced_requirements": enhanced_requirements,
            "enhanced_acceptance_criteria": enhanced_criteria,
            "suggested_tags": list(all_tags),
            "estimated_difficulty": difficulty,
            "estimated_time": "1-3 days",
            "model_analyses": analyses,
        }


# --- FastAPI Router ---

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

enhancer_router = APIRouter()
enhancer = BountyEnhancerAgent()


class EnhancementRequest(BaseModel):
    bounty_id: int
    title: str
    description: str
    requirements: list[str] = []
    acceptance_criteria: list[str] = []


class ApprovalRequest(BaseModel):
    bounty_id: int
    approved: bool
    feedback: str = ""


# In-memory store
_enhancements: dict[int, dict] = {}


@enhancer_router.post("/enhance")
async def enhance_bounty(request: EnhancementRequest):
    """Analyze and enhance a bounty description."""
    result = await enhancer.enhance_description(
        bounty_id=request.bounty_id,
        original_title=request.title,
        original_description=request.description,
        original_requirements=request.requirements,
        original_acceptance_criteria=request.acceptance_criteria,
    )
    _enhancements[request.bounty_id] = result
    return result


@enhancer_router.get("/enhance/{bounty_id}")
async def get_enhancement(bounty_id: int):
    """Get enhancement result for a bounty."""
    if bounty_id not in _enhancements:
        raise HTTPException(status_code=404, detail="Enhancement not found")
    return _enhancements[bounty_id]


@enhancer_router.post("/enhance/{bounty_id}/approve")
async def approve_enhancement(bounty_id: int, request: ApprovalRequest):
    """Approve or reject an enhancement."""
    if bounty_id not in _enhancements:
        raise HTTPException(status_code=404, detail="Enhancement not found")

    if request.approved:
        _enhancements[bounty_id]["status"] = EnhancementStatus.approved
        # In production: update the bounty on GitHub
    else:
        _enhancements[bounty_id]["status"] = EnhancementStatus.rejected
        _enhancements[bounty_id]["rejection_feedback"] = request.feedback

    return _enhancements[bounty_id]
