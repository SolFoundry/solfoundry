#!/usr/bin/env python3
"""AI Bounty Description Enhancer — Multi-LLM Analysis Script.

Analyzes vague bounty descriptions and generates improved versions with clearer
requirements, acceptance criteria, suggested skills, and tier classification.

Supports multiple LLM providers (Claude, OpenAI/GPT, Google Gemini) and
produces a consensus-enhanced description.

Usage:
    # Quick enhancement (single provider)
    python3 scripts/enhance_description.py --title "Fix auth bug" --description "Auth is broken"

    # Multi-LLM analysis
    python3 scripts/enhance_description.py --title "Fix auth bug" --description "Auth is broken" --multi

    # From a JSON file
    python3 scripts/enhance_description.py --input bounty.json --multi

    # Output to file
    python3 scripts/enhance_description.py --input bounty.json --output enhanced.json --multi

Environment variables (at least one required):
    ANTHROPIC_API_KEY    — Claude API key
    OPENAI_API_KEY       — OpenAI API key
    GEMINI_API_KEY       — Google Gemini API key

Exit codes:
    0 — enhancement successful
    1 — enhancement failed
    2 — invalid arguments
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

# ---------------------------------------------------------------------------
# LLM Provider Abstractions
# ---------------------------------------------------------------------------

class LLMProvider:
    """Base class for LLM providers."""

    name: str = "base"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key
        self.model = model

    def is_available(self) -> bool:
        return self.api_key is not None

    def enhance(self, title: str, description: str) -> dict[str, Any]:
        raise NotImplementedError


class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider."""

    name = "claude"

    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-20250514"):
        super().__init__(api_key, model)

    def enhance(self, title: str, description: str) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Anthropic API key not set")

        import urllib.request
        import urllib.error

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        prompt = _build_prompt(title, description)
        payload = {
            "model": self.model,
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": prompt}],
        }

        req = urllib.request.Request(
            url, data=json.dumps(payload).encode(), headers=headers, method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                text = data["content"][0]["text"]
                return _parse_response(text, self.name)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Claude API error: {e.code} {e.reason}") from e


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""

    name = "openai"

    def __init__(self, api_key: str | None = None, model: str = "gpt-4o"):
        super().__init__(api_key, model)

    def enhance(self, title: str, description: str) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("OpenAI API key not set")

        import urllib.request
        import urllib.error

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        prompt = _build_prompt(title, description)
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are an expert at writing clear, actionable bounty descriptions for open-source projects."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 2048,
            "temperature": 0.7,
        }

        req = urllib.request.Request(
            url, data=json.dumps(payload).encode(), headers=headers, method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                text = data["choices"][0]["message"]["content"]
                return _parse_response(text, self.name)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"OpenAI API error: {e.code} {e.reason}") from e


class GeminiProvider(LLMProvider):
    """Google Gemini provider."""

    name = "gemini"

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.0-flash"):
        super().__init__(api_key, model)

    def enhance(self, title: str, description: str) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Gemini API key not set")

        import urllib.request
        import urllib.error

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}

        prompt = _build_prompt(title, description)
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 2048, "temperature": 0.7},
        }

        req = urllib.request.Request(
            url, data=json.dumps(payload).encode(), headers=headers, method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return _parse_response(text, self.name)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Gemini API error: {e.code} {e.reason}") from e


# ---------------------------------------------------------------------------
# Prompt & Response Parsing
# ---------------------------------------------------------------------------

def _build_prompt(title: str, description: str) -> str:
    return f"""You are an expert at writing clear, actionable bounty descriptions for open-source projects (specifically SolFoundry on Solana).

Given the following bounty, produce an improved version:

**Original Title:** {title}
**Original Description:** {description}

Respond in the following JSON format (and nothing else):
{{
  "title": "Improved, specific title",
  "description": "Detailed description with clear problem statement, scope, and technical details",
  "acceptance_criteria": [
    "Criterion 1",
    "Criterion 2",
    "Criterion 3"
  ],
  "suggested_skills": ["Skill1", "Skill2"],
  "suggested_tier": "T1|T2|T3",
  "confidence": 0.0-1.0
}}

Guidelines:
- Title should be concise but descriptive (5-15 words)
- Description should explain WHAT the problem is, WHY it matters, and WHAT a good solution looks like
- Include 3-7 acceptance criteria that are specific and testable
- Suggest relevant skills/technologies
- Tier: T1 (quick fix, <4h), T2 (medium feature, 4-16h), T3 (major feature, >16h)
- Confidence: how confident you are this enhancement is accurate (0-1)"""


def _parse_response(text: str, provider: str) -> dict[str, Any]:
    """Parse LLM JSON response, handling markdown code fences."""
    cleaned = text.strip()
    # Remove markdown code fences if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        if lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(cleaned[start:end])
        else:
            raise ValueError(f"Could not parse JSON response from {provider}")

    return {
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "acceptance_criteria": data.get("acceptance_criteria", []),
        "suggested_skills": data.get("suggested_skills", []),
        "suggested_tier": data.get("suggested_tier", "T2"),
        "provider": provider,
        "confidence": float(data.get("confidence", 0.7)),
    }


# ---------------------------------------------------------------------------
# Consensus Logic
# ---------------------------------------------------------------------------

def build_consensus(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Merge multiple provider results into a single consensus enhancement.

    Uses a majority-vote approach for tier, and concatenates unique
    acceptance criteria and skills.
    """
    if not results:
        raise ValueError("No results to build consensus from")

    if len(results) == 1:
        return {**results[0], "provider": "consensus", "confidence": results[0]["confidence"]}

    # Tier: majority vote
    tier_counts: dict[str, int] = {}
    for r in results:
        tier = r.get("suggested_tier", "T2")
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
    best_tier = max(tier_counts, key=tier_counts.get)

    # Acceptance criteria: unique, keep order of first appearance
    seen_criteria: set[str] = set()
    all_criteria: list[str] = []
    for r in results:
        for c in r.get("acceptance_criteria", []):
            if c not in seen_criteria:
                seen_criteria.add(c)
                all_criteria.append(c)

    # Skills: unique
    seen_skills: set[str] = set()
    all_skills: list[str] = []
    for r in results:
        for s in r.get("suggested_skills", []):
            sk = s.lower().strip()
            if sk not in seen_skills:
                seen_skills.add(sk)
                all_skills.append(s.strip())

    # Pick the longest description as the base
    best_desc = max(results, key=lambda r: len(r.get("description", "")))

    # Average confidence
    avg_confidence = sum(r.get("confidence", 0.7) for r in results) / len(results)

    return {
        "title": best_desc.get("title", ""),
        "description": best_desc.get("description", ""),
        "acceptance_criteria": all_criteria[:10],  # Cap at 10
        "suggested_skills": all_skills[:8],  # Cap at 8
        "suggested_tier": best_tier,
        "provider": "consensus",
        "confidence": round(avg_confidence, 2),
    }


# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------

def enhance_single(title: str, description: str) -> dict[str, Any]:
    """Enhance using the first available provider."""
    providers = [
        ClaudeProvider(os.environ.get("ANTHROPIC_API_KEY")),
        OpenAIProvider(os.environ.get("OPENAI_API_KEY")),
        GeminiProvider(os.environ.get("GEMINI_API_KEY")),
    ]

    for provider in providers:
        if provider.is_available():
            print(f"Enhancing with {provider.name}...", file=sys.stderr)
            return provider.enhance(title, description)

    raise RuntimeError("No LLM API keys configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.")


def enhance_multi(title: str, description: str) -> dict[str, Any]:
    """Enhance using all available providers and build consensus."""
    providers = [
        ClaudeProvider(os.environ.get("ANTHROPIC_API_KEY")),
        OpenAIProvider(os.environ.get("OPENAI_API_KEY")),
        GeminiProvider(os.environ.get("GEMINI_API_KEY")),
    ]

    available = [p for p in providers if p.is_available()]
    if not available:
        raise RuntimeError("No LLM API keys configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.")

    results: dict[str, dict[str, Any] | None] = {}
    for provider in available:
        print(f"Analyzing with {provider.name}...", file=sys.stderr)
        try:
            results[provider.name] = provider.enhance(title, description)
            print(f"  ✓ {provider.name} done", file=sys.stderr)
        except Exception as e:
            print(f"  ✗ {provider.name} failed: {e}", file=sys.stderr)
            results[provider.name] = None

    valid_results = [r for r in results.values() if r is not None]
    if not valid_results:
        raise RuntimeError("All LLM providers failed")

    consensus = build_consensus(valid_results)
    print(f"  ✓ Consensus built from {len(valid_results)} provider(s)", file=sys.stderr)

    return {
        "claude": results.get("claude"),
        "openai": results.get("openai"),
        "gemini": results.get("gemini"),
        "consensus": consensus,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI Bounty Description Enhancer — analyze and improve bounty descriptions using multiple LLMs.",
    )
    parser.add_argument("--title", "-t", type=str, help="Bounty title")
    parser.add_argument("--description", "-d", type=str, help="Bounty description")
    parser.add_argument("--input", "-i", type=str, help="Input JSON file with {title, description}")
    parser.add_argument("--output", "-o", type=str, help="Output JSON file (default: stdout)")
    parser.add_argument("--multi", "-m", action="store_true", help="Use multiple LLM providers for consensus")
    parser.add_argument("--provider", "-p", choices=["claude", "openai", "gemini"], help="Specific provider to use")
    parser.add_argument("--json", action="store_true", help="Output raw JSON (for piping)")
    args = parser.parse_args()

    # Load input
    if args.input:
        with open(args.input) as f:
            input_data = json.load(f)
        title = input_data.get("title", "")
        description = input_data.get("description", "")
    elif args.title and args.description:
        title = args.title
        description = args.description
    else:
        parser.error("Provide --title and --description, or --input file")
        return 2

    if not title.strip() or not description.strip():
        print("Error: Title and description must not be empty", file=sys.stderr)
        return 2

    try:
        if args.multi:
            result = enhance_multi(title, description)
        elif args.provider:
            providers = {
                "claude": ClaudeProvider(os.environ.get("ANTHROPIC_API_KEY")),
                "openai": OpenAIProvider(os.environ.get("OPENAI_API_KEY")),
                "gemini": GeminiProvider(os.environ.get("GEMINI_API_KEY")),
            }
            provider = providers[args.provider]
            if not provider.is_available():
                key_name = {"claude": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "gemini": "GEMINI_API_KEY"}[args.provider]
                print(f"Error: {key_name} not set", file=sys.stderr)
                return 1
            result = provider.enhance(title, description)
        else:
            result = enhance_single(title, description)

        output = json.dumps(result, indent=2)

        if args.output:
            with open(args.output, "w") as f:
                f.write(output)
            print(f"Results written to {args.output}", file=sys.stderr)
        else:
            print(output)

        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
