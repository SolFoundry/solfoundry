"""
Submitter Agent — Pushes code and creates pull requests.

Responsibilities:
- Push feature branch to fork
- Create PR against upstream repo
- Include proper description with wallet address
- Monitor PR status for reviews and feedback
"""

import httpx
import json
from dataclasses import dataclass
from typing import Optional

from agent.analyst import ImplementationPlan


@dataclass
class PRResult:
    """Result of a PR submission."""
    pr_number: int
    pr_url: str
    status: str  # "created", "error", "conflict"


class SubmitterAgent:
    """Submits completed solutions as pull requests."""

    def __init__(self, config: dict):
        self.config = config
        self.github_token = config.get("github", {}).get("token", "")
        self.fork_prefix = config.get("github", {}).get("fork_prefix", "")
        self.wallet = config.get("wallet", {}).get("address", "")
        self.pr_template = config.get("github", {}).get("pr_template", "")
        self._client: Optional[httpx.Client] = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                base_url="https://api.github.com",
                headers={
                    "Authorization": f"token {self.github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=30.0,
            )
        return self._client

    def ensure_fork(self, repo: str) -> str:
        """Ensure a fork of the repo exists. Returns fork full name."""
        response = self.client.post(f"/repos/{repo}/forks")
        if response.status_code in (200, 202):
            data = response.json()
            return data.get("full_name", f"{self.fork_prefix}/{repo.split('/')[1]}")
        # Fork might already exist
        return f"{self.fork_prefix}/{repo.split('/')[1]}"

    def push_to_fork(self, repo_path: str, branch_name: str, fork_name: str) -> bool:
        """Push the feature branch to the fork."""
        import subprocess
        from pathlib import Path

        repo = Path(repo_path)
        fork_url = f"https://{self.github_token}@github.com/{fork_name}.git"

        try:
            # Add fork as remote if not present
            result = subprocess.run(
                ["git", "remote", "add", "fork", fork_url],
                cwd=repo, capture_output=True,
            )
        except Exception:
            pass  # Remote might already exist

        try:
            subprocess.run(
                ["git", "push", "-u", "fork", branch_name],
                cwd=repo, check=True, capture_output=True,
            )
            return True
        except subprocess.CalledProcessError:
            return False

    def create_pr(
        self,
        repo: str,
        plan: ImplementationPlan,
        fork_name: str,
    ) -> PRResult:
        """Create a pull request against the upstream repo."""
        head = f"{self.fork_prefix}:{plan.branch_name}"

        # Build PR body from template
        body = self.pr_template.format(
            description=plan.summary,
            test_instructions="\n".join(f"{i+1}. {t}" for i, t in enumerate(plan.test_instructions)),
            issue_number=plan.bounty_id,
            wallet_address=self.wallet,
        )

        response = self.client.post(
            f"/repos/{repo}/pulls",
            json={
                "title": f"feat: {plan.summary} (Closes #{plan.bounty_id})",
                "head": head,
                "base": "main",
                "body": body,
            },
        )

        if response.status_code == 201:
            data = response.json()
            return PRResult(
                pr_number=data["number"],
                pr_url=data["html_url"],
                status="created",
            )
        else:
            return PRResult(
                pr_number=0,
                pr_url="",
                status="error",
            )

    def check_pr_status(self, repo: str, pr_number: int) -> dict:
        """Check the status of a submitted PR."""
        response = self.client.get(f"/repos/{repo}/pulls/{pr_number}")
        if response.status_code == 200:
            data = response.json()
            return {
                "state": data.get("state"),
                "merged": data.get("merged", False),
                "mergeable": data.get("mergeable"),
                "review_comments": data.get("review_comments", 0),
            }
        return {"state": "unknown"}

    def submit(self, repo_path: str, plan: ImplementationPlan) -> PRResult:
        """Full submission workflow: fork, push, create PR."""
        fork_name = self.ensure_fork(plan.repo)

        if not self.push_to_fork(repo_path, plan.branch_name, fork_name):
            return PRResult(pr_number=0, pr_url="", status="error")

        return self.create_pr(plan.repo, plan, fork_name)

    def close(self):
        if self._client:
            self._client.close()

    def __del__(self):
        self.close()
