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

    @property
    def is_easy(self) -> bool:
        """Check if this bounty is classified as easy/entry-level."""
        return self.difficulty == "easy"


class BountyScanner:
    def __init__(self, gh_token: str = ""):
        self.gh_token = gh_token

    def scan_github(self, keywords: str = "bounty", limit: int = 20) -> List[BountyIssue]:
        cmd = ["gh", "search", "issues", keywords, "--label=bounty",
               f"--limit={limit}", "--sort=updated",
               "--json", "repository,title,number,labels,url"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return []
            items = json.loads(result.stdout)
            bounties = []
            for item in items:
                repo = item.get("repository", {}).get("nameWithOwner", "")
                labels = [lbl.get("name", "") for lbl in item.get("labels", [])]
                bounties.append(BountyIssue(
                    platform="github", repo=repo,
                    issue_number=item.get("number", 0),
                    title=item.get("title", ""),
                    reward=self._extract_reward(item.get("title", "")),
                    labels=labels, url=item.get("url", ""),
                    difficulty=self._assess_difficulty(labels)
                ))
            return bounties
        except Exception as e:
            print(f"Scan error: {e}")
            return []

    def prioritize(self, bounties: List[BountyIssue]) -> List[BountyIssue]:
        """Sort bounties by difficulty: easy first, then medium, then hard."""
        order = {"easy": 0, "unknown": 1, "medium": 2, "hard": 3}
        return sorted(bounties, key=lambda b: order.get(b.difficulty, 1))

    def _extract_reward(self, title: str) -> str:
        # Match patterns like "500K $FNDRY", "1M $FNDRY", "$250 USD"
        match = re.search(r'([\d,.]+?\s*[KM]?\s*(?:\$FNDRY|RTC|USDC|SOL|USD))', title, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        # Match standalone dollar amounts like "$250"
        match = re.search(r'(\$[\d,]+)', title)
        if match:
            return match.group(1)
        # Match numbers with K/M suffix like "500K"
        match = re.search(r'(\d+\s*[KM])', title, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return "unknown"

    def _assess_difficulty(self, labels: List[str]) -> str:
        label_set = set(lbl.lower() for lbl in labels)
        if label_set & {"easy", "good first issue", "tier-1"}:
            return "easy"
        if label_set & {"hard", "red-team", "tier-3"}:
            return "hard"
        if "tier-2" in label_set:
            return "medium"
        return "unknown"
