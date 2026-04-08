"""OpenAI GPT-4 provider."""

from __future__ import annotations

import json
import os
from typing import Any

from .base import LLMProvider

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None  # type: ignore[assignment,misc]

ENHANCEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "enhanced_title": {"type": "string"},
        "enhanced_description": {"type": "string"},
        "clearer_requirements": {"type": "array", "items": {"type": "string"}},
        "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
        "code_examples": {"type": "array", "items": {"type": "string"}},
        "estimated_complexity": {"type": "string"},
        "estimated_timeline": {"type": "string"},
        "required_skills": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["enhanced_description", "clearer_requirements", "acceptance_criteria"],
}


class OpenAIProvider(LLMProvider):
    """OpenAI GPT-4 based enhancement provider."""

    def __init__(self, model: str = "gpt-4o", api_key: str | None = None) -> None:
        if AsyncOpenAI is None:
            raise ImportError("openai package is required: pip install openai")
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    @property
    def name(self) -> str:
        return f"openai/{self.model}"

    async def enhance(self, system_prompt: str, user_prompt: str, bounty: dict[str, Any]) -> dict:
        response = await self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        text = response.choices[0].message.content or "{}"
        return json.loads(text)
