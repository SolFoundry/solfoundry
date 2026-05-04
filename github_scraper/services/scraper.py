"""GitHub issue scraper service with async support."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

import httpx

from github_scraper.models.config import RepoSource, ScraperConfig
from github_scraper.models.issue import ScrapedIssue
from github_scraper.utils.rate_limiter import RateLimiter
from github_scraper.utils.dedup import IssueDeduplicator

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


class GitHubScraper:
    """Async GitHub issue scraper.

    Features:
    - Token bucket rate limiting per repo
    - Automatic pagination handling
    - ETag-based conditional requests (skip unchanged repos)
    - Configurable label and state filters
    - Deduplication across repos
    """

    def __init__(self, config: ScraperConfig) -> None:
        self.config = config
        self.dedup = IssueDeduplicator()
        self._rate_limiters: dict[str, RateLimiter] = {}
        self._etags: dict[str, str] = {}
        self._client: Optional[httpx.AsyncClient] = None

        # Initialize per-repo rate limiters
        for repo in config.repos:
            self._rate_limiters[repo.full_name] = RateLimiter(
                requests_per_minute=repo.rate_limit_rpm
            )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SolFoundry-GitHub-Scraper/1.0",
            }
            if self.config.github_token:
                headers["Authorization"] = f"Bearer {self.config.github_token}"
            self._client = httpx.AsyncClient(
                headers=headers,
                timeout=30.0,
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def scrape_repo(self, repo: RepoSource) -> list[ScrapedIssue]:
        """Scrape all matching issues from a single repository."""
        limiter = self._rate_limiters.get(repo.full_name, RateLimiter())
        await limiter.acquire()

        client = await self._get_client()
        issues: list[ScrapedIssue] = []
        page = 1

        while True:
            params: dict = {
                "state": repo.state_filter,
                "per_page": 100,
                "page": page,
                "sort": "updated",
                "direction": "desc",
            }

            # Add label filter
            if repo.label_filter:
                params["labels"] = ",".join(repo.label_filter)

            url = f"{GITHUB_API}/repos/{repo.full_name}/issues"

            # Conditional request with ETag
            headers: dict = {}
            etag_key = f"{repo.full_name}:{repo.state_filter}"
            if etag_key in self._etags:
                headers["If-None-Match"] = self._etags[etag_key]

            try:
                resp = await client.get(url, params=params, headers=headers)
            except httpx.HTTPError as e:
                logger.error(f"HTTP error scraping {repo.full_name}: {e}")
                break

            if resp.status_code == 304:
                logger.info(f"{repo.full_name}: not modified (ETag), skipping")
                break

            if resp.status_code != 200:
                logger.error(f"{repo.full_name}: HTTP {resp.status_code}")
                break

            # Store ETag for conditional requests
            if etag := resp.headers.get("ETag"):
                self._etags[etag_key] = etag

            # Rate limit from response headers
            remaining = resp.headers.get("X-RateLimit-Remaining")
            if remaining and int(remaining) < 10:
                logger.warning(f"GitHub rate limit low: {remaining} remaining")
                await asyncio.sleep(60)

            data = resp.json()
            if not data:
                break

            for item in data:
                # Skip pull requests (GitHub API returns PRs as issues)
                if "pull_request" in item:
                    continue

                issue = ScrapedIssue(
                    source_repo=repo.full_name,
                    issue_number=item["number"],
                    title=item["title"],
                    body=item.get("body", "") or "",
                    state=item["state"],
                    labels=[lbl["name"] for lbl in item.get("labels", [])],
                    author=item.get("user", {}).get("login", ""),
                    created_at=datetime.fromisoformat(
                        item["created_at"].replace("Z", "+00:00")
                    ),
                    updated_at=datetime.fromisoformat(
                        item["updated_at"].replace("Z", "+00:00")
                    ),
                    comments_count=item.get("comments", 0),
                    url=item["url"],
                    html_url=item["html_url"],
                    assignees=[a["login"] for a in item.get("assignees", [])],
                )

                if not self.dedup.is_duplicate(issue):
                    self.dedup.mark_seen(issue)
                    issues.append(issue)

                if len(issues) >= self.config.max_issues_per_repo:
                    break

            # Check if there are more pages
            link_header = resp.headers.get("Link", "")
            if 'rel="next"' not in link_header:
                break

            page += 1
            await limiter.acquire()

        logger.info(f"Scraped {len(issues)} new issues from {repo.full_name}")
        return issues

    async def scrape_all(self) -> list[ScrapedIssue]:
        """Scrape all configured repos concurrently with rate limiting."""
        # Sort by priority (higher first)
        sorted_repos = sorted(self.config.repos, key=lambda r: r.priority, reverse=True)

        # Scrape concurrently (with per-repo rate limiting)
        tasks = [self.scrape_repo(repo) for repo in sorted_repos]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_issues: list[ScrapedIssue] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error scraping {sorted_repos[i].full_name}: {result}")
            else:
                all_issues.extend(result)

        logger.info(f"Total scraped: {len(all_issues)} unique issues from {len(sorted_repos)} repos")
        return all_issues
