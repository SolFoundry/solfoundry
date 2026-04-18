"""Discovery Agent — Scans GitHub for bounty issues."""
import re
import httpx
from dataclasses import dataclass, field
from typing import Optional

from app.config import config


@dataclass
class Bounty:
    """Represents a bounty issue on GitHub."""
    number: int
    title: str
    body: str
    repo: str  # e.g. "SolFoundry/solfoundry"
    labels: list[str] = field(default_factory=list)
    tier: str = ""
    domain: str = ""
    reward: str = ""
    url: str = ""

    @property
    def is_claimable(self) -> bool:
        """Check if bounty appears unclaimed (no 'claimed' or 'assigned' labels)."""
        lower_labels = [l.lower() for l in self.labels]
        return not any(kw in " ".join(lower_labels) for kw in ["claimed", "assigned", "in-progress", "completed"])

    @property
    def branch_name(self) -> str:
        """Generate a git branch name from bounty info."""
        slug = re.sub(r"[^a-z0-9]+", "-", self.title.lower()).strip("-")[:50]
        return f"{config.PR_BRANCH_PREFIX}-{self.number}-{slug}"


class DiscoveryAgent:
    """Scans GitHub repositories for open bounty issues."""

    BOUNTY_LABELS = {"bounty", "bounty-t1", "bounty-t2", "bounty-t3", "tier-1", "tier-2", "tier-3"}

    def __init__(self, token: str | None = None):
        self.token = token or config.GITHUB_TOKEN
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

    async def scan_repo(self, repo: str) -> list[Bounty]:
        """Scan a single repo for open bounty issues."""
        bounties = []
        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            page = 1
            while True:
                resp = await client.get(
                    f"https://api.github.com/repos/{repo}/issues",
                    params={"state": "open", "per_page": 100, "page": page},
                )
                resp.raise_for_status()
                issues = resp.json()
                if not issues:
                    break
                for issue in issues:
                    labels = [l["name"] for l in issue.get("labels", [])]
                    # Skip pull requests (they show up in issues endpoint)
                    if "pull_request" in issue:
                        continue
                    if self._is_bounty(labels):
                        bounties.append(self._parse_issue(issue, repo))
                page += 1
        return bounties

    async def scan_all(self, repos: list[str] | None = None) -> list[Bounty]:
        """Scan all configured repos for bounties."""
        repos = repos or config.TARGET_REPOS
        all_bounties = []
        for repo in repos:
            try:
                bounties = await self.scan_repo(repo)
                all_bounties.extend(bounties)
            except Exception as e:
                print(f"[Discovery] Error scanning {repo}: {e}")
        return all_bounties

    def _is_bounty(self, labels: list[str]) -> bool:
        """Check if any label indicates a bounty."""
        lower = {l.lower() for l in labels}
        return bool(lower & {b.lower() for b in self.BOUNTY_LABELS}) or "bounty" in " ".join(lower)

    def _parse_issue(self, issue: dict, repo: str) -> Bounty:
        """Parse a GitHub issue into a Bounty object."""
        labels = [l["name"] for l in issue.get("labels", [])]
        body = issue.get("body", "") or ""
        tier, domain, reward = self._extract_metadata(body, labels)
        return Bounty(
            number=issue["number"],
            title=issue.get("title", ""),
            body=body,
            repo=repo,
            labels=labels,
            tier=tier,
            domain=domain,
            reward=reward,
            url=issue.get("html_url", ""),
        )

    def _extract_metadata(self, body: str, labels: list[str]) -> tuple[str, str, str]:
        """Extract tier, domain, and reward from issue body/labels."""
        tier = ""
        for l in labels:
            ll = l.lower()
            if "tier" in ll or "t1" in ll or "t2" in ll or "t3" in ll:
                tier = l
                break
        # Try body extraction
        tier_match = re.search(r"\*\*Tier.*?:\*\*\s*(\S+)", body, re.IGNORECASE)
        if tier_match:
            tier = tier_match.group(1)
        domain_match = re.search(r"\*\*Domain.*?:\*\*\s*(\S+)", body, re.IGNORECASE)
        domain = domain_match.group(1) if domain_match else ""
        reward_match = re.search(r"\*\*Reward.*?:\*\*\s*(.+?)[\n|]", body, re.IGNORECASE)
        reward = reward_match.group(1).strip() if reward_match else ""
        return tier, domain, reward