"""Pytest configuration for backend tests.

Provides session-level event loop configuration, automatic rate limiter
reset between tests to prevent cross-test interference from the security
middleware, and an in-memory SQLite database for test isolation.
"""

import asyncio
import os

import pytest
import sqlalchemy as sa

# Set test database URL before importing app modules
# Default to SQLite only if no environment variable is provided
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ["DATABASE_URL"] = DATABASE_URL
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("AUTH_ENABLED", "false")
os.environ.setdefault("OBSERVABILITY_ENABLE_BACKGROUND", "false")

# Configure asyncio mode for pytest
pytest_plugins = ("pytest_asyncio",)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Initialize database schema once for the entire test session."""
    from app.database import engine, Base
    import app.models.notification  # noqa: F401
    import app.models.user  # noqa: F401
    import app.models.bounty_table  # noqa: F401
    import app.models.dispute  # noqa: F401
    import app.models.submission  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture(autouse=True)
async def db_cleanup():
    """Clear all database tables between tests to ensure isolation."""
    from app.database import engine, Base

    async with engine.begin() as conn:
        # Disable foreign key checks for SQLite to allow unconditional deletion
        if "sqlite" in str(engine.url):
            await conn.execute(sa.text("PRAGMA foreign_keys = OFF"))
        
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
            
        if "sqlite" in str(engine.url):
            await conn.execute(sa.text("PRAGMA foreign_keys = ON"))
    yield
