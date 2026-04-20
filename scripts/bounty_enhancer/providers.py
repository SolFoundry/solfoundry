"""
Multi-LLM provider integration for bounty description analysis.

Supports Claude, GPT/Codex, Gemini, and DeepSeek via OpenAI-compatible APIs.
"""

import asyncio
import json
import time
from typing import Optional

import httpx

from .models import (
    BountyInput,
    LLMSuggestion,
    LLMProvider,
)


# Provider-specific API configurations
PROVIDER_CONFIG = {
    LLMProvider.CLAUDE: {
        "base_url": "https://api.anthropic.com/v1",
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4096,
    },
    LLMProvider.GPT: {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "max_tokens": 4096,
    },
    LLMProvider.GEMINI: {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-pro",
        "max_tokens": 4096,
    },
    LLMProvider.DEEPSEEK: {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "max_tokens": 4096,
    },
}

SYSTEM_PROMPT = """You are an expert bounty description enhancer for an AI agent platform (SolFoundry).

Your job is to analyze vague bounty descriptions and produce improved versions that are:
- Clear and unambiguous
- Have well-defined requirements
- Include concrete acceptance criteria
- Provide practical examples where helpful
- Follow the tier-specific rules (T1/T2/T3)

You MUST respond with valid JSON matching this exact schema:
{
  "enhanced_title": "string - improved, specific title",
  "enhanced_description": "string - detailed, clear description",
  "requirements": ["string - specific, actionable requirements"],
  "acceptance_criteria": ["string - verifiable acceptance criteria"],
  "examples": ["string - practical examples or edge cases"],
  "confidence_score": 0.0-1.0,
  "reasoning": "string - brief explanation of your enhancement choices"
}

Guidelines:
- Keep titles concise but specific (include tech stack, scope)
- Add concrete implementation details to descriptions
- Each requirement should be independently verifiable
- Acceptance criteria should be testable
- Examples should cover common and edge cases
- If the original description is already good, still improve formatting and completeness
- Score confidence based on how much you improved the original (0.1 = minimal, 0.9 = major overhaul needed and delivered)"""


def _build_user_prompt(bounty: BountyInput) -> str:
    """Build the user prompt from a bounty input."""
    parts = [
        "Analyze and enhance this bounty description:\n",
        f"## Original Title\n{bounty.title}\n",
        f"## Original Description\n{bounty.description}\n",
    ]
    if bounty.tags:
        parts.append(f"## Tags\n{', '.join(bounty.tags)}\n")
    if bounty.repository:
        parts.append(f"## Repository\n{bounty.repository}\n")
    if bounty.issue_number:
        parts.append(f"## Issue Number\n#{bounty.issue_number}\n")
    return "\n".join(parts)


def _parse_llm_response(raw: str, provider: LLMProvider) -> dict:
    """Parse and validate an LLM JSON response."""
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Attempt to extract JSON from response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(text[start:end])
        else:
            raise ValueError(f"{provider.value}: Could not parse JSON from LLM response")

    # Validate required fields
    required = [
        "enhanced_title", "enhanced_description", "requirements",
        "acceptance_criteria", "confidence_score", "reasoning",
    ]
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"{provider.value}: Missing fields: {missing}")

    # Clamp confidence score
    data["confidence_score"] = max(0.0, min(1.0, float(data["confidence_score"])))

    return data


async def query_llm(
    provider: LLMProvider,
    bounty: BountyInput,
    api_key: str,
    timeout: float = 60.0,
) -> LLMSuggestion:
    """Query a single LLM provider for bounty enhancement.

    Args:
        provider: The LLM provider to use.
        bounty: The bounty input to enhance.
        api_key: API key for the provider.
        timeout: Request timeout in seconds.

    Returns:
        LLMSuggestion with the provider's enhancement.

    Raises:
        ValueError: If the response cannot be parsed.
        httpx.HTTPStatusError: If the API returns an error.
    """
    config = PROVIDER_CONFIG[provider]
    user_prompt = _build_user_prompt(bounty)
    start_time = time.time()

    headers = {"Content-Type": "application/json"}

    if provider == LLMProvider.CLAUDE:
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        payload = {
            "model": config["model"],
            "max_tokens": config["max_tokens"],
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        url = f"{config['base_url']}/messages"
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        payload = {
            "model": config["model"],
            "max_tokens": config["max_tokens"],
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
        }
        url = f"{config['base_url']}/chat/completions"

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    # Extract text from provider-specific response format
    if provider == LLMProvider.CLAUDE:
        raw_text = data["content"][0]["text"]
    else:
        raw_text = data["choices"][0]["message"]["content"]

    elapsed_ms = (time.time() - start_time) * 1000
    parsed = _parse_llm_response(raw_text, provider)

    return LLMSuggestion(
        provider=provider,
        enhanced_title=parsed["enhanced_title"],
        enhanced_description=parsed["enhanced_description"],
        requirements=parsed["requirements"],
        acceptance_criteria=parsed["acceptance_criteria"],
        examples=parsed.get("examples", []),
        confidence_score=parsed["confidence_score"],
        reasoning=parsed["reasoning"],
        processing_time_ms=elapsed_ms,
    )


async def query_all_providers(
    bounty: BountyInput,
    api_keys: dict[LLMProvider, str],
    providers: Optional[list[LLMProvider]] = None,
    timeout: float = 90.0,
) -> list[LLMSuggestion]:
    """Query multiple LLM providers in parallel.

    Args:
        bounty: The bounty input to enhance.
        api_keys: Mapping of provider to API key.
        providers: List of providers to query (defaults to CLAUDE, GPT, GEMINI).
        timeout: Per-provider timeout in seconds.

    Returns:
        List of suggestions from all providers.
    """
    if providers is None:
        providers = [LLMProvider.CLAUDE, LLMProvider.GPT, LLMProvider.GEMINI]

    # Filter to providers with API keys
    available = [p for p in providers if p in api_keys and api_keys[p]]
    if not available:
        raise ValueError(
            f"No API keys configured for requested providers: "
            f"{[p.value for p in providers]}"
        )

    tasks = [
        query_llm(p, bounty, api_keys[p], timeout)
        for p in available
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    suggestions = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            # Log error but don't fail the whole batch
            suggestions.append(
                LLMSuggestion(
                    provider=available[i],
                    enhanced_title=bounty.title,
                    enhanced_description=bounty.description,
                    requirements=[],
                    acceptance_criteria=[],
                    examples=[],
                    confidence_score=0.0,
                    reasoning=f"Error: {result}",
                    processing_time_ms=0,
                )
            )
        else:
            suggestions.append(result)

    return suggestions
