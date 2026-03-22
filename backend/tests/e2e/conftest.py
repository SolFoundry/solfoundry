"""Shared fixtures and configuration for the E2E integration test suite.

This module configures:
- In-memory SQLite database for test isolation (no external dependencies).
- FastAPI ``TestClient`` and ``httpx.AsyncClient`` for synchronous and
  async endpoint testing.
- Authentication override via FastAPI dependency injection so tests can
  bypass JWT validation while still exercising all route logic.
- Store cleanup between tests to prevent cross-test contamination.
- WebSocket manager initialisation with in-memory pub/sub adapter.

All fixtures follow the principle of test independence: each test starts
with a clean application state.
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import AsyncGenerator, Generator, Optional

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# Environment must be set before any app imports
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "e2e-test-secret-key")
os.environ.setdefault("AUTH_ENABLED", "true")

from app.api.auth import get_current_user, router as auth_router
from app.api.bounties import router as bounties_router
from app.api.contributors import router as contributors_router
from app.api.escrow import router as escrow_router
from app.api.leaderboard import router as leaderboard_router
from app.api.notifications import router as notifications_router
from app.api.payouts import router as payouts_router
from app.api.stats import router as stats_router
from app.api.websocket import router as websocket_router
from app.models.user import UserResponse
from app.services import bounty_service, contributor_service
from app.services.payout_service import reset_stores as reset_payout_stores
from app.services.websocket_manager import (
    InMemoryPubSubAdapter,
    WebSocketManager,
    manager as global_ws_manager,
)
from tests.e2e.factories import DEFAULT_WALLET, reset_counters


# ---------------------------------------------------------------------------
# Test user for dependency override
# ---------------------------------------------------------------------------

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_USER = UserResponse(
    id=TEST_USER_ID,
    github_id="test_github_e2e",
    username="e2e-test-user",
    email="e2e@test.solfoundry.org",
    avatar_url="https://avatars.githubusercontent.com/u/0",
    wallet_address=DEFAULT_WALLET,
    wallet_verified=True,
    created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    updated_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
)


async def _mock_get_current_user() -> UserResponse:
    """Return a fixed test user, bypassing JWT validation.

    This dependency override allows all authenticated endpoints to
    proceed without requiring real JWT tokens or database lookups.

    Returns:
        A deterministic ``UserResponse`` instance for testing.
    """
    return TEST_USER


# ---------------------------------------------------------------------------
# Application assembly -- mirrors ``app.main`` but without lifespan tasks
# ---------------------------------------------------------------------------


def _create_test_app() -> FastAPI:
    """Create a minimal FastAPI app with all routers for E2E testing.

    Mirrors the production ``app.main`` router registration but omits
    the lifespan (GitHub sync, periodic tasks) so tests run without
    external dependencies.

    Authentication is overridden with a mock user so tests do not
    require real JWT tokens.

    All routers are mounted at ``/api`` to match production URL structure.

    Returns:
        A fully-configured FastAPI application instance.
    """
    test_app = FastAPI(
        title="SolFoundry E2E Test",
        description="E2E test application instance",
        version="0.0.1-test",
    )
    # Mirror production routing: all routers under /api
    test_app.include_router(auth_router, prefix="/api")
    test_app.include_router(contributors_router, prefix="/api")
    test_app.include_router(bounties_router, prefix="/api")
    test_app.include_router(notifications_router, prefix="/api")
    test_app.include_router(leaderboard_router, prefix="/api")
    test_app.include_router(payouts_router, prefix="/api")
    test_app.include_router(escrow_router, prefix="/api")
    test_app.include_router(stats_router, prefix="/api")
    test_app.include_router(websocket_router)

    # Override the auth dependency so endpoints accept requests without JWT
    test_app.dependency_overrides[get_current_user] = _mock_get_current_user

    @test_app.get("/health")
    async def health_check():
        """Minimal health endpoint for connectivity tests."""
        return {"status": "ok"}

    # Add global exception handler to match production app behaviour.
    # Without this, unhandled exceptions (e.g. AttributeError from missing
    # service methods) would crash the test client instead of returning 500.
    from fastapi import Request
    from fastapi.responses import JSONResponse

    @test_app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Catch-all handler that mirrors production error handling."""
        return JSONResponse(
            status_code=500,
            content={
                "message": "Internal Server Error",
                "detail": str(exc),
                "code": "INTERNAL_ERROR",
            },
        )

    @test_app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        """Handle ValueErrors (validation) with structured JSON."""
        return JSONResponse(
            status_code=400,
            content={
                "message": str(exc),
                "code": "VALIDATION_ERROR",
            },
        )

    return test_app


app = _create_test_app()


# ---------------------------------------------------------------------------
# Database initialisation (session-scoped, runs once)
# ---------------------------------------------------------------------------

_test_loop = None


def _get_test_loop() -> asyncio.AbstractEventLoop:
    """Return a shared event loop for synchronous async execution.

    Returns:
        The shared asyncio event loop used across the test session.
    """
    global _test_loop
    if _test_loop is None or _test_loop.is_closed():
        _test_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_test_loop)
    return _test_loop


@pytest.fixture(scope="session", autouse=True)
def initialise_test_database():
    """Create database tables once for the entire test session.

    Uses an in-memory SQLite database so tests are fully isolated from
    any external PostgreSQL instance.
    """
    from app.database import init_db

    loop = _get_test_loop()
    loop.run_until_complete(init_db())
    yield
    global _test_loop
    if _test_loop and not _test_loop.is_closed():
        _test_loop.close()
        _test_loop = None


# ---------------------------------------------------------------------------
# Store cleanup (runs before every test)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_stores():
    """Reset all in-memory stores and factory counters between tests.

    Guarantees that each test function starts with a completely clean
    application state, preventing data leakage between tests.
    """
    bounty_service._bounty_store.clear()
    contributor_service._store.clear()
    reset_payout_stores()
    reset_counters()
    yield
    bounty_service._bounty_store.clear()
    contributor_service._store.clear()
    reset_payout_stores()


# ---------------------------------------------------------------------------
# HTTP clients
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide a synchronous ``TestClient`` for standard HTTP endpoint tests.

    Uses ``raise_server_exceptions=False`` so that 500 responses from
    unimplemented service methods are returned as HTTP responses rather
    than raising in the test process. This enables tests to verify error
    handling for endpoints whose service layer is not yet wired.

    Yields:
        A ``fastapi.testclient.TestClient`` bound to the test application.
    """
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def authenticated_user_id() -> str:
    """Generate a fresh deterministic authenticated user UUID.

    Uses the counter-based ``build_user_id()`` factory for reproducibility
    instead of ``uuid.uuid4()``.

    Returns:
        A UUID string suitable for use in ``X-User-ID`` or Bearer headers.
    """
    from tests.e2e.factories import build_user_id
    return build_user_id()


@pytest.fixture
def auth_headers(authenticated_user_id: str) -> dict:
    """Provide authentication headers using the Bearer token scheme.

    The test application overrides the auth dependency so this header
    is accepted without actual JWT validation.

    Args:
        authenticated_user_id: The UUID to use for authentication.

    Returns:
        Dictionary with the ``Authorization`` header set.
    """
    return {"Authorization": f"Bearer {authenticated_user_id}"}


# ---------------------------------------------------------------------------
# Async HTTP client
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async ``httpx.AsyncClient`` for concurrent test scenarios.

    Yields:
        An ``httpx.AsyncClient`` connected to the test application.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://e2e-test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# WebSocket manager (test-isolated)
# ---------------------------------------------------------------------------


@pytest.fixture
def websocket_manager() -> WebSocketManager:
    """Provide a fresh WebSocket manager with in-memory pub/sub.

    Returns:
        A ``WebSocketManager`` instance configured for testing.
    """
    manager = WebSocketManager()
    manager._adapter = InMemoryPubSubAdapter(manager)
    return manager


# ---------------------------------------------------------------------------
# Helper: create bounty via API and return response dict
# ---------------------------------------------------------------------------


def create_bounty_via_api(
    client: TestClient,
    payload: dict,
) -> dict:
    """Create a bounty through the REST API and return the response body.

    Args:
        client: The test HTTP client.
        payload: Bounty creation payload from ``factories.build_bounty_create_payload``.

    Returns:
        The parsed JSON response body.

    Raises:
        AssertionError: If the API returns a non-201 status code.
    """
    response = client.post("/api/bounties", json=payload)
    assert response.status_code == 201, (
        f"Bounty creation failed: {response.status_code} -- {response.text}"
    )
    return response.json()


def advance_bounty_status(
    client: TestClient,
    bounty_id: str,
    target_status: str,
) -> dict:
    """Transition a bounty through valid status changes to reach ``target_status``.

    Follows the valid transition graph:
    ``open`` -> ``in_progress`` -> ``completed`` -> ``paid``

    Args:
        client: The test HTTP client.
        bounty_id: The bounty to transition.
        target_status: The desired final status.

    Returns:
        The updated bounty response body.

    Raises:
        AssertionError: If any transition fails.
    """
    status_path = {
        "open": [],
        "in_progress": ["in_progress"],
        "completed": ["in_progress", "completed"],
        "paid": ["in_progress", "completed", "paid"],
    }
    if target_status not in status_path:
        raise ValueError(
            f"Unknown target status '{target_status}'. "
            f"Valid statuses: {sorted(status_path.keys())}"
        )
    transitions = status_path[target_status]
    result = {}
    for status in transitions:
        response = client.patch(
            f"/api/bounties/{bounty_id}",
            json={"status": status},
        )
        assert response.status_code == 200, (
            f"Status transition to '{status}' failed: "
            f"{response.status_code} -- {response.text}"
        )
        result = response.json()
    return result


# ---------------------------------------------------------------------------
# FakeWebSocket for WebSocket unit-level E2E tests
# ---------------------------------------------------------------------------


class FakeWebSocket:
    """Lightweight WebSocket double for testing the WebSocket manager.

    Simulates the Starlette ``WebSocket`` interface without requiring
    an actual HTTP connection, enabling fast unit-style E2E tests.
    """

    def __init__(self) -> None:
        """Initialise the fake WebSocket in a connected state."""
        from starlette.websockets import WebSocketState

        self.client_state = WebSocketState.CONNECTED
        self.accepted: bool = False
        self.closed: bool = False
        self.close_code: Optional[int] = None
        self.sent: list[dict] = []

    async def accept(self) -> None:
        """Accept the WebSocket connection."""
        self.accepted = True

    async def close(self, code: int = 1000) -> None:
        """Close the WebSocket connection with the given code.

        Args:
            code: WebSocket close code.
        """
        from starlette.websockets import WebSocketState

        self.closed = True
        self.close_code = code
        self.client_state = WebSocketState.DISCONNECTED

    async def send_json(self, data: dict) -> None:
        """Record a JSON message as sent.

        Args:
            data: The JSON object to send.
        """
        self.sent.append(data)

    async def send_text(self, data: str) -> None:
        """Record a text message as sent.

        Attempts to parse the data as JSON for structured assertions.
        Falls back to storing the raw string if the data is not valid JSON.

        Args:
            data: The text message to send.
        """
        try:
            self.sent.append(json.loads(data))
        except (json.JSONDecodeError, TypeError):
            self.sent.append({"_raw_text": data})
