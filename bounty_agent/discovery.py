"""Bounty discovery module — scans platforms for opportunities."""
import subprocess, json, re
from dataclasses import dataclass, field
from typing import List, Optional

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
    def __init__(self, gh_token: str = ""):
        self.gh_token = gh_token

    def scan_github(self, keywords: str = "bounty", limit: int = 20) -> List[BountyIssue]:
        cmd = ["gh", "search", "issues", keywords, "--label=bounty", f"--limit={limit}", "--sort=updated", "--json", "repository,title,number,labels,url"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return []
            items = json.loads(result.stdout)
            bounties = []
            for item in items:
                repo = item.get("repository", {}).get("nameWithOwner", "")
                labels = [l.get("name", "") for l in item.get("labels", [])]
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

    def _extract_reward(self, title: str) -> str:
        match = re.search(r'(\d+)\s*(RTC|\$FNDRY|USDC|SOL)', title, re.IGNORECASE)
        return f"{match.group(1)} {match.group(2)}" if match else "unknown"

    def _assess_difficulty(self, labels: List[str]) -> str:
        if "easy" in labels or "good first issue" in labels: return "easy"
        if "hard" in labels or "red-team" in labels: return "hard"
        return "medium"
