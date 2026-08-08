"""OpenAI / Codex LLM reviewer."""

import os
from typing import Optional

from ..models import DiffFile, Finding, ReviewConfig
from .base import LLMReviewer


class OpenAIReviewer(LLMReviewer):
    """Reviews PR diffs using OpenAI (Codex / GPT)."""

    name = "openai"

    def __init__(self, config: ReviewConfig, api_key: Optional[str] = None):
        super().__init__(config)
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")

    async def review(self, files: list[DiffFile], instructions: Optional[str] = None) -> tuple[float, list[Finding]]:
        if not self.api_key:
            return self._fallback(files)
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.api_key)
            prompt = self._build_prompt(files, instructions)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a senior code reviewer. Return only JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
            )
            raw = resp.choices[0].message.content or ""
            findings = self._parse_findings(raw)
            score = self._score(raw)
            if not findings:
                score = self._fallback_score(files)
            return score, findings
        except Exception:
            return self._fallback(files)

    def _fallback(self, files: list[DiffFile]) -> tuple[float, list[Finding]]:
        from ..analyzers import SecurityAnalyzer, PerformanceAnalyzer, BestPracticesAnalyzer
        findings = []
        findings += SecurityAnalyzer().analyze(files)
        findings += PerformanceAnalyzer().analyze(files)
        findings += BestPracticesAnalyzer().analyze(files)
        return self._fallback_score(files), findings

    @staticmethod
    def _fallback_score(files: list[DiffFile]) -> float:
        from ..analyzers import SecurityAnalyzer, PerformanceAnalyzer, BestPracticesAnalyzer
        weights = {"critical": -2.0, "high": -1.0, "medium": -0.5, "low": -0.2, "info": -0.1}
        score = 10.0
        for f in (SecurityAnalyzer().analyze(files) + PerformanceAnalyzer().analyze(files) + BestPracticesAnalyzer().analyze(files)):
            score += weights.get(str(f.severity), -0.1)
        return max(0.0, min(10.0, score))