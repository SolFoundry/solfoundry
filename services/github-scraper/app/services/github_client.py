"""GitHub API client for fetching issues from repositories."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import settings
from app.models import GitHubIssue

logger = logging.getLogger(__name__)

GITHUB_API_BASE = settings.github_api_base
USER_AGENT = "SolFoundry-GitHub-Scraper/1.0"


class GitHubClient:
    """Async client for the GitHub REST API v3."""

    def __init__(
        self,
        token: Optional[str] = None,
        base_url: str = GITHUB_API_BASE,
    ):
        self.token = token or settings.github_token
        self.base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": USER_AGENT,
            }
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=30.0,
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def list_issues(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        labels: Optional[str] = None,
        per_page: int = 100,
        page: int = 1,
    ) -> list[GitHubIssue]:
        """List issues for a repository, optionally filtered by labels."""
        client = await self._get_client()
        params: dict[str, str | int] = {
            "state": state,
            "per_page": min(per_page, 100),
            "page": page,
        }
        if labels:
            params["labels"] = labels

        all_issues: list[GitHubIssue] = []
        while True:
            resp = await client.get(f"/repos/{owner}/{repo}/issues", params=params)
            if resp.status_code == 403:
                # Rate limited
                reset = int(resp.headers.get("X-RateLimit-Reset", 0))
                logger.warning(
                    "GitHub API rate limited. Reset at: %s", reset
                )
                break
            resp.raise_for_status()
            data = resp.json()

            if not data:
                break

            for item in data:
                # Skip pull requests (they show up in the issues endpoint)
                if "pull_request" in item:
                    continue
                all_issues.append(
                    GitHubIssue(
                        number=item["number"],
                        title=item["title"],
                        body=item.get("body") or "",
                        state=item["state"],
                        labels=[
                            lbl if isinstance(lbl, str) else lbl.get("name", "")
                            for lbl in item.get("labels", [])
                        ],
                        html_url=item["html_url"],
                        created_at=item.get("created_at", ""),
                        updated_at=item.get("updated_at", ""),
                        milestone=item.get("milestone", {}).get("title") if item.get("milestone") else None,
                        assignees=[
                            a.get("login", "") for a in item.get("assignees", [])
                        ],
                    )
                )

            if len(data) < params["per_page"]:
                break
            params["page"] += 1

        return all_issues

    async def get_issue(self, owner: str, repo: str, number: int) -> GitHubIssue:
        """Get a single issue by number."""
        client = await self._get_client()
        resp = await client.get(f"/repos/{owner}/{repo}/issues/{number}")
        resp.raise_for_status()
        item = resp.json()
        return GitHubIssue(
            number=item["number"],
            title=item["title"],
            body=item.get("body") or "",
            state=item["state"],
            labels=[
                lbl if isinstance(lbl, str) else lbl.get("name", "")
                for lbl in item.get("labels", [])
            ],
            html_url=item["html_url"],
            created_at=item.get("created_at", ""),
            updated_at=item.get("updated_at", ""),
            milestone=item.get("milestone", {}).get("title") if item.get("milestone") else None,
            assignees=[
                a.get("login", "") for a in item.get("assignees", [])
            ],
        )

    async def get_repo_labels(self, owner: str, repo: str) -> list[str]:
        """Get all labels defined in a repository."""
        client = await self._get_client()
        resp = await client.get(f"/repos/{owner}/{repo}/labels", params={"per_page": 100})
        resp.raise_for_status()
        return [lbl["name"] for lbl in resp.json()]