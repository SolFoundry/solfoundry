"""
Webhook processor integration for Telegram bounty notifications.

This module is designed to be called from the existing GitHub webhook handler
when a new issue with a 'bounty' label is created.

Integration point:
    In your webhook handler (e.g., webhook_processor.py), after processing
    a new bounty issue, call:
    
        from app.services.telegram_bot import send_bounty_notification
        
        await send_bounty_notification({
            "title": issue.title,
            "url": issue.html_url,
            "tier": tier_label,
            "reward": extract_reward(issue.body),
            "description": issue.body,
            "tags": [label.name for label in issue.labels],
        })
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Regex patterns for extracting reward from issue body
REWARD_PATTERNS = [
    re.compile(r"(?:reward|payout|prize)[:\s]*\$?([0-9,]+)\s*(FNDRY|USDC|SOL)?", re.IGNORECASE),
    re.compile(r"([0-9,]+)\s*\$FNDRY", re.IGNORECASE),
    re.compile(r"Reward[:\s]*([0-9,]+)", re.IGNORECASE),
]


def extract_reward_from_body(body: Optional[str], default: str = "TBD") -> str:
    """
    Extract reward information from the issue body text.

    Args:
        body: The issue body text (markdown).
        default: Default value if no reward pattern is found.

    Returns:
        Formatted reward string, e.g. "50000 $FNDRY" or the default.
    """
    if not body:
        return default

    for pattern in REWARD_PATTERNS:
        match = pattern.search(body)
        if match:
            amount = match.group(1).replace(",", "")
            currency = match.group(2) if match.lastindex and match.group(2) else "$FNDRY"
            return f"{amount} {currency}"

    return default


def extract_tier_from_labels(labels: list) -> str:
    """
    Extract the tier label from a list of label names.

    Args:
        labels: List of label name strings (e.g. ["bounty", "tier-1", "frontend"]).

    Returns:
        Tier string (e.g. "tier-1", "tier-2", "tier-3"), or "tier-1" as default.
    """
    for label in labels:
        if label.startswith("tier-"):
            return label
    return "tier-1"


async def handle_bounty_webhook(issue_data: dict) -> bool:
    """
    Handle a GitHub webhook payload for a new bounty issue.

    This is the integration function that webhook_processor.py should call.

    Args:
        issue_data: Dict with keys matching the GitHub webhook issue payload.
            Expected: {"title", "html_url", "labels", "body", "user"}

    Returns:
        True if notification was sent, False otherwise.
    """
    labels = [l["name"] for l in issue_data.get("labels", [])]

    # Only send notifications for issues with the 'bounty' label
    if "bounty" not in labels:
        return False

    tier = extract_tier_from_labels(labels)
    body = issue_data.get("body", "")
    reward = extract_reward_from_body(body)

    bounty_data = {
        "title": issue_data.get("title", "Untitled Bounty"),
        "url": issue_data.get("html_url", ""),
        "tier": tier,
        "reward": reward,
        "description": body[:500] if body else "",
        "tags": labels,
    }

    from app.services.telegram_bot import send_bounty_notification

    return await send_bounty_notification(bounty_data)