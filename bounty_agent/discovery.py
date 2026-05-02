"""Bounty discovery module — scans platforms for opportunities."""
import subprocess
import json
import re

from dataclasses import dataclass, field
from typing import List


@dataclass
class BountyIssue:
    platform: str
    repo: str
    issue_number: int
    title: str
    reward: str
    labels: List[str] = field(default_factory=list)
    url: str = ""
    difficulty: str = "unknown"


class BountyScanner:
    """Scans GitHub and other platforms for bounty opportunities."""

    def __init__(self, gh_token: str = ""):
        self.gh_token = gh_token

    def scan_github(self, keywords: str = "bounty", limit: int = 20) -> List[BountyIssue]:
        """Search GitHub Issues for bounty-labeled issues."""
        cmd = [
            "gh", "search", "issues", keywords,
            "--label=bounty",
            f"--limit={limit}",
            "--sort=updated",
            "--json", "repository,title,number,labels,url",
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return []
            items = json.loads(result.stdout)
            bounties = []
            for item in items:
                repo = item.get("repository", {}).get("nameWithOwner", "")
                label_list = item.get("labels", [])
                labels = [lbl.get("name", "") for lbl in label_list]
                bounties.append(BountyIssue(
                    platform="github",
                    repo=repo,
                    issue_number=item.get("number", 0),
                    title=item.get("title", ""),
                    reward=self._extract_reward(item.get("title", "")),
                    labels=labels,
                    url=item.get("url", ""),
                    difficulty=self._assess_difficulty(labels),
                ))
            return bounties
        except Exception as exc:
            print(f"Scan error: {exc}")
            return []

    @staticmethod
    def _extract_reward(title: str) -> str:
        """Extract reward amount from issue title."""
        match = re.search(r"[\$₿Ξ][\d,]+", title)
        return match.group(0) if match else "unknown"

    @staticmethod
    def _assess_difficulty(labels: List[str]) -> str:
        """Assess difficulty from labels."""
        label_set = set(lbl.lower() for lbl in labels)
        if label_set & {"easy", "good first issue", "beginner"}:
            return "easy"
        if label_set & {"medium", "moderate"}:
            return "medium"
        if label_set & {"hard", "expert", "advanced"}:
            return "hard"
        return "unknown"
