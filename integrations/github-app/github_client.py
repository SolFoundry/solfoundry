"""GitHub API client for the AI Code Review GitHub App."""

import base64
import json
import logging
import time
from typing import Optional

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

logger = logging.getLogger(__name__)


class GitHubAppClient:
    """Handles GitHub App authentication and API interactions."""

    API_BASE = "https://api.github.com"

    def __init__(self, app_id: str, private_key: str, timeout: float = 15.0):
        self.app_id = app_id
        self.private_key = private_key
        self.timeout = timeout
        self._installation_tokens: dict[int, dict] = {}

    def _generate_jwt(self) -> str:
        """Create a short-lived JWT for GitHub App authentication."""
        import jwt as pyjwt
        now = int(time.time())
        payload = {
            "iat": now,
            "exp": now + (9 * 60),   # 9 minutes max
            "iss": self.app_id
        }
        private_key = serialization.load_pem_private_key(
            self.private_key.encode(), password=None
        )
        return pyjwt.encode(payload, private_key, algorithm="RS256")

    def _get_headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_installation_token(self, installation_id: int) -> str:
        """Get or refresh an installation access token (cached ~55 min)."""
        cache = self._installation_tokens.get(installation_id)
        if cache and cache["expires"] > time.time() + 60:
            return cache["token"]

        jwt = self._generate_jwt()
        url = f"{self.API_BASE}/app/installations/{installation_id}/access_tokens"
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, headers=self._get_headers(jwt))
            resp.raise_for_status()
            data = resp.json()
        token = data["token"]
        self._installation_tokens[installation_id] = {
            "token": token,
            "expires": time.time() + (data.get("expires_in", 3600) or 3600),
        }
        return token

    async def get_pull_request_diff(self, installation_id: int, repo: str, pr_number: int) -> str:
        """Fetch the unified diff for a pull request."""
        token = self._get_installation_token(installation_id)
        url = f"{self.API_BASE}/repos/{repo}/pulls/{pr_number}"
        headers = {**self._get_headers(token), "Accept": "application/vnd.github.v3.diff"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.text

    async def get_pull_request_files(self, installation_id: int, repo: str, pr_number: int) -> list[dict]:
        """List the files changed in a pull request."""
        token = self._get_installation_token(installation_id)
        url = f"{self.API_BASE}/repos/{repo}/pulls/{pr_number}/files?per_page=100"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._get_headers(token))
            resp.raise_for_status()
            return resp.json()

    async def get_repo_config(self, installation_id: int, repo: str) -> Optional[dict]:
        """Read .github/ai-code-review.yml from the repo, if it exists."""
        token = self._get_installation_token(installation_id)
        url = f"{self.API_BASE}/repos/{repo}/contents/.github/ai-code-review.yml"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._get_headers(token))
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            return json.loads(base64.b64decode(data["content"]).decode())

    async def submit_review(self, installation_id: int, repo: str, pr_number: int,
                            body: str, comments: list[dict], event: str = "COMMENT") -> None:
        """Submit a pull request review with comments."""
        token = self._get_installation_token(installation_id)
        url = f"{self.API_BASE}/repos/{repo}/pulls/{pr_number}/reviews"
        payload = {
            "body": body,
            "event": event,
            "comments": comments,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, headers=self._get_headers(token), json=payload)
            resp.raise_for_status()

    async def create_check_run(self, installation_id: int, repo: str,
                               head_sha: str, name: str, status: str,
                               conclusion: Optional[str] = None,
                               output: Optional[dict] = None) -> None:
        """Create or update a check run with review results."""
        token = self._get_installation_token(installation_id)
        url = f"{self.API_BASE}/repos/{repo}/check-runs"
        payload = {
            "head_sha": head_sha,
            "name": name,
            "status": status,
        }
        if conclusion:
            payload["conclusion"] = conclusion
        if output:
            payload["output"] = output
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, headers=self._get_headers(token), json=payload)
            resp.raise_for_status()
