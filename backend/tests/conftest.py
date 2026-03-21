"""Pytest configuration for backend tests.

Auth is enabled (the default) so tests must pass proper auth headers.
"""

import asyncio
import os
import pytest

# Set test database URL before importing app modules
# This must be done before any app imports.
#
# Default behavior (unit tests): use in-memory SQLite.
# Integration behavior (CI): if `TEST_DATABASE_URL` is set, use it instead
# so the app + ORM exercise a real backend (e.g. Postgres).
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ["SECRET_KEY"] = "test-secret-key-for-ci"

# Configure asyncio mode for pytest
pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    """Initialize database schema once for the entire test session."""
    from app.database import init_db
    asyncio.run(init_db())
    yield
