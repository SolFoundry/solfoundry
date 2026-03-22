"""HTTP client that wraps the SolFoundry REST API.

All CLI commands delegate to this module for server communication.
The client uses ``httpx`` (already a project dependency) and attaches
the configured Bearer token to every authenticated request.

Raises typed exceptions so the CLI layer can display appropriate
error messages without leaking HTTP implementation details.
"""

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx

from app.cli.config import get_api_key, get_api_url, load_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Timeout configuration
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT_SECONDS = 30.0

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class ApiClientError(Exception):
    """Base exception for API client errors.

    Attributes:
        status_code: HTTP status code returned by the server (if any).
        detail: Human-readable error detail.
    """

    def __init__(self, detail: str, status_code: Optional[int] = None) -> None:
        """Initialise an API client error with detail and optional HTTP status.

        Args:
            detail: Human-readable error message.
            status_code: HTTP status code from the server response, if any.
        """
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class AuthenticationError(ApiClientError):
    """Raised when the server rejects the provided credentials."""

    pass


class NotFoundError(ApiClientError):
    """Raised when the requested resource does not exist."""

    pass


class ValidationError(ApiClientError):
    """Raised when the server rejects invalid input."""

    pass


class ServerError(ApiClientError):
    """Raised when the server returns an unexpected 5xx status."""

    pass


# ---------------------------------------------------------------------------
# Client class
# ---------------------------------------------------------------------------


class SolFoundryApiClient:
    """Synchronous HTTP client for the SolFoundry API.

    Uses the configured API URL and API key from the CLI configuration.
    All public methods return parsed JSON dictionaries or raise typed
    exceptions on failure.

    Args:
        api_url: Override the configured API base URL.
        api_key: Override the configured API key.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        """Initialise the API client with URL and authentication.

        Args:
            api_url: Override the configured API base URL. When ``None``,
                the URL is read from the CLI configuration file or environment.
            api_key: Override the configured API key. When ``None``,
                the key is read from the CLI configuration file or environment.
        """
        config = load_config()
        self._api_url = (api_url or get_api_url(config)).rstrip("/")
        self._api_key = api_key or config.get("api_key", "")
        self._client = httpx.Client(
            base_url=self._api_url,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    # -- Internal helpers ---------------------------------------------------

    def _auth_headers(self) -> Dict[str, str]:
        """Build authorization headers using the stored API key.

        Returns:
            Dict[str, str]: Headers dict with Bearer token.

        Raises:
            AuthenticationError: If no API key is configured.
        """
        if not self._api_key:
            raise AuthenticationError(
                "No API key configured. Run 'sf configure' or set SOLFOUNDRY_API_KEY.",
                status_code=401,
            )
        return {"Authorization": f"Bearer {self._api_key}"}

    def _handle_response(self, response: httpx.Response) -> Any:
        """Parse a server response and raise on error status codes.

        Args:
            response: The HTTP response to inspect.

        Returns:
            Parsed JSON body on success.

        Raises:
            AuthenticationError: On 401.
            NotFoundError: On 404.
            ValidationError: On 422.
            ServerError: On 5xx.
            ApiClientError: On any other non-2xx status.
        """
        if response.status_code in (200, 201):
            return response.json()

        if response.status_code == 204:
            return None

        # Try to extract detail from JSON error body
        detail = f"HTTP {response.status_code}"
        try:
            body = response.json()
            detail = body.get("detail", detail)
        except Exception:
            detail = response.text or detail

        if response.status_code == 401:
            raise AuthenticationError(detail, status_code=401)
        if response.status_code == 404:
            raise NotFoundError(detail, status_code=404)
        if response.status_code == 422:
            raise ValidationError(detail, status_code=422)
        if response.status_code >= 500:
            raise ServerError(detail, status_code=response.status_code)

        raise ApiClientError(detail, status_code=response.status_code)

    # -- Public API ---------------------------------------------------------

    def health(self) -> Dict[str, Any]:
        """Check server health (unauthenticated).

        Returns:
            Dict with ``status``, ``bounties``, ``contributors``, ``last_sync``.
        """
        response = self._client.get("/health")
        return self._handle_response(response)

    def list_bounties(
        self,
        *,
        status: Optional[str] = None,
        tier: Optional[str] = None,
        skills: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """List bounties with optional filtering and pagination.

        Args:
            status: Filter by bounty status (open, in_progress, completed, paid).
            tier: Filter by tier (t1, t2, t3 — mapped to 1, 2, 3).
            skills: Comma-separated skill filter.
            category: Filter by category (frontend, backend, etc.).
            skip: Pagination offset.
            limit: Page size (1-100).

        Returns:
            Dict containing ``items``, ``total``, ``skip``, ``limit``.
        """
        params: Dict[str, Any] = {"skip": skip, "limit": limit}
        if status:
            params["status"] = status
        if tier:
            tier_map = {"t1": "1", "t2": "2", "t3": "3", "1": "1", "2": "2", "3": "3"}
            mapped = tier_map.get(tier.lower())
            if not mapped:
                raise ValidationError(
                    f"Invalid tier '{tier}'. Use t1, t2, or t3.",
                    status_code=422,
                )
            params["tier"] = mapped
        if skills:
            params["skills"] = skills
        if category:
            params["category"] = category

        response = self._client.get("/api/bounties", params=params)
        return self._handle_response(response)

    def get_bounty(self, bounty_id: str) -> Dict[str, Any]:
        """Get a single bounty by ID.

        Args:
            bounty_id: The UUID of the bounty.

        Returns:
            Full bounty detail dictionary.

        Raises:
            NotFoundError: If the bounty does not exist.
        """
        response = self._client.get(f"/api/bounties/{bounty_id}")
        return self._handle_response(response)

    def claim_bounty(self, bounty_id: str) -> Dict[str, Any]:
        """Claim a bounty by transitioning it to ``in_progress``.

        This is an authenticated mutation that sets the bounty status
        to ``in_progress``, indicating the caller is working on it.

        Args:
            bounty_id: The UUID of the bounty to claim.

        Returns:
            Updated bounty detail dictionary.

        Raises:
            AuthenticationError: If the API key is missing or invalid.
            NotFoundError: If the bounty does not exist.
            ApiClientError: If the status transition is invalid.
        """
        headers = self._auth_headers()
        response = self._client.patch(
            f"/api/bounties/{bounty_id}",
            json={"status": "in_progress"},
            headers=headers,
        )
        return self._handle_response(response)

    def submit_solution(
        self,
        bounty_id: str,
        pr_url: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit a PR solution for a bounty.

        Args:
            bounty_id: The UUID of the bounty.
            pr_url: GitHub pull request URL.
            notes: Optional notes about the submission.

        Returns:
            Submission detail dictionary.

        Raises:
            AuthenticationError: If the API key is missing or invalid.
            NotFoundError: If the bounty does not exist.
            ValidationError: If the PR URL is invalid.
        """
        headers = self._auth_headers()
        payload: Dict[str, Any] = {
            "pr_url": pr_url,
            "submitted_by": self._api_key[:16],  # Use key prefix as submitter ID
        }
        if notes:
            payload["notes"] = notes
        response = self._client.post(
            f"/api/bounties/{bounty_id}/submit",
            json=payload,
            headers=headers,
        )
        return self._handle_response(response)

    def get_submissions(self, bounty_id: str) -> List[Dict[str, Any]]:
        """List submissions for a bounty.

        Args:
            bounty_id: The UUID of the bounty.

        Returns:
            List of submission dictionaries.

        Raises:
            NotFoundError: If the bounty does not exist.
        """
        response = self._client.get(f"/api/bounties/{bounty_id}/submissions")
        return self._handle_response(response)

    def search_bounties(
        self,
        query: str = "",
        *,
        status: Optional[str] = None,
        tier: Optional[int] = None,
        skills: Optional[str] = None,
        category: Optional[str] = None,
        sort: str = "newest",
        page: int = 1,
        per_page: int = 20,
    ) -> Dict[str, Any]:
        """Full-text search for bounties.

        Args:
            query: Search query string.
            status: Filter by status.
            tier: Filter by tier (1, 2, or 3).
            skills: Comma-separated skill filter.
            category: Filter by category.
            sort: Sort order (newest, reward_high, reward_low, deadline, etc.).
            page: Page number (1-based).
            per_page: Results per page.

        Returns:
            Dict containing ``items``, ``total``, ``page``, ``per_page``, ``query``.
        """
        params: Dict[str, Any] = {
            "q": query,
            "sort": sort,
            "page": page,
            "per_page": per_page,
        }
        if status:
            params["status"] = status
        if tier:
            params["tier"] = tier
        if skills:
            params["skills"] = skills
        if category:
            params["category"] = category
        response = self._client.get("/api/bounties/search", params=params)
        return self._handle_response(response)

    def close(self) -> None:
        """Close the underlying HTTP client and release connections."""
        self._client.close()
