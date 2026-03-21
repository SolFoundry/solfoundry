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


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
