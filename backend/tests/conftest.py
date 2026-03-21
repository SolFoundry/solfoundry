"""Pytest configuration for backend tests.

Provides session-level event loop configuration and automatic rate limiter
reset between tests to prevent cross-test interference from the security
middleware.
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


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


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
