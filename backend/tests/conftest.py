"""Pytest configuration and fixtures for the SolFoundry backend.

Provides:
- event_loop: async loop for pytest-asyncio
- app: FastAPI test client
- db: in-memory SQLite database session (with schema applied)
- client: AsyncClient for making requests
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.database import Base, async_session_factory, engine
from app.main import app as fastapi_app

# Use a temporary SQLite file for tests so all connections share the same DB
tmp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
tmp_db_path = f"sqlite+aiosqlite:///{tmp_db_file.name}"
os.environ["DATABASE_URL"] = tmp_db_path


def pytest_sessionfinish(session, exitstatus):
    """Cleanup the temporary database file."""
    try:
        tmp_db_file.close()
        os.unlink(tmp_db_file.name)
    except Exception:
        pass


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db():
    """Create a fresh database schema for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_factory() as session:
        yield session
        await session.rollback()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@asynccontextmanager
async def get_async_client():
    """AsyncClient that talks to the app without network."""
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture(scope="function")
async def client(db):
    """Provides an AsyncClient with DB cleared before each test."""
    async with get_async_client() as ac:
        yield ac
