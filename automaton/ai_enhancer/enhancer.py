"""AI Bounty Description Enhancer - main logic."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from .providers.base import LLMProvider
from .providers.openai_provider import OpenAIProvider
from .providers.anthropic_provider import AnthropicProvider
from .providers.google_provider import GoogleProvider
from .prompt_templates import build_system_prompt, build_user_prompt

logger = logging.getLogger(__name__)

# Provider fallback order
DEFAULT_PROVIDER_ORDER: list[type[LLMProvider]] = [
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
]


@dataclass
class EnhancedBounty:
    """Result of an AI enhancement pass."""

    bounty_id: str
    original_title: str
    original_description: str
    enhanced_title: Optional[str] = None
    enhanced_description: Optional[str] = None
    clearer_requirements: list[str] = field(default_factory=list)
    acceptance_criteria: list[str] = field(default_factory=list)
    code_examples: list[str] = field(default_factory=list)
    estimated_complexity: Optional[str] = None
    estimated_timeline: Optional[str] = None
    required_skills: list[str] = field(default_factory=list)
    provider_used: Optional[str] = None
    status: str = "pending"  # pending | approved | rejected
    error: Optional[str] = None


class BountyEnhancer:
    """Enhances bounty descriptions using multi-LLM analysis."""

    def __init__(
        self,
        providers: Optional[list[LLMProvider]] = None,
        provider_order: Optional[list[type[LLMProvider]]] = None,
    ) -> None:
        self.provider_order = provider_order or DEFAULT_PROVIDER_ORDER
        self._providers: list[LLMProvider] = providers or [cls() for cls in self.provider_order]

    async def enhance_description(self, bounty: dict[str, Any]) -> EnhancedBounty:
        """Enhance a bounty description using multi-LLM with fallback."""
        bounty_id = str(bounty.get("id", "unknown"))
        result = EnhancedBounty(
            bounty_id=bounty_id,
            original_title=bounty.get("title", ""),
            original_description=bounty.get("description", ""),
        )

        system_prompt = build_system_prompt()
        user_prompt = build_user_prompt(bounty)

        last_error: Optional[Exception] = None
        for provider in self._providers:
            try:
                logger.info("Attempting enhancement with %s", provider.name)
                raw = await asyncio.wait_for(
                    provider.enhance(system_prompt, user_prompt, bounty),
                    timeout=60,
                )
                self._merge_raw(result, raw, provider.name)
                return result
            except Exception as exc:
                logger.warning("Provider %s failed: %s", provider.name, exc)
                last_error = exc
                continue

        result.error = f"All providers failed. Last: {last_error}"
        result.status = "error"
        return result

    # ------------------------------------------------------------------
    @staticmethod
    def _merge_raw(result: EnhancedBounty, raw: dict, provider_name: str) -> None:
        result.enhanced_title = raw.get("enhanced_title")
        result.enhanced_description = raw.get("enhanced_description")
        result.clearer_requirements = raw.get("clearer_requirements", [])
        result.acceptance_criteria = raw.get("acceptance_criteria", [])
        result.code_examples = raw.get("code_examples", [])
        result.estimated_complexity = raw.get("estimated_complexity")
        result.estimated_timeline = raw.get("estimated_timeline")
        result.required_skills = raw.get("required_skills", [])
        result.provider_used = provider_name
