"""SolFoundry GitHub Issue Scraper — GitHub API integration."""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from .config import settings
from .models import GitHubIssue, GitHubRepo, ScrapeResult

logger = logging.getLogger(__name__)


class GitHubClient:
    """Client for interacting with the GitHub API."""

    # GitHub API IP for DNS resolution bypass
    GITHUB_API_IP = "20.205.243.168"

    def __init__(self, token: str | None = None) -> None:
        self.token = token or settings.github_token
        self.base_url = settings.github_api_base
        self._headers: dict[str, str] = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SolFoundry-Scraper/1.0",
            "Host": "api.github.com",  # Required when using IP directly
        }
        if self.token:
            self._headers["Authorization"] = f"Bearer {self.token}"

    def _resolve_url(self, path: str) -> str:
        """Build URL using resolved IP instead of hostname."""
        return f"https://{self.GITHUB_API_IP}{path}"

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any] | list[Any]:
        """Make a GET request to the GitHub API."""
        url = self._resolve_url(path)
        async with httpx.AsyncClient(verify=True) as client:
            resp = await client.get(url, headers=self._headers, params=params, timeout=30.0)
            resp.raise_for_status()
            return resp.json()

    async def _get_list(self, path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Get a paginated list from GitHub API."""
        result = await self._get(path, params)
        if isinstance(result, list):
            return result
        # Handle search API response
        if isinstance(result, dict) and "items" in result:
            return result["items"]
        return []

    async def search_issues(
        self,
        repo: str,
        labels: list[str] | None = None,
        state: str = "open",
        per_page: int = 50,
    ) -> list[GitHubIssue]:
        """Search for issues in a repository matching given labels."""
        query_parts = [f"repo:{repo}", f"state:{state}", "is:issue"]
        if labels:
            for label in labels:
                query_parts.append(f"label:{label}")

        query = " ".join(query_parts)
        params = {"q": query, "per_page": min(per_page, 100), "sort": "created", "order": "desc"}

        logger.info("Searching GitHub issues: q=%s", query)
        raw_items = await self._get_list("/search/issues", params)
        return [GitHubIssue(**item) for item in raw_items]

    async def get_issue(self, owner: str, repo: str, issue_number: int) -> GitHubIssue:
        """Get a single issue by repo and number."""
        raw = await self._get(f"/repos/{owner}/{repo}/issues/{issue_number}")
        return GitHubIssue(**raw)

    async def verify_webhook(self, payload: bytes, signature: str, secret: str) -> bool:
        """Verify a GitHub webhook signature."""
        if not secret:
            return True
        expected = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


class ScraperService:
    """Service that scrapes GitHub issues and posts them to SolFoundry."""

    def __init__(self, github: GitHubClient | None = None) -> None:
        self.github = github or GitHubClient()
        self._posted_issues: set[str] = set()
        self._scrape_count = 0
        self._last_scrape: str | None = None

    def _estimate_tier(self, labels: list[Any]) -> int:
        """Estimate bounty tier based on issue labels."""
        label_names = [l.name.lower() if hasattr(l, "name") else str(l).lower() for l in labels]
        if any("tier-3" in ln or "t3" in ln for ln in label_names):
            return 3
        if any("tier-2" in ln or "t2" in ln for ln in label_names):
            return 2
        if any("tier-1" in ln or "t1" in ln for ln in label_names):
            return 1
        # Default: tier 1 for good first issues, tier 2 for bounty
        if any("good first" in ln for ln in label_names):
            return 1
        if any("bounty" in ln for ln in label_names):
            return 2
        return 1

    def _estimate_reward(self, labels: list[Any], tier: int) -> float:
        """Estimate reward amount from labels."""
        label_names = [l.name.lower() if hasattr(l, "name") else str(l).lower() for l in labels]
        for ln in label_names:
            # Try to extract reward from label like "reward:50-mrg" or "50 MRG"
            import re
            match = re.search(r"reward[:\s]*(\d+)", ln)
            if match:
                return float(match.group(1))
            match = re.search(r"(\d+)\s*(?:mrg|sol|fndry|usd)", ln)
            if match:
                return float(match.group(1))
        # Default rewards by tier
        return {1: 100, 2: 500, 3: 1000}.get(tier, 100)

    def _build_description(self, issue: GitHubIssue) -> str:
        """Build a SolFoundry bounty description from a GitHub issue."""
        lines = [
            f"## Source: {issue.html_url}",
            "",
            f"**Issue #{issue.number}** from repository `{issue.repository_url.split('/')[-1]}`",
            "",
            "---",
            "",
        ]
        if issue.body:
            lines.append(issue.body)
        else:
            lines.append("No description provided.")

        lines.extend([
            "",
            "---",
            f"*Auto-imported from GitHub issue #{issue.number}*",
            f"*Labels: {', '.join(l.name for l in issue.labels)}*",
        ])
        return "\n".join(lines)

    async def scrape_repo(
        self,
        owner: str,
        repo: str,
        labels: list[str] | None = None,
        since: str | None = None,
    ) -> ScrapeResult:
        """Scrape a single repository for bounty-worthy issues."""
        issues = await self.github.search_issues(f"{owner}/{repo}", labels or ["bounty", "good first issue"])
        result = ScrapeResult(repo=f"{owner}/{repo}", issues_found=0, issues_posted=0, issues_skipped=0)

        for issue in issues:
            result.issues_found += 1
            issue_key = f"{owner}/{repo}#{issue.number}"

            if issue_key in self._posted_issues:
                result.issues_skipped += 1
                continue

            # Check if the issue has been claimed
            if issue.assignees:
                result.issues_skipped += 1
                continue

            tier = self._estimate_tier(issue.labels)
            reward = self._estimate_reward(issue.labels, tier)

            bounty = {
                "title": issue.title,
                "description": self._build_description(issue),
                "source_url": issue.html_url,
                "source_issue_number": issue.number,
                "source_repo": f"{owner}/{repo}",
                "reward_amount": reward,
                "tier": tier,
                "tags": [l.name for l in issue.labels],
            }

            # Post to SolFoundry API
            try:
                await self._post_bounty(bounty)
                self._posted_issues.add(issue_key)
                result.issues_posted += 1
                logger.info("Posted issue %s as bounty: %s", issue_key, issue.title)
            except Exception as e:
                error_msg = f"Failed to post {issue_key}: {e}"
                logger.error(error_msg)
                result.errors.append(error_msg)

        self._scrape_count += 1
        self._last_scrape = datetime.now(timezone.utc).isoformat()
        return result

    async def _post_bounty(self, bounty: dict[str, Any]) -> dict[str, Any]:
        """Post a bounty to the SolFoundry API."""
        url = f"{settings.solfoundry_api_url}/api/bounties"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if settings.solfoundry_api_token:
            headers["Authorization"] = f"Bearer {settings.solfoundry_api_token}"

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=bounty, headers=headers, timeout=30.0)
            resp.raise_for_status()
            return resp.json()

    @property
    def stats(self) -> dict[str, Any]:
        """Get scraper statistics."""
        return {
            "scraped_repos": self._scrape_count,
            "issues_posted": len(self._posted_issues),
            "last_scrape": self._last_scrape,
        }