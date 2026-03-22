"""Pytest configuration for backend tests.

Auth is enabled (the default) so tests must pass proper auth headers.
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


@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    """Initialize database schema once for the entire test session."""
    from app.database import init_db
    asyncio.run(init_db())
    yield


def run_async(coro):
    """Helper to run async functions in synchronous test code.
    
    Args:
        coro: A coroutine object to execute.
        
    Returns:
        The result of the coroutine.
    """
    return asyncio.get_event_loop().run_until_complete(coro)
