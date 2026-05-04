"""Automatic bounty tier classification based on issue metadata."""

from __future__ import annotations

import re

from github_scraper.models.issue import BountyTier, ScrapedIssue, TIER_REWARD_MAP

# Label-based tier mapping
LABEL_TIER_MAP: dict[str, BountyTier] = {
    "critical": BountyTier.T0_CRITICAL,
    "security": BountyTier.T0_CRITICAL,
    "p0": BountyTier.T0_CRITICAL,
    "major": BountyTier.T1_MAJOR,
    "p1": BountyTier.T1_MAJOR,
    "enhancement": BountyTier.T2_STANDARD,
    "feature": BountyTier.T2_STANDARD,
    "p2": BountyTier.T2_STANDARD,
    "bug": BountyTier.T2_STANDARD,
    "minor": BountyTier.T3_MINOR,
    "p3": BountyTier.T3_MINOR,
    "documentation": BountyTier.T4_MICRO,
    "good first issue": BountyTier.T4_MICRO,
    "help wanted": BountyTier.T4_MICRO,
    "p4": BountyTier.T4_MICRO,
}

# Keywords in title/body that suggest higher tiers
CRITICAL_KEYWORDS = ["security", "vulnerability", "cve", "exploit", "critical", "urgent", "emergency"]
MAJOR_KEYWORDS = ["rewrite", "refactor", "architecture", "migration", "breaking change"]
STANDARD_KEYWORDS = ["implement", "feature", "support", "add", "build", "create"]


class TierClassifier:
    """Classify issues into SolFoundry bounty tiers."""

    def classify(self, issue: ScrapedIssue) -> BountyTier:
        """Classify an issue into a bounty tier.

        Priority:
        1. Explicit tier label (e.g., "T0", "T1")
        2. Known label mapping (e.g., "security" → T0)
        3. Keyword analysis of title and body
        4. Default: T3 (minor)
        """
        # Check for explicit tier labels
        for label in issue.labels:
            label_lower = label.lower().strip()
            if label_lower.startswith("t") and len(label_lower) == 2:
                try:
                    return BountyTier(label_lower.upper())
                except ValueError:
                    pass

        # Check label-based mapping
        for label in issue.labels:
            label_lower = label.lower().strip()
            if label_lower in LABEL_TIER_MAP:
                return LABEL_TIER_MAP[label_lower]

        # Keyword analysis
        text = f"{issue.title} {issue.body[:500]}".lower()
        if any(kw in text for kw in CRITICAL_KEYWORDS):
            return BountyTier.T0_CRITICAL
        if any(kw in text for kw in MAJOR_KEYWORDS):
            return BountyTier.T1_MAJOR
        if any(kw in text for kw in STANDARD_KEYWORDS):
            return BountyTier.T2_STANDARD

        return BountyTier.T3_MINOR

    def get_reward(self, tier: BountyTier) -> str:
        """Get the reward string for a tier."""
        return TIER_REWARD_MAP[tier]
