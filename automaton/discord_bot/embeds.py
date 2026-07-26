"""Parse GitHub issue data and build Discord embed payloads.

This module is intentionally free of network / file-IO dependencies so it can
be unit-tested in isolation.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional


# Tier labels mapped to a Discord-friendly colour and label.
TIER_META: dict[str, tuple[int, str]] = {
    "tier-1": (0x43B581, "T1 — Open Race"),  # green
    "tier-2": (0xFAA61A, "T2 — Gated"),      # amber
    "tier-3": (0xED4245, "T3 — Claim-Based"),  # red
}


def parse_bounty(issue: dict[str, Any]) -> dict[str, Any]:
    """Extract bounty metadata from a GitHub issue dict.

    Args:
        issue: A GitHub API issue object (list endpoint payload item).

    Returns:
        A dict with normalized fields: ``number``, ``title``, ``html_url``,
        ``state``, ``reward``, ``tier``, ``domain``, ``assignees``,
        ``created_at``, ``updated_at``, ``labels``.
    """
    labels = {label["name"].lower() for label in issue.get("labels", [])}
    body = issue.get("body") or ""

    # Reward can come from the structured "Reward:" line in the issue body.
    reward = _extract_first(body, r"\*\*Reward:\*\*\s*([^\n|]+)")
    if not reward:
        # Fallback to labels like "100K $FNDRY" — not guaranteed, so keep None.
        reward = None

    tier = _tier_from_labels(labels)
    domain = _domain_from_labels(labels)

    assignees = [
        assignee["login"]
        for assignee in issue.get("assignees", [])
        if assignee and assignee.get("login")
    ]

    return {
        "number": int(issue["number"]),
        "title": issue.get("title", ""),
        "html_url": issue.get("html_url", ""),
        "state": issue.get("state", "open"),
        "reward": reward,
        "tier": tier,
        "domain": domain,
        "assignees": assignees,
        "created_at": issue.get("created_at"),
        "updated_at": issue.get("updated_at"),
        "labels": sorted(labels),
    }


def build_embed(bounty: dict[str, Any], action: str = "new") -> dict[str, Any]:
    """Build a Discord rich-embed payload for a bounty.

    Args:
        bounty: Parsed bounty dict from :func:`parse_bounty`.
        action: One of ``"new"``, ``"updated"``, or ``"closed"``.

    Returns:
        A JSON-serialisable embed dict (no top-level ``embeds`` wrapper —
        the caller wraps it).
    """
    tier_label, colour = _tier_colour_and_label(bounty.get("tier"))

    description = _action_phrase(action)
    fields: list[dict[str, Any]] = [
        {"name": "Reward", "value": bounty.get("reward") or "Not specified", "inline": True},
        {"name": "Tier", "value": tier_label, "inline": True},
        {
            "name": "Domain",
            "value": bounty.get("domain") or "General",
            "inline": True,
        },
        {"name": "Assignees", "value": _join_or_none(bounty.get("assignees")), "inline": False},
    ]

    return {
        "title": bounty["title"],
        "url": bounty["html_url"],
        "description": description,
        "color": colour,
        "fields": fields,
        "footer": {
            "text": f"SolFoundry • Issue #{bounty['number']} • "
                    f"{_friendly_time(bounty.get('updated_at') or bounty.get('created_at'))}"
        },
        "thumbnail": {"url": "https://raw.githubusercontent.com/SolFoundry/solfoundry/main/assets/logo.png"},
    }


def _extract_first(text: str, pattern: str) -> Optional[str]:
    m = re.search(pattern, text)
    return m.group(1).strip() if m else None


def _tier_from_labels(labels: set[str]) -> Optional[str]:
    for key in ("tier-3", "tier-2", "tier-1"):
        if key in labels:
            return key
    return None


def _domain_from_labels(labels: set[str]) -> Optional[str]:
    # Domain-specific labels that map nicely to a single string.
    order = ["frontend", "backend", "agent", "integration", "docs", "creative", "smart-contract"]
    for domain in order:
        if domain in labels:
            return domain.capitalize()
    return None


def _tier_colour_and_label(tier: Optional[str]) -> tuple[str, int]:
    meta = TIER_META.get(tier) if tier else None
    if meta is None:
        return "Unknown tier", 0x808080
    return meta[1], meta[0]


def _join_or_none(values: list[str] | None) -> str:
    values = values or []
    return ", ".join(values) if values else "No one (open for grabs)"


def _action_phrase(action: str) -> str:
    phrases = {
        "new": "🆕 **New bounty posted!**",
        "updated": "🔄 **Bounty updated!**",
        "closed": "🔒 **Bounty closed!**",
    }
    return phrases.get(action, "📢 **Bounty change**")


def _friendly_time(iso: str | None) -> str:
    if not iso:
        return "Just now"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except (ValueError, TypeError):
        return iso
