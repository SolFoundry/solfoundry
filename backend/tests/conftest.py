"""Pytest configuration for backend tests.

Sets up an in-memory SQLite database for test isolation and initializes
the schema once for the entire test session.  Auth is enabled (the
default) so tests must pass proper auth headers.
"""

import asyncio
import os

import pytest

# Set test database URL before importing app modules
# This must be done before any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-for-ci"

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
