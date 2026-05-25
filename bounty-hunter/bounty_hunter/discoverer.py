"""Bounty discovery — finds and parses bounty issues from GitHub."""

import logging
import subprocess
import json
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

log = logging.getLogger(__name__)


@dataclass
class Bounty:
    """A parsed bounty issue."""
    number: int
    title: str
    body: str
    tier: str  # T1, T2, T3
    reward: str
    state: str
    labels: list[str] = field(default_factory=list)
    html_url: str = ""
    created_at: str = ""


class BountyDiscoverer:
    """Discovers bounty issues from GitHub using `gh` CLI."""

    def __init__(self, owner: str = "SolFoundry", repo: str = "solfoundry"):
        self.owner = owner
        self.repo = repo

    def list_bounties(self, state: str = "open", tier: Optional[str] = None) -> list[Bounty]:
        """List bounty issues from the repository."""
        label_filter = "bounty"
        if tier:
            label_filter = f"bounty,{tier}"

        cmd = [
            "gh", "issue", "list",
            "--repo", f"{self.owner}/{self.repo}",
            "--state", state,
            "--label", label_filter,
            "--json", "number,title,state,labels,body,url,createdAt",
            "--limit", "50",
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                log.error(f"gh issue list failed: {result.stderr}")
                return []

            issues = json.loads(result.stdout)
            bounties = []
            for issue in issues:
                labels = [l["name"] for l in issue.get("labels", [])]
                tier = self._detect_tier(labels)
                if not tier:
                    continue  # skip non-bounty issues

                reward = self._extract_reward(issue.get("body", ""), tier)
                bounties.append(Bounty(
                    number=issue["number"],
                    title=issue["title"],
                    body=issue.get("body", ""),
                    tier=tier,
                    reward=reward,
                    state=issue["state"],
                    labels=labels,
                    html_url=issue.get("url", ""),
                    created_at=issue.get("createdAt", ""),
                ))

            return bounties

        except subprocess.TimeoutExpired:
            log.error("gh issue list timed out")
            return []
        except json.JSONDecodeError as e:
            log.error(f"Failed to parse gh output: {e}")
            return []

    def get_bounty(self, issue_number: int) -> Optional[Bounty]:
        """Get a specific bounty by issue number."""
        cmd = [
            "gh", "issue", "view", str(issue_number),
            "--repo", f"{self.owner}/{self.repo}",
            "--json", "number,title,state,labels,body,url,createdAt",
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if result.returncode != 0:
                log.error(f"gh issue view failed: {result.stderr}")
                return None

            issue = json.loads(result.stdout)
            labels = [l["name"] for l in issue.get("labels", [])]
            tier = self._detect_tier(labels)

            return Bounty(
                number=issue["number"],
                title=issue["title"],
                body=issue.get("body", ""),
                tier=tier or "T1",
                reward=self._extract_reward(issue.get("body", ""), tier or "T1"),
                state=issue["state"],
                labels=labels,
                html_url=issue.get("url", ""),
                created_at=issue.get("createdAt", ""),
            )

        except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
            log.error(f"Failed to get issue {issue_number}: {e}")
            return None

    def check_claim_status(self, issue_number: int) -> str:
        """Check if a bounty has been claimed (has open PRs)."""
        cmd = [
            "gh", "pr", "list",
            "--repo", f"{self.owner}/{self.repo}",
            "--state", "open",
            "--search", f"{issue_number} in:body",
            "--json", "number,title,url",
            "--limit", "5",
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if result.returncode != 0:
                return "unknown"
            prs = json.loads(result.stdout)
            if prs:
                return f"claimed ({len(prs)} PRs)"
            return "available"
        except (subprocess.TimeoutExpired, json.JSONDecodeError):
            return "unknown"

    @staticmethod
    def _detect_tier(labels: list[str]) -> str:
        """Detect the bounty tier from labels."""
        label_lower = [l.lower() for l in labels]
        if "tier-3" in label_lower or "t3" in label_lower:
            return "T3"
        if "tier-2" in label_lower or "t2" in label_lower:
            return "T2"
        if "tier-1" in label_lower or "t1" in label_lower:
            return "T1"
        return ""

    @staticmethod
    def _extract_reward(body: str, tier: str) -> str:
        """Extract reward amount from the issue body."""
        import re
        patterns = [
            r"(?:reward|bounty|prize)\s*:?\s*([\d,.]+\s*\$?\w+)",
            r"(?:reward|bounty|prize)\s*:?\s*([\d,.]+\s*\$?FNDRY)",
            rf"{tier}\s*.*?([\d,.]+\s*\$?\w+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return {"T3": "1M $FNDRY", "T2": "700K $FNDRY", "T1": "100K $FNDRY"}.get(tier, "Unknown")
