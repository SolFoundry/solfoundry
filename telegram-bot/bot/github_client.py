"""GitHub API client for fetching bounty issues and leaderboard data."""
import logging
from datetime import datetime
from typing import Optional

import httpx

from bot.config import config
from bot.models import Bounty, LeaderboardEntry

logger = logging.getLogger(__name__)
GITHUB_API = "https://api.github.com"


class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or config.github_token
        self.repo = config.github_repo
        self.headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "SolFoundry-Telegram-Bot/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        with httpx.Client(timeout=30.0) as client:
            response = client.request(method, url, headers=self.headers, **kwargs)
            response.raise_for_status()
            return response

    def fetch_open_bounties(
        self, state: str = "open", per_page: int = 100,
    ) -> list[Bounty]:
        """Fetch all open issues tagged as bounties."""
        all_bounties = []
        page = 1
        bounty_labels = ["bounty-tier-1", "bounty-tier-2", "bounty-tier-3"]

        while True:
            params = {
                "state": state,
                "labels": ",".join(bounty_labels),
                "per_page": per_page,
                "page": page,
                "sort": "created",
                "direction": "desc",
            }
            url = f"{GITHUB_API}/repos/{self.repo}/issues"
            resp = self._request("GET", url, params=params)
            items = resp.json()
            if not items:
                break
            for item in items:
                if "pull_request" in item:
                    continue
                bounty = self._parse_bounty(item)
                if bounty:
                    all_bounties.append(bounty)
            if len(items) < per_page:
                break
            page += 1
        return all_bounties

    def fetch_bounty(self, issue_number: int) -> Optional[Bounty]:
        url = f"{GITHUB_API}/repos/{self.repo}/issues/{issue_number}"
        try:
            resp = self._request("GET", url)
            item = resp.json()
            if "pull_request" in item:
                return None
            return self._parse_bounty(item)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    def _parse_bounty(self, item: dict) -> Optional[Bounty]:
        try:
            labels = [l["name"] for l in item.get("labels", [])]
            if not any(l.startswith("bounty-tier-") for l in labels):
                return None
            created_at = item["created_at"]
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            updated_at = item["updated_at"]
            if isinstance(updated_at, str):
                updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            return Bounty(
                number=item["number"],
                title=item["title"],
                body=item.get("body") or "",
                state=item["state"],
                labels=labels,
                assignee=item.get("assignee", {}).get("login") if item.get("assignee") else None,
                created_at=created_at,
                updated_at=updated_at,
                html_url=item["html_url"],
            )
        except Exception as e:
            logger.warning("Failed to parse bounty #%s: %s", item.get("number"), e)
            return None

    def fetch_contributor_stats(self) -> list[LeaderboardEntry]:
        """Fetch leaderboard: tries SolFoundry API first, then GitHub GraphQL."""
        if config.solfoundry_api_url:
            try:
                return self._fetch_leaderboard_from_api()
            except Exception as e:
                logger.warning("API leaderboard failed: %s, falling back to GraphQL", e)
        return self._fetch_leaderboard_from_graphql()

    def _fetch_leaderboard_from_api(self) -> list[LeaderboardEntry]:
        url = f"{config.solfoundry_api_url}/leaderboard"
        resp = self._request("GET", url)
        data = resp.json()
        entries = []
        for i, item in enumerate(data[:20], 1):
            entries.append(LeaderboardEntry(
                rank=i,
                username=item.get("username", "unknown"),
                merged_count=item.get("merged_count", 0),
                total_reward=item.get("total_reward", 0),
                avatar_url=item.get("avatar_url"),
            ))
        return entries

    LEADERBOARD_QUERY = """
    query($owner: String!, $name: String!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  author { user { login avatarUrl } }
                }
              }
            }
          }
        }
      }
    }
    """

    def _fetch_leaderboard_from_graphql(self) -> list[LeaderboardEntry]:
        owner, name = self.repo.split("/")
        url = f"{GITHUB_API}/graphql"
        contributors: dict[str, int] = {}
        cursor = None

        for _ in range(5):
            variables = {"owner": owner, "name": name, "cursor": cursor}
            payload = {"query": self.LEADERBOARD_QUERY, "variables": variables}
            resp = self._request("POST", url, json=payload)
            data = resp.json()
            history = data.get("data", {}).get("repository", {}).get("defaultBranchRef", {})
            history = history.get("target", {}).get("history", {})
            nodes = history.get("nodes", [])
            page_info = history.get("pageInfo", {})
            for commit in nodes:
                author = commit.get("author", {})
                user = author.get("user")
                if user:
                    login = user.get("login")
                    if login:
                        contributors[login] = contributors.get(login, 0) + 1
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info.get("endCursor")

        sorted_contributors = sorted(contributors.items(), key=lambda x: -x[1])
        return [
            LeaderboardEntry(
                rank=i + 1,
                username=login,
                merged_count=count,
                total_reward=count * 100,
            )
            for i, (login, count) in enumerate(sorted_contributors[:20])
        ]
