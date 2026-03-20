"""GitHub bi-directional sync service (Issue #28).

Handles Platform-to-GitHub and GitHub-to-Platform synchronization of bounties
and issues with conflict resolution, retry logic, and audit logging.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GITHUB_API_BASE = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
DEFAULT_REPO = os.getenv("GITHUB_SYNC_REPO", "")
MAX_RETRIES = int(os.getenv("SYNC_MAX_RETRIES", "3"))
RETRY_BASE_DELAY = float(os.getenv("SYNC_RETRY_BASE_DELAY", "1.0"))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class SyncDirection(str, Enum):
    PLATFORM_TO_GITHUB = "platform_to_github"
    GITHUB_TO_PLATFORM = "github_to_platform"


class SyncStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"


class ConflictStrategy(str, Enum):
    PLATFORM_WINS = "platform_wins"
    GITHUB_WINS = "github_wins"
    LATEST_WINS = "latest_wins"


class SyncRecord(BaseModel):
    """Tracks a single sync operation with full audit trail."""
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    direction: SyncDirection
    status: SyncStatus = SyncStatus.PENDING
    bounty_id: Optional[str] = None
    github_issue_number: Optional[int] = None
    repo: str = ""
    attempts: int = 0
    last_error: Optional[str] = None
    github_request_url: Optional[str] = None
    github_response_status: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class SyncRequest(BaseModel):
    """Inbound request to trigger a sync."""
    bounty_id: str
    repo: str = ""
    direction: SyncDirection = SyncDirection.PLATFORM_TO_GITHUB
    conflict_strategy: ConflictStrategy = ConflictStrategy.LATEST_WINS


class SyncResponse(BaseModel):
    """Response after a sync operation."""
    sync_id: str
    status: SyncStatus
    direction: SyncDirection
    github_issue_number: Optional[int] = None
    github_request_url: Optional[str] = None
    github_response_status: Optional[int] = None
    error: Optional[str] = None


class SyncDashboard(BaseModel):
    """Aggregated sync health overview."""
    total: int = 0
    completed: int = 0
    failed: int = 0
    conflicts: int = 0
    recent: list[SyncRecord] = []


# ---------------------------------------------------------------------------
# In-memory store (matches existing codebase pattern, e.g. bounty_service)
# ---------------------------------------------------------------------------

_sync_log: dict[str, SyncRecord] = {}


def reset_store() -> None:
    """Clear sync log. Used by tests."""
    _sync_log.clear()


# ---------------------------------------------------------------------------
# HTTP helpers with retry
# ---------------------------------------------------------------------------

def _build_headers(token: str = "") -> dict[str, str]:
    t = token or GITHUB_TOKEN
    if not t:
        raise ValueError("GITHUB_TOKEN is required for sync operations")
    return {
        "Authorization": f"Bearer {t}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def _request_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    json: dict[str, Any] | None = None,
    headers: dict[str, str],
    max_retries: int = MAX_RETRIES,
    base_delay: float = RETRY_BASE_DELAY,
) -> httpx.Response:
    """Execute an HTTP request with exponential backoff retry.

    Retries on 5xx, 429 (rate-limit), and network errors.
    Raises immediately on 4xx client errors (not retryable).
    """
    last_exc: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            resp = await client.request(
                method, url, json=json, headers=headers, timeout=30.0,
            )
            # 4xx (except 429) -> not retryable, raise immediately
            if 400 <= resp.status_code < 500 and resp.status_code != 429:
                resp.raise_for_status()

            # 429 or 5xx -> retryable
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        "Retryable %d from %s (attempt %d/%d, next in %.1fs)",
                        resp.status_code, url, attempt + 1, max_retries + 1, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                resp.raise_for_status()

            return resp

        except httpx.HTTPStatusError:
            raise
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as exc:
            last_exc = exc
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    "Network error on %s (attempt %d/%d): %s",
                    url, attempt + 1, max_retries + 1, exc,
                )
                await asyncio.sleep(delay)
                continue
            raise

    # Should not reach here, but satisfy type checker
    raise last_exc or RuntimeError("Retry loop exited unexpectedly")


# ---------------------------------------------------------------------------
# Conflict resolution
# ---------------------------------------------------------------------------

def resolve_conflict(
    platform_data: dict[str, Any],
    github_data: dict[str, Any],
    strategy: ConflictStrategy,
) -> tuple[dict[str, Any], SyncDirection]:
    """Determine which side wins when both have changed.

    Returns (winning_data, direction_to_apply).
    """
    if strategy == ConflictStrategy.PLATFORM_WINS:
        return platform_data, SyncDirection.PLATFORM_TO_GITHUB

    if strategy == ConflictStrategy.GITHUB_WINS:
        return github_data, SyncDirection.GITHUB_TO_PLATFORM

    # LATEST_WINS: compare updated_at timestamps
    p_time = platform_data.get("updated_at") or ""
    g_time = github_data.get("updated_at") or ""
    if p_time >= g_time:
        return platform_data, SyncDirection.PLATFORM_TO_GITHUB
    return github_data, SyncDirection.GITHUB_TO_PLATFORM


# ---------------------------------------------------------------------------
# Core sync operations
# ---------------------------------------------------------------------------

async def sync_bounty_to_github(
    bounty_id: str,
    title: str,
    description: str,
    repo: str = "",
    *,
    existing_issue_number: int | None = None,
    token: str = "",
    client: httpx.AsyncClient | None = None,
) -> SyncRecord:
    """Push a platform bounty to GitHub as an issue (create or update).

    Makes a real HTTP call to the GitHub Issues API and records the
    full request URL and response status for audit.
    """
    target_repo = repo or DEFAULT_REPO
    if not target_repo:
        raise ValueError("repo is required (set GITHUB_SYNC_REPO or pass explicitly)")

    record = SyncRecord(
        direction=SyncDirection.PLATFORM_TO_GITHUB,
        bounty_id=bounty_id,
        repo=target_repo,
        github_issue_number=existing_issue_number,
    )
    record.status = SyncStatus.IN_PROGRESS
    _sync_log[record.id] = record

    headers = _build_headers(token)
    body = {
        "title": f"[SolFoundry] {title}",
        "body": f"{description}\n\n---\n_Synced from SolFoundry bounty {bounty_id}_",
        "labels": ["solfoundry-sync"],
    }

    owns_client = client is None
    http = client or httpx.AsyncClient()
    try:
        if existing_issue_number:
            url = f"{GITHUB_API_BASE}/repos/{target_repo}/issues/{existing_issue_number}"
            resp = await _request_with_retry(
                http, "PATCH", url, json=body, headers=headers,
            )
        else:
            url = f"{GITHUB_API_BASE}/repos/{target_repo}/issues"
            resp = await _request_with_retry(
                http, "POST", url, json=body, headers=headers,
            )

        data = resp.json()
        record.github_request_url = url
        record.github_response_status = resp.status_code
        record.github_issue_number = data.get("number", existing_issue_number)
        record.status = SyncStatus.COMPLETED
        record.completed_at = datetime.now(timezone.utc)
        record.attempts += 1
        logger.info(
            "Synced bounty %s to GitHub #%s (%d)",
            bounty_id, record.github_issue_number, resp.status_code,
        )

    except httpx.HTTPStatusError as exc:
        record.status = SyncStatus.FAILED
        record.last_error = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        record.github_request_url = str(exc.request.url)
        record.github_response_status = exc.response.status_code
        record.attempts += 1
        logger.error("Sync failed for bounty %s: %s", bounty_id, record.last_error)

    except (httpx.ConnectError, httpx.ReadTimeout) as exc:
        record.status = SyncStatus.FAILED
        record.last_error = f"Network error: {exc}"
        record.attempts += 1
        logger.error("Sync network error for bounty %s: %s", bounty_id, exc)

    finally:
        if owns_client:
            await http.aclose()

    _sync_log[record.id] = record
    return record


async def sync_github_issue_to_platform(
    issue_number: int,
    repo: str = "",
    *,
    token: str = "",
    client: httpx.AsyncClient | None = None,
) -> SyncRecord:
    """Pull a GitHub issue into the platform (inbound sync).

    Fetches the issue via the GitHub API so the caller can
    create or update the corresponding local bounty.
    """
    target_repo = repo or DEFAULT_REPO
    if not target_repo:
        raise ValueError("repo is required (set GITHUB_SYNC_REPO or pass explicitly)")

    record = SyncRecord(
        direction=SyncDirection.GITHUB_TO_PLATFORM,
        github_issue_number=issue_number,
        repo=target_repo,
    )
    record.status = SyncStatus.IN_PROGRESS
    _sync_log[record.id] = record

    headers = _build_headers(token)
    url = f"{GITHUB_API_BASE}/repos/{target_repo}/issues/{issue_number}"

    owns_client = client is None
    http = client or httpx.AsyncClient()
    try:
        resp = await _request_with_retry(http, "GET", url, headers=headers)
        record.github_request_url = url
        record.github_response_status = resp.status_code
        record.status = SyncStatus.COMPLETED
        record.completed_at = datetime.now(timezone.utc)
        record.attempts += 1
        logger.info("Fetched GitHub issue #%d from %s", issue_number, target_repo)

    except httpx.HTTPStatusError as exc:
        record.status = SyncStatus.FAILED
        record.last_error = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        record.github_request_url = str(exc.request.url)
        record.github_response_status = exc.response.status_code
        record.attempts += 1

    except (httpx.ConnectError, httpx.ReadTimeout) as exc:
        record.status = SyncStatus.FAILED
        record.last_error = f"Network error: {exc}"
        record.attempts += 1

    finally:
        if owns_client:
            await http.aclose()

    _sync_log[record.id] = record
    return record


# ---------------------------------------------------------------------------
# Dashboard / query
# ---------------------------------------------------------------------------

def get_sync_record(sync_id: str) -> SyncRecord | None:
    """Look up a sync record by ID."""
    return _sync_log.get(sync_id)


def get_dashboard(limit: int = 20) -> SyncDashboard:
    """Return aggregated sync health metrics and recent records."""
    records = sorted(_sync_log.values(), key=lambda r: r.created_at, reverse=True)
    return SyncDashboard(
        total=len(records),
        completed=sum(1 for r in records if r.status == SyncStatus.COMPLETED),
        failed=sum(1 for r in records if r.status == SyncStatus.FAILED),
        conflicts=sum(1 for r in records if r.status == SyncStatus.CONFLICT),
        recent=records[:limit],
    )
