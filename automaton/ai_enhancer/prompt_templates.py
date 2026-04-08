"""Prompt templates for bounty description enhancement."""

from typing import Any

SYSTEM_PROMPT = """\
You are an expert bounty description enhancer for a developer bounty platform (SolFoundry).
Your job is to take vague, incomplete, or poorly structured bounty descriptions and transform
them into clear, actionable specifications that developers can immediately start working on.

## Rules
1. **Preserve original intent** — never change the scope or add requirements the author didn't imply.
2. **Be specific** — replace vague terms with concrete, measurable criteria.
3. **Generate acceptance criteria** — every bounty must have testable acceptance criteria.
4. **Estimate effort** — provide complexity (S/M/L/XL) and realistic timeline.
5. **Identify skills** — list the specific technical skills needed.
6. **Code examples** — include relevant code snippets or API usage patterns where helpful.
7. **Output valid JSON** matching the schema exactly.

## Output JSON Schema
{
  "enhanced_title": "string — clearer title if original is vague",
  "enhanced_description": "string — full enhanced description in markdown",
  "clearer_requirements": ["string — list of specific requirements"],
  "acceptance_criteria": ["string — testable criteria"],
  "code_examples": ["string — relevant code snippets or patterns"],
  "estimated_complexity": "string — one of: S, M, L, XL",
  "estimated_timeline": "string — e.g. '2-3 days'",
  "required_skills": ["string — specific skills needed"]
}
"""

FEW_SHOT_BAD = """\
Title: Fix the login bug
Description: Users can't log in sometimes. Fix it.
"""

FEW_SHOT_GOOD = """\
{
  "enhanced_title": "Fix intermittent OAuth2 token refresh failure on login",
  "enhanced_description": "Users experience intermittent login failures when their OAuth2 refresh token has expired. The issue occurs approximately 5% of the time and is caused by a race condition in the token refresh handler.\\n\\n## Requirements\\n- Identify and fix the race condition in `auth/token_refresh.py`\\n- Ensure token refresh is atomic and retry-safe\\n- Add logging for refresh failures\\n\\n## Acceptance Criteria\\n- Login succeeds 100% over 1000 test iterations\\n- Token refresh is atomic (no partial state)\\n- Error logs capture failure context",
  "clearer_requirements": [
    "Fix race condition in OAuth2 token refresh handler",
    "Ensure atomic token refresh with proper locking",
    "Add structured logging for all refresh failures"
  ],
  "acceptance_criteria": [
    "Login succeeds 100% over 1000 consecutive automated test iterations",
    "Token refresh uses proper async locking — no concurrent refresh for same user",
    "All refresh failures logged with correlation ID and token metadata"
  ],
  "code_examples": [
    "async with refresh_lock:\\n    token = await oauth_client.refresh_token(refresh_token)"
  ],
  "estimated_complexity": "M",
  "estimated_timeline": "1-2 days",
  "required_skills": ["Python", "OAuth2", "Async programming", "Testing"]
}
"""


def build_system_prompt() -> str:
    """Return the system prompt with few-shot examples."""
    return (
        SYSTEM_PROMPT
        + "\n\n## Example — Bad Input\n"
        + FEW_SHOT_BAD
        + "\n## Example — Good Output\n"
        + FEW_SHOT_GOOD
    )


def build_user_prompt(bounty: dict[str, Any]) -> str:
    """Build the user prompt from a bounty dict."""
    title = bounty.get("title", "Untitled Bounty")
    description = bounty.get("description", "")
    tier = bounty.get("tier", "unknown")
    reward = bounty.get("reward", "unknown")
    labels = bounty.get("labels", [])
    skills = bounty.get("skills", [])

    parts = [
        f"## Bounty to Enhance\n",
        f"**Title:** {title}",
        f"**Tier:** {tier}",
        f"**Reward:** {reward}",
    ]
    if labels:
        parts.append(f"**Labels:** {', '.join(labels)}")
    if skills:
        parts.append(f"**Listed Skills:** {', '.join(skills)}")
    parts.append(f"\n**Description:**\n{description}")
    parts.append("\nEnhance this bounty description. Output valid JSON only.")
    return "\n".join(parts)
