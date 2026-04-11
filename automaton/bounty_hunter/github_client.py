"""
GitHub client for the Bounty Hunter Agent.
Handles all GitHub API interactions: listing bounties, reading issues,
creating branches, committing code, and submitting PRs.
"""

import os
import base64
import re
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class BountyTier(Enum):
    TIER_1 = "tier-1"
    TIER_2 = "tier-2"
    TIER_3 = "tier-3"


@dataclass
class Bounty:
    number: int
    title: str
    body: str
    labels: list[str]
    tier: Optional[BountyTier] = None
    reward: Optional[str] = None
    domain: Optional[str] = None
    assignee: Optional[str] = None
    state: str = "open"

    @classmethod
    def from_issue(cls, issue: dict) -> "Bounty":
        labels = [l.get("name", "") for l in issue.get("labels", [])]
        tier = None
        for label in labels:
            if "tier-1" in label.lower():
                tier = BountyTier.TIER_1
            elif "tier-2" in label.lower():
                tier = BountyTier.TIER_2
            elif "tier-3" in label.lower():
                tier = BountyTier.TIER_3

        reward_match = re.search(
            r"(?:reward[^\n:]*:\s*)?([\$€£]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*[MKmk]?\s*(?:USD|FNDRY|USDC|\$)?)",
            issue.get("body", ""),
            re.IGNORECASE,
        )
        reward = reward_match.group(1).strip() if reward_match else None

        domain_labels = ["agent", "frontend", "backend", "integration", "security", "devops"]
        domain = next((l for l in labels if l.lower() in domain_labels), None)

        return cls(
            number=issue.get("number"),
            title=issue.get("title", ""),
            body=issue.get("body", ""),
            labels=labels,
            tier=tier,
            reward=reward,
            domain=domain,
            assignee=issue.get("assignee", {}).get("login") if issue.get("assignee") else None,
            state=issue.get("state", "open"),
        )


@dataclass
class GitHubClient:
    """
    GitHub API client for bounty hunting operations.
    Reads token from GITHUB_TOKEN env var.
    """
    owner: str = "SolFoundry"
    repo: str = "solfoundry"
    token: str = field(default_factory=lambda: os.environ.get("GITHUB_TOKEN", ""))
    upstream_owner: str = "SolFoundry"
    upstream_repo: str = "solfoundry"

    def __post_init__(self):
        if not self.token:
            raise ValueError("GITHUB_TOKEN environment variable not set")
        self._headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _graphql_query(self, query: str, variables: dict = None) -> dict:
        """Execute a GraphQL query against the GitHub API."""
        import urllib.request
        import json
        
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        req = urllib.request.Request(
            "https://api.github.com/graphql",
            data=json.dumps(payload).encode(),
            headers=self._headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    def _rest_request(self, method: str, path: str, data: dict = None, params: dict = None) -> dict:
        """Execute a REST API request against the GitHub API."""
        import urllib.request
        import urllib.parse
        import json
        
        url = f"https://api.github.com/{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        
        payload = json.dumps(data).encode() if data else None
        req = urllib.request.Request(url, data=payload, headers=self._headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    def list_open_bounties(self, min_tier: str = "tier-1") -> list[Bounty]:
        """
        List all open bounty issues from the SolFoundry repo.
        Filter by minimum tier (default: tier-1 = all bounties).
        """
        all_issues = []
        page = 1
        per_page = 100
        
        while True:
            issues = self._rest_request(
                "GET",
                f"repos/{self.upstream_owner}/{self.upstream_repo}/issues",
                params={"state": "open", "labels": "bounty", "per_page": per_page, "page": page}
            )
            if not issues:
                break
            all_issues.extend(issues)
            if len(issues) < per_page:
                break
            page += 1

        bounties = [Bounty.from_issue(i) for i in all_issues]
        
        # Filter out PRs and assigned bounties
        bounties = [b for b in bounties if b.assignee is None]
        
        return bounties

    def get_issue(self, issue_number: int) -> dict:
        """Get a single issue by number."""
        return self._rest_request(
            "GET",
            f"repos/{self.upstream_owner}/{self.upstream_repo}/issues/{issue_number}"
        )

    def get_file_content(self, path: str, ref: str = "main") -> str:
        """Get the content of a file from the repo."""
        data = self._rest_request(
            "GET",
            f"repos/{self.upstream_owner}/{self.upstream_repo}/contents/{path}",
            params={"ref": ref}
        )
        return base64.b64decode(data["content"]).decode("utf-8")

    def create_branch(self, branch_name: str, from_ref: str = "main") -> str:
        """
        Create a new branch. Returns the branch name.
        """
        # Get the SHA of the base ref
        ref_data = self._rest_request(
            "GET",
            f"repos/{self.upstream_owner}/{self.upstream_repo}/git/refs/heads/{from_ref}"
        )
        sha = ref_data["object"]["sha"]
        
        # Create new branch
        self._rest_request(
            "POST",
            f"repos/{self.owner}/{self.repo}/git/refs",
            data={
                "ref": f"refs/heads/{branch_name}",
                "sha": sha
            }
        )
        return branch_name

    def update_file(self, path: str, content: str, message: str, branch: str, sha: str = None) -> dict:
        """
        Create or update a file in the repo.
        If sha is not provided, will try to get it first (for updates).
        """
        if sha is None:
            try:
                existing = self._rest_request(
                    "GET",
                    f"repos/{self.owner}/{self.repo}/contents/{path}",
                    params={"ref": branch}
                )
                sha = existing["sha"]
            except Exception:
                sha = None

        data = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch,
        }
        if sha:
            data["sha"] = sha

        return self._rest_request(
            "PUT",
            f"repos/{self.owner}/{self.repo}/contents/{path}",
            data=data
        )

    def create_pull_request(
        self,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main"
    ) -> dict:
        """
        Create a pull request from the fork to the upstream repo.
        """
        return self._rest_request(
            "POST",
            f"repos/{self.upstream_owner}/{self.upstream_repo}/pulls",
            data={
                "title": title,
                "body": body,
                "head": f"{self.owner}:{head_branch}",
                "base": base_branch,
            }
        )

    def add_pr_comment(self, pr_number: int, body: str) -> dict:
        """Add a comment to a pull request."""
        return self._rest_request(
            "POST",
            f"repos/{self.upstream_owner}/{self.upstream_repo}/issues/{pr_number}/comments",
            data={"body": body}
        )

    def get_pr(self, pr_number: int) -> dict:
        """Get a PR by number."""
        return self._rest_request(
            "GET",
            f"repos/{self.upstream_owner}/{self.upstream_repo}/pulls/{pr_number}"
        )

    def get_user_repos(self) -> list[dict]:
        """Get list of repos for the authenticated user."""
        repos = []
        page = 1
        while True:
            data = self._rest_request(
                "GET",
                "user/repos",
                params={"per_page": 100, "page": page, "sort": "updated"}
            )
            if not data:
                break
            repos.extend(data)
            if len(data) < 100:
                break
            page += 1
        return repos

    def fork_exists(self) -> bool:
        """Check if the fork exists."""
        try:
            self._rest_request("GET", f"repos/{self.owner}/{self.repo}")
            return True
        except Exception:
            return False
