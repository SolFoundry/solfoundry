"""Google Gemini provider."""

from __future__ import annotations

import json
import os
from typing import Any

from .base import LLMProvider

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover
    genai = None  # type: ignore[assignment]


class GoogleProvider(LLMProvider):
    """Google Gemini-based enhancement provider."""

    def __init__(self, model: str = "gemini-2.0-flash", api_key: str | None = None) -> None:
        if genai is None:
            raise ImportError("google-generativeai package is required")
        self.model_name = model
        genai.configure(api_key=api_key or os.getenv("GOOGLE_API_KEY"))
        self._model = genai.GenerativeModel(model)

    @property
    def name(self) -> str:
        return f"google/{self.model_name}"

    async def enhance(self, system_prompt: str, user_prompt: str, bounty: dict[str, Any]) -> dict:
        prompt = f"{system_prompt}\n\n{user_prompt}"
        response = await self._model.generate_content_async(prompt)
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
