"""SolFoundry API client for creating bounties."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import settings
from app.models import BountyCreateRequest

logger = logging.getLogger(__name__)


class SolFoundryClient:
    """Async client for the SolFoundry backend API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
    ):
        self.base_url = (base_url or settings.solfoundry_api_url).rstrip("/")
        self.token = token or settings.solfoundry_api_token
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=30.0,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def create_bounty(self, data: BountyCreateRequest) -> dict:
        """Create a new bounty via the SolFoundry API."""
        client = await self._get_client()
        resp = await client.post("/api/bounties", json=data.model_dump(exclude_none=True))
        if resp.status_code >= 400:
            logger.error(
                "Failed to create bounty: %d %s",
                resp.status_code,
                resp.text[:500],
            )
            resp.raise_for_status()
        return resp.json()

    async def update_bounty(self, bounty_id: str, data: dict) -> dict:
        """Update an existing bounty."""
        client = await self._get_client()
        resp = await client.patch(f"/api/bounties/{bounty_id}", json=data)
        if resp.status_code >= 400:
            logger.error(
                "Failed to update bounty %s: %d %s",
                bounty_id,
                resp.status_code,
                resp.text[:500],
            )
            resp.raise_for_status()
        return resp.json()

    async def search_bounties(self, github_issue_url: str) -> Optional[dict]:
        """Search for an existing bounty by GitHub issue URL."""
        client = await self._get_client()
        resp = await client.get(
            "/api/bounties/search",
            params={"q": github_issue_url, "per_page": 5},
        )
        if resp.status_code >= 400:
            return None
        data = resp.json()
        for item in data.get("items", []):
            if item.get("github_issue_url") == github_issue_url:
                return item
        return None

    async def health(self) -> bool:
        """Check if the SolFoundry API is healthy."""
        try:
            client = await self._get_client()
            resp = await client.get("/health")
            return resp.status_code == 200
        except Exception:
            return False