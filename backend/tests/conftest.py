"""Pytest configuration for backend tests."""

import asyncio
import os

import pytest

# Configure asyncio mode for pytest
pytest_plugins = ("pytest_asyncio",)

# Skip test modules that require a live PostgreSQL database.
# These tests import app modules that attempt to establish a DB connection
# at module level. When no PostgreSQL server is running (e.g. in CI without
# a database service), collection fails with import errors.
_DB_TESTS = [
    "test_bounty_api.py",
    "test_bounty_edge_cases.py",
    "test_bounty_search.py",
    "test_notification_api.py",
    "test_webhook.py",
    "test_auth.py",
    "test_contributors.py",
    "test_leaderboard.py",
    "test_payouts.py",
]


def _db_available() -> bool:
    """Check whether a PostgreSQL database is reachable."""
    try:
        import asyncpg  # noqa: F401

        url = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost/solfoundry",
        )
        # Quick heuristic: if we can parse + resolve the host, it is
        # *probably* reachable. A full connection test would be better but
        # this keeps conftest lightweight.
        host = (
            url.split("@")[-1].split("/")[0].split(":")[0]
            if "@" in url
            else "localhost"
        )
        import socket

        socket.create_connection((host, 5432), timeout=2).close()
        return True
    except Exception:
        return False


if not _db_available():
    collect_ignore = _DB_TESTS


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
