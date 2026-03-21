"""Pytest configuration for backend tests.

Provides session-level event loop configuration, automatic rate limiter
reset between tests to prevent cross-test interference from the security
middleware, and an in-memory SQLite database for test isolation.
"""

import asyncio
import os

import pytest

# Set test database URL before importing app modules
# This must be done before any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-for-ci"
os.environ["AUTH_ENABLED"] = os.environ.get("AUTH_ENABLED", "false")

# Configure asyncio mode for pytest
pytest_plugins = ("pytest_asyncio",)

# Shared event loop for all tests that need synchronous async execution
_test_loop: asyncio.AbstractEventLoop = None  # type: ignore


def get_test_loop() -> asyncio.AbstractEventLoop:
    """Return the shared test event loop, creating it if needed.

    This ensures all synchronous test helpers (``run_async``) use the
    same event loop, avoiding 'no current event loop' errors when
    running the full test suite.

    Returns:
        The shared asyncio event loop for tests.
    """
    global _test_loop
    if _test_loop is None or _test_loop.is_closed():
        _test_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_test_loop)
    return _test_loop


def run_async(coro):
    """Run an async coroutine synchronously using the shared test loop.

    Convenience wrapper for test helpers that need to call async
    service functions from synchronous test code.

    Args:
        coro: An awaitable coroutine to execute.

    Returns:
        The result of the coroutine.
    """
    return get_test_loop().run_until_complete(coro)


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = get_test_loop()
    yield loop
    # Don't close here — init_test_db cleanup handles it


@pytest.fixture(autouse=True)
def reset_rate_limit_counters():
    """Reset rate limit counters between all tests to prevent 429 responses.

    The security middleware rate limiter tracks requests per IP across the
    test session. Without this reset, later tests may hit rate limits
    triggered by earlier tests.
    """
    try:
        from app.middleware.rate_limiter import _global_counter, _endpoint_counter
        _global_counter.reset()
        _endpoint_counter.reset()
    except ImportError:
        pass  # Rate limiter not available in all test configurations
    yield
    try:
        from app.middleware.rate_limiter import _global_counter, _endpoint_counter
        _global_counter.reset()
        _endpoint_counter.reset()
    except ImportError:
        pass


@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    """Initialize database schema once for the entire test session.

    Creates all SQLAlchemy tables in the in-memory SQLite database.
    """
    from app.database import init_db

    run_async(init_db())
    yield
    # Clean up the loop at session end
    global _test_loop
    if _test_loop and not _test_loop.is_closed():
        _test_loop.close()
        _test_loop = None
