"""Tests for GitHub bi-directional sync (Issue #28).

Mocks httpx to verify the exact HTTP requests made to the GitHub API,
covering both sync directions, retry on failure, conflict resolution,
and the API router.
"""

import pytest
import httpx

from app.services.sync_service import (
    ConflictStrategy,
    SyncDirection,
    SyncStatus,
    _request_with_retry,
    _build_headers,
    resolve_conflict,
    reset_store,
    sync_bounty_to_github,
    sync_github_issue_to_platform,
    get_dashboard,
    get_sync_record,
)


@pytest.fixture(autouse=True)
def _clean():
    """Reset the in-memory sync log before each test."""
    reset_store()
    yield
    reset_store()


# ---------------------------------------------------------------------------
# Outbound: Platform -> GitHub (create issue)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_bounty_creates_github_issue():
    """Verify that syncing a bounty POSTs to /repos/{repo}/issues."""
    transport = httpx.MockTransport(
        lambda req: httpx.Response(
            201,
            json={"number": 42, "html_url": "https://github.com/test/repo/issues/42"},
        )
    )
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_bounty_to_github(
            bounty_id="b-001",
            title="Fix bug",
            description="Detailed description",
            repo="test/repo",
            token="ghp_test123",
            client=client,
        )

    assert record.status == SyncStatus.COMPLETED
    assert record.github_issue_number == 42
    assert record.github_response_status == 201
    assert record.github_request_url == "https://api.github.com/repos/test/repo/issues"
    assert record.attempts == 1

    # Verify it was logged in the dashboard
    dashboard = get_dashboard()
    assert dashboard.total == 1
    assert dashboard.completed == 1


# ---------------------------------------------------------------------------
# Outbound: Platform -> GitHub (update existing issue)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_bounty_updates_existing_issue():
    """Verify that syncing with existing_issue_number PATCHes the issue."""
    requests_made = []

    def handler(req: httpx.Request) -> httpx.Response:
        requests_made.append(req)
        return httpx.Response(200, json={"number": 7})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_bounty_to_github(
            bounty_id="b-002",
            title="Update title",
            description="New desc",
            repo="org/project",
            existing_issue_number=7,
            token="ghp_test",
            client=client,
        )

    assert record.status == SyncStatus.COMPLETED
    assert record.github_issue_number == 7
    assert len(requests_made) == 1
    assert requests_made[0].method == "PATCH"
    assert "/issues/7" in str(requests_made[0].url)


# ---------------------------------------------------------------------------
# Outbound: verify request body contains bounty data
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_request_body_contains_bounty_info():
    """Verify the POST body includes title, description, and labels."""
    import json as json_mod

    captured_body = {}

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal captured_body
        captured_body = json_mod.loads(req.content)
        return httpx.Response(201, json={"number": 1})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        await sync_bounty_to_github(
            bounty_id="b-body",
            title="My Bounty",
            description="Fix the thing",
            repo="test/repo",
            token="ghp_test",
            client=client,
        )

    assert captured_body["title"] == "[SolFoundry] My Bounty"
    assert "Fix the thing" in captured_body["body"]
    assert "b-body" in captured_body["body"]
    assert "solfoundry-sync" in captured_body["labels"]


# ---------------------------------------------------------------------------
# Outbound: verify Authorization header
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_sends_auth_header():
    """Verify Bearer token is sent in the Authorization header."""
    captured_headers = {}

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal captured_headers
        captured_headers = dict(req.headers)
        return httpx.Response(201, json={"number": 1})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        await sync_bounty_to_github(
            bounty_id="b-auth",
            title="T",
            description="D",
            repo="r/r",
            token="ghp_secret_token",
            client=client,
        )

    assert captured_headers["authorization"] == "Bearer ghp_secret_token"
    assert "github" in captured_headers["accept"]


# ---------------------------------------------------------------------------
# Inbound: GitHub -> Platform
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_github_issue_to_platform():
    """Verify that inbound sync GETs /repos/{repo}/issues/{number}."""
    requests_made = []

    def handler(req: httpx.Request) -> httpx.Response:
        requests_made.append(req)
        return httpx.Response(200, json={
            "number": 15,
            "title": "Bug report",
            "body": "Steps to reproduce...",
            "state": "open",
        })

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_github_issue_to_platform(
            issue_number=15,
            repo="org/repo",
            token="ghp_test",
            client=client,
        )

    assert record.status == SyncStatus.COMPLETED
    assert record.github_issue_number == 15
    assert record.github_response_status == 200
    assert len(requests_made) == 1
    assert requests_made[0].method == "GET"
    assert "/issues/15" in str(requests_made[0].url)


# ---------------------------------------------------------------------------
# Failure: 4xx from GitHub (not retried)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_handles_github_404():
    """A 404 from GitHub should fail immediately without retry."""
    call_count = 0

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(404, json={"message": "Not Found"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_github_issue_to_platform(
            issue_number=999,
            repo="org/repo",
            token="ghp_test",
            client=client,
        )

    assert record.status == SyncStatus.FAILED
    assert record.github_response_status == 404
    assert "404" in (record.last_error or "")
    # 4xx should NOT be retried
    assert call_count == 1


# ---------------------------------------------------------------------------
# Failure: 422 Unprocessable (not retried)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_handles_github_422():
    """A 422 from GitHub should fail immediately (validation error)."""
    call_count = 0

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(422, json={"message": "Validation Failed"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_bounty_to_github(
            bounty_id="b-422",
            title="Bad",
            description="Will fail",
            repo="test/repo",
            token="ghp_test",
            client=client,
        )

    assert record.status == SyncStatus.FAILED
    assert call_count == 1  # No retry on 4xx


# ---------------------------------------------------------------------------
# Retry: 5xx triggers exponential backoff
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_retry_on_server_error():
    """Verify retry with exponential backoff on 500 errors."""
    call_count = 0

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return httpx.Response(500, text="Internal Server Error")
        return httpx.Response(201, json={"number": 10})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_bounty_to_github(
            bounty_id="b-retry",
            title="Retry test",
            description="Should succeed on 3rd try",
            repo="test/repo",
            token="ghp_test",
            client=client,
        )

    assert record.status == SyncStatus.COMPLETED
    assert call_count == 3  # 2 failures + 1 success
    assert record.github_issue_number == 10


# ---------------------------------------------------------------------------
# Retry exhaustion: all attempts fail
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_retry_exhaustion():
    """When all retries fail, the record should be marked FAILED."""
    call_count = 0

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(503, text="Service Unavailable")

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        record = await sync_bounty_to_github(
            bounty_id="b-exhaust",
            title="Will fail",
            description="All retries fail",
            repo="test/repo",
            token="ghp_test",
            client=client,
        )

    assert record.status == SyncStatus.FAILED
    assert "503" in (record.last_error or "")
    # max_retries=3 means 4 total attempts (initial + 3 retries)
    assert call_count == 4


# ---------------------------------------------------------------------------
# Conflict resolution
# ---------------------------------------------------------------------------

def test_conflict_platform_wins():
    platform = {"title": "Platform", "updated_at": "2024-01-01T00:00:00Z"}
    github = {"title": "GitHub", "updated_at": "2024-06-01T00:00:00Z"}
    data, direction = resolve_conflict(platform, github, ConflictStrategy.PLATFORM_WINS)
    assert data["title"] == "Platform"
    assert direction == SyncDirection.PLATFORM_TO_GITHUB


def test_conflict_github_wins():
    platform = {"title": "Platform", "updated_at": "2024-06-01T00:00:00Z"}
    github = {"title": "GitHub", "updated_at": "2024-01-01T00:00:00Z"}
    data, direction = resolve_conflict(platform, github, ConflictStrategy.GITHUB_WINS)
    assert data["title"] == "GitHub"
    assert direction == SyncDirection.GITHUB_TO_PLATFORM


def test_conflict_latest_wins_platform_newer():
    platform = {"title": "Platform", "updated_at": "2024-06-01T00:00:00Z"}
    github = {"title": "GitHub", "updated_at": "2024-01-01T00:00:00Z"}
    data, direction = resolve_conflict(platform, github, ConflictStrategy.LATEST_WINS)
    assert data["title"] == "Platform"
    assert direction == SyncDirection.PLATFORM_TO_GITHUB


def test_conflict_latest_wins_github_newer():
    platform = {"title": "Platform", "updated_at": "2024-01-01T00:00:00Z"}
    github = {"title": "GitHub", "updated_at": "2024-06-01T00:00:00Z"}
    data, direction = resolve_conflict(platform, github, ConflictStrategy.LATEST_WINS)
    assert data["title"] == "GitHub"
    assert direction == SyncDirection.GITHUB_TO_PLATFORM


def test_conflict_latest_wins_equal_timestamps():
    """When timestamps are equal, platform wins (tie-breaker)."""
    ts = "2024-03-15T12:00:00Z"
    platform = {"title": "Platform", "updated_at": ts}
    github = {"title": "GitHub", "updated_at": ts}
    data, direction = resolve_conflict(platform, github, ConflictStrategy.LATEST_WINS)
    assert data["title"] == "Platform"
    assert direction == SyncDirection.PLATFORM_TO_GITHUB


# ---------------------------------------------------------------------------
# Auth: missing token
# ---------------------------------------------------------------------------

def test_build_headers_requires_token(monkeypatch):
    """Sync should fail clearly when no GITHUB_TOKEN is set."""
    monkeypatch.setenv("GITHUB_TOKEN", "")
    import app.services.sync_service as _mod
    monkeypatch.setattr(_mod, "GITHUB_TOKEN", "")
    with pytest.raises(ValueError, match="GITHUB_TOKEN is required"):
        _build_headers(token="")


def test_build_headers_with_explicit_token():
    headers = _build_headers(token="ghp_explicit")
    assert headers["Authorization"] == "Bearer ghp_explicit"
    assert "github" in headers["Accept"]


# ---------------------------------------------------------------------------
# Missing repo raises ValueError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_requires_repo(monkeypatch):
    """Sync should fail clearly when no repo is configured."""
    monkeypatch.setenv("GITHUB_SYNC_REPO", "")
    with pytest.raises(ValueError, match="repo is required"):
        await sync_bounty_to_github(
            bounty_id="b-norep", title="T", description="D", token="ghp_t",
        )


# ---------------------------------------------------------------------------
# Dashboard / record lookup
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dashboard_aggregation():
    """Dashboard should count completed and failed syncs correctly."""
    transport_ok = httpx.MockTransport(
        lambda req: httpx.Response(201, json={"number": 1})
    )
    transport_fail = httpx.MockTransport(
        lambda req: httpx.Response(404, json={"message": "Not Found"})
    )

    async with httpx.AsyncClient(transport=transport_ok) as c:
        await sync_bounty_to_github("b1", "T1", "D1", "r/r", token="t", client=c)
    async with httpx.AsyncClient(transport=transport_fail) as c:
        await sync_github_issue_to_platform(999, "r/r", token="t", client=c)

    dash = get_dashboard()
    assert dash.total == 2
    assert dash.completed == 1
    assert dash.failed == 1
    assert len(dash.recent) == 2


@pytest.mark.asyncio
async def test_get_sync_record():
    transport = httpx.MockTransport(
        lambda req: httpx.Response(201, json={"number": 5})
    )
    async with httpx.AsyncClient(transport=transport) as c:
        record = await sync_bounty_to_github("b9", "T", "D", "r/r", token="t", client=c)

    found = get_sync_record(record.id)
    assert found is not None
    assert found.id == record.id
    assert found.status == SyncStatus.COMPLETED

    assert get_sync_record("nonexistent") is None
