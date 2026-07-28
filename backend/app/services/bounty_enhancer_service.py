"""AI Bounty Description Enhancer service (Issue #848).

Analyzes vague bounty descriptions and generates improved versions with
clearer requirements, acceptance criteria, and examples using multiple LLM
providers (Claude, Codex, Gemini).

Architecture:
- Each provider is called via its own HTTP client (httpx)
- Results are stored in-memory (enhancement records dict)
- The maintainer can approve or reject each enhancement
- On approval, the bounty description is updated in the service layer
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.models.bounty_enhance import (
    EnhanceRequest,
    EnhanceResponse,
    EnhancementRecord,
    EnhancementStatus,
    EnhancementListResponse,
    LLMEnhancementResult,
    LLMProvider,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory storage
# ---------------------------------------------------------------------------

# Mapping: bounty_id -> list of EnhancementRecord
_enhancements: dict[str, list[EnhancementRecord]] = {}

# ---------------------------------------------------------------------------
# Default enhancement prompt template
# ---------------------------------------------------------------------------

DEFAULT_SYSTEM_PROMPT = """You are a SolFoundry bounty description expert. Your task is to improve a bounty description to make it clearer, more actionable, and more likely to attract quality contributors.

Given a bounty title and description, produce an enhanced version that:
1. **Clear Title**: A concise, descriptive title that captures the core task
2. **Problem Statement**: What problem does this bounty solve? Why is it needed?
3. **Requirements**: Specific, actionable requirements written as bullet points
4. **Acceptance Criteria**: Clear, testable criteria that define "done"
5. **Technical Context**: Relevant tech stack, dependencies, and architectural notes
6. **Examples**: Concrete examples of expected input/output or behavior
7. **Out of Scope**: Explicitly list what is NOT part of this bounty

Return the result as a JSON object with these fields:
- enhanced_title: string (max 200 chars)
- enhanced_description: string (markdown formatted, max 5000 chars)
- changes_summary: string (brief list of what was improved, max 500 chars)
- confidence_score: float (0.0 to 1.0, how confident you are in the quality of the enhancement)
"""

# ---------------------------------------------------------------------------
# Provider-specific prompts (add context about the provider's strengths)
# ---------------------------------------------------------------------------

PROVIDER_CONTEXT = {
    LLMProvider.CLAUDE: (
        "You are Claude, an AI assistant. Focus on structured, thorough analysis "
        "with clear sections and precise technical details."
    ),
    LLMProvider.CODEX: (
        "You are Codex, an AI coding assistant. Focus on practical implementation "
        "details, code examples, and developer-friendly language."
    ),
    LLMProvider.GEMINI: (
        "You are Gemini, a versatile AI. Focus on comprehensive coverage, "
        "bridging technical and non-technical requirements clearly."
    ),
}


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------


def _get_api_key(provider: LLMProvider) -> Optional[str]:
    """Get the API key for a given LLM provider from environment variables.

    Args:
        provider: The LLM provider to look up.

    Returns:
        The API key string, or None if not configured.
    """
    key_map = {
        LLMProvider.CLAUDE: "ANTHROPIC_API_KEY",
        LLMProvider.CODEX: "OPENAI_API_KEY",
        LLMProvider.GEMINI: "GOOGLE_API_KEY",
    }
    env_var = key_map.get(provider)
    if not env_var:
        return None
    return os.getenv(env_var)


def _call_llm_provider(
    provider: LLMProvider, title: str, description: str, custom_prompt: Optional[str] = None
) -> LLMEnhancementResult:
    """Call a single LLM provider to enhance a bounty description.

    Args:
        provider: The LLM provider to use.
        title: The current bounty title.
        description: The current bounty description.
        custom_prompt: Optional custom instructions.

    Returns:
        An LLMEnhancementResult with the generated enhancement, or an error result.
    """
    api_key = _get_api_key(provider)
    if not api_key:
        return LLMEnhancementResult(
            provider=provider,
            enhanced_title=title,
            enhanced_description=description,
            changes_summary="No enhancement generated",
            confidence_score=0.0,
            error=f"{provider.value.title()} API key not configured. Set the {provider.value.upper()}_API_KEY environment variable.",
        )

    system_prompt = PROVIDER_CONTEXT.get(provider, DEFAULT_SYSTEM_PROMPT)
    if custom_prompt:
        system_prompt += f"\n\nAdditional instructions from the maintainer:\n{custom_prompt}"

    user_prompt = f"""Please enhance this SolFoundry bounty description:

Title: {title}

Description:
{description}

Generate an improved version following the instructions in the system prompt. Return ONLY valid JSON."""

    try:
        if provider == LLMProvider.CLAUDE:
            return _call_claude(api_key, system_prompt, user_prompt, title, description)
        elif provider == LLMProvider.CODEX:
            return _call_codex(api_key, system_prompt, user_prompt, title, description)
        elif provider == LLMProvider.GEMINI:
            return _call_gemini(api_key, system_prompt, user_prompt, title, description)
        else:
            return LLMEnhancementResult(
                provider=provider,
                enhanced_title=title,
                enhanced_description=description,
                changes_summary="Unsupported provider",
                confidence_score=0.0,
                error=f"Unsupported provider: {provider}",
            )
    except Exception as e:
        logger.error("LLM call failed for %s: %s", provider.value, str(e))
        return LLMEnhancementResult(
            provider=provider,
            enhanced_title=title,
            enhanced_description=description,
            changes_summary="Enhancement failed",
            confidence_score=0.0,
            error=f"API call failed: {str(e)}",
        )


def _call_claude(
    api_key: str, system_prompt: str, user_prompt: str, title: str, description: str
) -> LLMEnhancementResult:
    """Call Claude (Anthropic API) to enhance a bounty description."""
    import json

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 4000,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("content", [{}])
            text = ""
            for block in content:
                if block.get("type") == "text":
                    text = block.get("text", "")
                    break
            return _parse_llm_response(text, LLMProvider.CLAUDE, title, description)
    except httpx.HTTPStatusError as e:
        logger.error("Claude API error: %s - %s", e.response.status_code, e.response.text)
        return LLMEnhancementResult(
            provider=LLMProvider.CLAUDE,
            enhanced_title=title,
            enhanced_description=description,
            changes_summary="Claude API error",
            confidence_score=0.0,
            error=f"API error {e.response.status_code}: {e.response.text[:200]}",
        )
    except Exception as e:
        logger.error("Claude API call failed: %s", str(e))
        raise


def _call_codex(
    api_key: str, system_prompt: str, user_prompt: str, title: str, description: str
) -> LLMEnhancementResult:
    """Call Codex (OpenAI API) to enhance a bounty description."""
    import json

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "content-type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "max_tokens": 4000,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            choice = data.get("choices", [{}])[0]
            text = choice.get("message", {}).get("content", "")
            return _parse_llm_response(text, LLMProvider.CODEX, title, description)
    except httpx.HTTPStatusError as e:
        logger.error("Codex API error: %s - %s", e.response.status_code, e.response.text)
        return LLMEnhancementResult(
            provider=LLMProvider.CODEX,
            enhanced_title=title,
            enhanced_description=description,
            changes_summary="Codex API error",
            confidence_score=0.0,
            error=f"API error {e.response.status_code}: {e.response.text[:200]}",
        )
    except Exception as e:
        logger.error("Codex API call failed: %s", str(e))
        raise


def _call_gemini(
    api_key: str, system_prompt: str, user_prompt: str, title: str, description: str
) -> LLMEnhancementResult:
    """Call Gemini (Google AI API) to enhance a bounty description."""
    import json

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
                headers={"content-type": "application/json"},
                json={
                    "system_instruction": {
                        "parts": [{"text": system_prompt}]
                    },
                    "contents": [
                        {
                            "parts": [{"text": user_prompt}]
                        }
                    ],
                    "generationConfig": {
                        "maxOutputTokens": 4000,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = " ".join(p.get("text", "") for p in parts)
            else:
                text = ""
            return _parse_llm_response(text, LLMProvider.GEMINI, title, description)
    except httpx.HTTPStatusError as e:
        logger.error("Gemini API error: %s - %s", e.response.status_code, e.response.text)
        return LLMEnhancementResult(
            provider=LLMProvider.GEMINI,
            enhanced_title=title,
            enhanced_description=description,
            changes_summary="Gemini API error",
            confidence_score=0.0,
            error=f"API error {e.response.status_code}: {e.response.text[:200]}",
        )
    except Exception as e:
        logger.error("Gemini API call failed: %s", str(e))
        raise


def _parse_llm_response(
    text: str, provider: LLMProvider, fallback_title: str, fallback_description: str
) -> LLMEnhancementResult:
    """Parse the LLM response JSON into an LLMEnhancementResult.

    Args:
        text: The raw text response from the LLM.
        provider: The provider that generated the response.
        fallback_title: Title to use if parsing fails.
        fallback_description: Description to use if parsing fails.

    Returns:
        A parsed LLMEnhancementResult.
    """
    import json
    import re

    # Try to extract JSON from the response (it may be wrapped in markdown code blocks)
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # Try to find JSON object directly
        json_match = re.search(r"\{.*\"enhanced_title\".*\"enhanced_description\".*\}", text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            # Fallback: wrap the entire response as description
            return LLMEnhancementResult(
                provider=provider,
                enhanced_title=fallback_title,
                enhanced_description=text[:5000] if text else fallback_description,
                changes_summary="Generated enhanced description",
                confidence_score=0.5,
                error=None,
            )

    try:
        parsed = json.loads(json_str)
        return LLMEnhancementResult(
            provider=provider,
            enhanced_title=parsed.get("enhanced_title", fallback_title)[:200],
            enhanced_description=parsed.get("enhanced_description", fallback_description)[:5000],
            changes_summary=parsed.get("changes_summary", "Generated enhanced description")[:500],
            confidence_score=min(max(float(parsed.get("confidence_score", 0.5)), 0.0), 1.0),
            error=None,
        )
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.warning("Failed to parse LLM response JSON: %s", str(e))
        return LLMEnhancementResult(
            provider=provider,
            enhanced_title=fallback_title,
            enhanced_description=text[:5000] if text else fallback_description,
            changes_summary="Generated enhanced description (parsing warning)",
            confidence_score=0.5,
            error=None,
        )


def _truncate_enhancement_description(text: str, max_length: int = 5000) -> str:
    """Truncate enhancement description to fit the model limit.

    Args:
        text: The text to truncate.
        max_length: Maximum length allowed.

    Returns:
        Truncated text.
    """
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def enhance_bounty_description(
    bounty_id: str,
    title: str,
    description: str,
    request: EnhanceRequest,
    created_by: str = "system",
) -> EnhanceResponse:
    """Enhance a bounty description using multiple LLM providers.

    This is the main entry point for the AI Bounty Description Enhancer.
    It calls each configured LLM provider, collects the results, and
    stores them for later approval or rejection.

    Args:
        bounty_id: The UUID of the bounty to enhance.
        title: The current bounty title.
        description: The current bounty description.
        request: The enhancement request payload.
        created_by: The user or agent requesting the enhancement.

    Returns:
        An EnhanceResponse with the results from each provider.
    """
    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    results: list[LLMEnhancementResult] = []
    for provider in request.providers:
        result = _call_llm_provider(provider, title, description, request.custom_prompt)
        results.append(result)

    succeeded = [r for r in results if r.error is None]
    failed = [r for r in results if r.error is not None]

    record = EnhancementRecord(
        id=record_id,
        bounty_id=bounty_id,
        original_title=title,
        original_description=description,
        results=results,
        status=EnhancementStatus.PENDING,
        created_by=created_by,
        created_at=now,
        updated_at=now,
    )

    if bounty_id not in _enhancements:
        _enhancements[bounty_id] = []
    _enhancements[bounty_id].append(record)

    if succeeded and not failed:
        message = f"Enhanced bounty description using {len(succeeded)} provider(s). Review and approve to apply."
    elif succeeded and failed:
        message = f"Enhanced using {len(succeeded)} provider(s). {len(failed)} provider(s) failed: {', '.join(r.error for r in failed if r.error)}"
    else:
        message = "All enhancement providers failed. Check API key configuration."

    return EnhanceResponse(
        enhancement_id=record_id,
        bounty_id=bounty_id,
        results=results,
        status=EnhancementStatus.PENDING,
        created_at=now,
        message=message,
    )


async def get_enhancements_for_bounty(
    bounty_id: str,
) -> EnhancementListResponse:
    """Get all enhancement records for a bounty.

    Args:
        bounty_id: The UUID of the bounty.

    Returns:
        An EnhancementListResponse with all enhancement records.
    """
    records = _enhancements.get(bounty_id, [])
    return EnhancementListResponse(
        items=list(reversed(records)),  # newest first
        total=len(records),
        bounty_id=bounty_id,
    )


async def approve_enhancement(
    bounty_id: str,
    enhancement_id: str,
    provider: LLMProvider,
) -> Optional[EnhancementRecord]:
    """Approve an enhancement result and update the bounty description.

    Args:
        bounty_id: The UUID of the bounty.
        enhancement_id: The ID of the enhancement record.
        provider: The LLM provider whose result to approve.

    Returns:
        The updated EnhancementRecord, or None if not found.
    """
    records = _enhancements.get(bounty_id, [])
    for record in records:
        if record.id == enhancement_id:
            # Find the selected provider's result
            for result in record.results:
                if result.provider == provider and result.error is None:
                    record.selected_result = result
                    record.status = EnhancementStatus.APPROVED
                    record.updated_at = datetime.now(timezone.utc)

                    # Update the bounty description in the service layer
                    # (the actual bounty update is handled by the API layer)
                    return record
            # Provider not found or had error
            return None
    return None


async def reject_enhancement(
    bounty_id: str,
    enhancement_id: str,
) -> Optional[EnhancementRecord]:
    """Reject an enhancement request.

    Args:
        bounty_id: The UUID of the bounty.
        enhancement_id: The ID of the enhancement record.

    Returns:
        The updated EnhancementRecord, or None if not found.
    """
    records = _enhancements.get(bounty_id, [])
    for record in records:
        if record.id == enhancement_id:
            record.status = EnhancementStatus.REJECTED
            record.updated_at = datetime.now(timezone.utc)
            return record
    return None


async def get_enhancement(
    bounty_id: str,
    enhancement_id: str,
) -> Optional[EnhancementRecord]:
    """Get a specific enhancement record.

    Args:
        bounty_id: The UUID of the bounty.
        enhancement_id: The ID of the enhancement record.

    Returns:
        The EnhancementRecord, or None if not found.
    """
    records = _enhancements.get(bounty_id, [])
    for record in records:
        if record.id == enhancement_id:
            return record
    return None