"""Claude LLM reviewer using the Anthropic API."""

import os
from typing import Optional

from ..models import DiffFile, Finding, ReviewConfig
from .base import LLMReviewer


class ClaudeReviewer(LLMReviewer):
    """Reviews PR diffs using Anthropic Claude."""

    name = "claude"

    def __init__(self, config: ReviewConfig, api_key: Optional[str] = None):
        super().__init__(config)
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")

    async def review(self, files: list[DiffFile], instructions: Optional[str] = None) -> tuple[float, list[Finding]]:
        if not self.api_key:
            # No key configured — fall back to a deterministic heuristic review
            return self._heuristic_review(files)

        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=self.api_key)
            prompt = self._build_prompt(files, instructions)
            resp = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system="You are a senior code reviewer. Return only JSON.",
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text
            findings = self._parse_findings(raw)
            score = self._score(raw)
            if not findings:
                score = self._heuristic_score(files)
            return score, findings
        except Exception:
            # Fall back to heuristic on any API error
            return self._heuristic_review(files)

    def _heuristic_review(self, files: list[DiffFile]) -> tuple[float, list[Finding]]:
        """Deterministic review used when no API key is available (or on API failure)."""
        from ..analyzers import SecurityAnalyzer, PerformanceAnalyzer, BestPracticesAnalyzer
        findings = []
        findings += SecurityAnalyzer().analyze(files)
        findings += PerformanceAnalyzer().analyze(files)
        findings += BestPracticesAnalyzer().analyze(files)
        score = self._score_from_findings(findings)
        return score, findings

    def _heuristic_score(self, files: list[DiffFile]) -> float:
        from ..analyzers import SecurityAnalyzer, PerformanceAnalyzer, BestPracticesAnalyzer
        findings = []
        findings += SecurityAnalyzer().analyze(files)
        findings += PerformanceAnalyzer().analyze(files)
        findings += BestPracticesAnalyzer().analyze(files)
        return self._score_from_findings(findings)

    @staticmethod
    def _score_from_findings(findings: list[Finding]) -> float:
        weights = {"critical": -2.0, "high": -1.0, "medium": -0.5, "low": -0.2, "info": -0.1}
        score = 10.0
        for f in findings:
            score += weights.get(str(f.severity), -0.1)
        return max(0.0, min(10.0, score))