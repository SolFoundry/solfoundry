"""
Scout Agent — Discovers and filters open bounties across platforms.

Responsibilities:
- Scan bounty platforms (GitHub issues, Algora, Opire) for open bounties
- Filter by tier, reward, comment count, tech stack, and deadline
- Score bounties by expected ROI (reward / estimated effort * competition)
- Return prioritized list of bounties to attempt
"""

import httpx
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BountyOpportunity:
    """A scored bounty opportunity."""
    platform: str
    issue_number: int
    repo: str
    title: str
    body: str
    tier: str
    reward_amount: int          # in smallest unit (e.g., $FNDRY lamports)
    reward_token: str
    comment_count: int
    labels: list[str] = field(default_factory=list)
    deadline: Optional[str] = None
    url: str = ""
    score: float = 0.0          # ROI score, higher = better

    @property
    def competition_level(self) -> str:
        if self.comment_count <= 3:
            return "low"
        if self.comment_count <= 10:
            return "medium"
        return "high"


class ScoutAgent:
    """Discovers and prioritizes bounty opportunities."""

    def __init__(self, config: dict):
        self.config = config
        self.platforms = config.get("platforms", {})
        self.filters = config.get("filters", {})
        self.github_token = config.get("github", {}).get("token", "")
        self._client: Optional[httpx.Client] = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            headers = {}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"
            self._client = httpx.Client(
                base_url="https://api.github.com",
                headers=headers,
                timeout=30.0,
            )
        return self._client

    def scan_solfoundry(self) -> list[BountyOpportunity]:
        """Scan SolFoundry GitHub repo for open bounties."""
        repo = self.platforms.get("solfoundry", {}).get("repo", "SolFoundry/solfoundry")
        bounties = []

        # Search for open issues with bounty label
        response = self.client.get(
            f"/repos/{repo}/issues",
            params={
                "state": "open",
                "labels": "bounty",
                "per_page": 100,
                "sort": "created",
                "direction": "desc",
            },
        )
        response.raise_for_status()

        for issue in response.json():
            # Parse tier from labels
            tier = "T1"
            for label in issue.get("labels", []):
                name = label.get("name", "")
                if name.startswith("tier-"):
                    tier = name.replace("tier-", "").upper()
                elif name == "T1" or name == "T2" or name == "T3":
                    tier = name

            # Parse reward from title or body
            reward = self._parse_reward(issue.get("title", ""), issue.get("body", ""))

            bounties.append(BountyOpportunity(
                platform="solfoundry",
                issue_number=issue["number"],
                repo=repo,
                title=issue.get("title", ""),
                body=issue.get("body", "")[:2000],
                tier=tier,
                reward_amount=reward,
                reward_token="$FNDRY",
                comment_count=issue.get("comments", 0),
                labels=[l.get("name", "") for l in issue.get("labels", [])],
                url=issue.get("html_url", ""),
            ))

        return bounties

    def scan_opire(self) -> list[BountyOpportunity]:
        """Scan Opire for open rewards."""
        bounties = []
        try:
            response = httpx.get(
                "https://api.opire.dev/rewards",
                params={"state": "open", "limit": 50},
                timeout=15.0,
            )
            response.raise_for_status()
            for reward in response.json():
                pending = reward.get("pendingPrice", {})
                value_cents = pending.get("value", 0)
                bounties.append(BountyOpportunity(
                    platform="opire",
                    issue_number=0,
                    repo=reward.get("githubIssue", {}).get("repository", ""),
                    title=reward.get("title", ""),
                    body=reward.get("description", "")[:2000],
                    tier="T2",
                    reward_amount=value_cents,  # in USD cents
                    reward_token="USD",
                    comment_count=reward.get("claimersCount", 0),
                    url=reward.get("url", ""),
                ))
        except Exception:
            pass  # Opire API may be unavailable

        return bounties

    def scan_all(self) -> list[BountyOpportunity]:
        """Scan all configured platforms."""
        all_bounties = []
        all_bounties.extend(self.scan_solfoundry())
        all_bounties.extend(self.scan_opire())
        return self.filter_and_score(all_bounties)

    def filter_and_score(self, bounties: list[BountyOpportunity]) -> list[BountyOpportunity]:
        """Apply filters and score bounties by ROI."""
        filters = self.filters
        preferred_tiers = filters.get("preferred_tiers", ["T1", "T2"])
        max_comments = filters.get("max_comments", 15)
        min_reward = filters.get("min_reward_fntry", 0)
        min_deadline_hours = filters.get("deadline_min_hours", 48)
        preferred_domains = filters.get("preferred_domains", [])

        filtered = []
        for b in bounties:
            # Tier filter
            if b.tier not in preferred_tiers:
                continue
            # Competition filter
            if b.comment_count > max_comments:
                continue
            # Reward filter
            if b.reward_token == "$FNDRY" and b.reward_amount < min_reward:
                continue
            # Score it
            b.score = self._calculate_score(b, preferred_domains)
            filtered.append(b)

        return sorted(filtered, key=lambda x: x.score, reverse=True)

    def _calculate_score(self, bounty: BountyOpportunity, preferred_domains: list[str]) -> float:
        """Calculate ROI score: higher reward + lower competition + domain match = higher score."""
        reward_factor = bounty.reward_amount / 100000  # Normalize to ~1-10 range
        competition_penalty = bounty.comment_count * 0.5
        domain_bonus = 2.0 if any(d in bounty.body.lower() for d in preferred_domains) else 0.0
        tier_bonus = {"T1": 1.0, "T2": 0.5, "T3": 0.2}.get(bounty.tier, 0.1)
        return max(0, reward_factor - competition_penalty + domain_bonus + tier_bonus)

    @staticmethod
    def _parse_reward(title: str, body: str) -> int:
        """Extract reward amount from title or body text."""
        import re
        # Look for patterns like "1M $FNDRY", "150K $FNDRY", "50000 $FNDRY"
        patterns = [
            r'(\d+(?:\.\d+)?)\s*M\s*\$\s*FNDRY',   # 1M $FNDRY
            r'(\d+(?:\.\d+)?)\s*K\s*\$\s*FNDRY',   # 150K $FNDRY
            r'(\d+)\s*\$\s*FNDRY',                   # 50000 $FNDRY
        ]
        for text in [title, body]:
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    val = float(match.group(1))
                    if 'M' in pattern:
                        return int(val * 1_000_000)
                    if 'K' in pattern:
                        return int(val * 1_000)
                    return int(val)
        return 0

    def close(self):
        if self._client:
            self._client.close()

    def __del__(self):
        self.close()
