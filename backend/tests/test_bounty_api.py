"""API endpoint tests for bounty search functionality.

Tests the public API endpoints with PostgreSQL test database.
Run with: pytest tests/test_bounty_api.py -v
"""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.models.bounty import BountyDB, Base
from app.database import get_db


# Test database URL (PostgreSQL required for FTS)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test",
)


@pytest_asyncio.fixture
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Create a test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """Create a test client with database dependency override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def sample_bounties(db_session):
    """Create sample bounties for testing."""
    bounties = [
        BountyDB(
            title="Implement search feature",
            description="Add full-text search to the bounty system using PostgreSQL",
            tier=1,
            category="backend",
            status="open",
            reward_amount=200000.0,
            skills=["python", "fastapi", "postgresql"],
        ),
        BountyDB(
            title="Fix login bug",
            description="Fix authentication issue on login page",
            tier=1,
            category="frontend",
            status="open",
            reward_amount=50000.0,
            skills=["javascript", "react"],
        ),
        BountyDB(
            title="Smart contract audit",
            description="Security audit for DeFi protocol",
            tier=2,
            category="smart_contract",
            status="open",
            reward_amount=500000.0,
            skills=["rust", "solana"],
        ),
        BountyDB(
            title="Documentation update",
            description="Update API documentation",
            tier=1,
            category="documentation",
            status="open",
            reward_amount=30000.0,
            skills=["markdown"],
        ),
        BountyDB(
            title="Completed task",
            description="This task is done",
            tier=1,
            category="backend",
            status="completed",
            reward_amount=10000.0,
            skills=["python"],
        ),
    ]

    for b in bounties:
        db_session.add(b)
    await db_session.commit()

    return bounties


class TestBountySearchAPI:
    """Tests for bounty search API endpoints."""

    @pytest.mark.asyncio
    async def test_search_bounties_default(self, client, sample_bounties):
        """Test default search returns open bounties."""
        response = await client.get("/api/bounties/search")

        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert data["total"] == 4  # Only open bounties

    @pytest.mark.asyncio
    async def test_search_bounties_with_query(self, client, sample_bounties):
        """Test search with query parameter."""
        response = await client.get("/api/bounties/search?q=search")

        assert response.status_code == 200
        data = response.json()

        # Should find bounty with "search" in title/description
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_search_bounties_filter_by_tier(self, client, sample_bounties):
        """Test filter by tier."""
        response = await client.get("/api/bounties/search?tier=1")

        assert response.status_code == 200
        data = response.json()

        # All results should be tier 1
        for item in data["items"]:
            assert item["tier"] == 1

    @pytest.mark.asyncio
    async def test_search_bounties_filter_by_category(self, client, sample_bounties):
        """Test filter by category."""
        response = await client.get("/api/bounties/search?category=backend")

        assert response.status_code == 200
        data = response.json()

        # All results should be backend category
        for item in data["items"]:
            assert item["category"] == "backend"

    @pytest.mark.asyncio
    async def test_search_bounties_filter_by_status(self, client, sample_bounties):
        """Test filter by status."""
        response = await client.get("/api/bounties/search?status=completed")

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 1
        assert data["items"][0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_search_bounties_filter_by_reward_range(
        self, client, sample_bounties
    ):
        """Test filter by reward range."""
        response = await client.get(
            "/api/bounties/search?reward_min=100000&reward_max=300000"
        )

        assert response.status_code == 200
        data = response.json()

        for item in data["items"]:
            assert 100000 <= item["reward_amount"] <= 300000

    @pytest.mark.asyncio
    async def test_search_bounties_filter_by_skills(self, client, sample_bounties):
        """Test filter by skills."""
        response = await client.get("/api/bounties/search?skills=python")

        assert response.status_code == 200
        data = response.json()

        # All results should have python skill
        for item in data["items"]:
            assert "python" in item["skills"]

    @pytest.mark.asyncio
    async def test_search_bounties_sort_by_reward_high(self, client, sample_bounties):
        """Test sort by reward high to low."""
        response = await client.get("/api/bounties/search?sort=reward_high")

        assert response.status_code == 200
        data = response.json()

        rewards = [item["reward_amount"] for item in data["items"]]
        assert rewards == sorted(rewards, reverse=True)

    @pytest.mark.asyncio
    async def test_search_bounties_sort_by_reward_low(self, client, sample_bounties):
        """Test sort by reward low to high."""
        response = await client.get("/api/bounties/search?sort=reward_low")

        assert response.status_code == 200
        data = response.json()

        rewards = [item["reward_amount"] for item in data["items"]]
        assert rewards == sorted(rewards)

    @pytest.mark.asyncio
    async def test_search_bounties_pagination(self, client, sample_bounties):
        """Test pagination."""
        # First page
        response1 = await client.get("/api/bounties/search?skip=0&limit=2")
        data1 = response1.json()

        assert len(data1["items"]) == 2
        assert data1["skip"] == 0
        assert data1["limit"] == 2

        # Second page
        response2 = await client.get("/api/bounties/search?skip=2&limit=2")
        data2 = response2.json()

        assert len(data2["items"]) == 2
        assert data2["skip"] == 2

    @pytest.mark.asyncio
    async def test_search_bounties_combined_filters(self, client, sample_bounties):
        """Test combined filters."""
        response = await client.get(
            "/api/bounties/search?tier=1&category=backend&reward_min=100000"
        )

        assert response.status_code == 200
        data = response.json()

        for item in data["items"]:
            assert item["tier"] == 1
            assert item["category"] == "backend"
            assert item["reward_amount"] >= 100000

    @pytest.mark.asyncio
    async def test_search_bounties_empty_result(self, client, sample_bounties):
        """Test search with no results."""
        response = await client.get("/api/bounties/search?q=nonexistentkeyword12345")

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 0
        assert len(data["items"]) == 0

    @pytest.mark.asyncio
    async def test_search_bounties_invalid_tier(self, client, sample_bounties):
        """Test with invalid tier value."""
        response = await client.get("/api/bounties/search?tier=5")

        # Should return validation error
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_bounties_invalid_sort(self, client, sample_bounties):
        """Test with invalid sort value."""
        response = await client.get("/api/bounties/search?sort=invalid")

        # Should return validation error
        assert response.status_code == 422


class TestBountyAutocompleteAPI:
    """Tests for bounty autocomplete API endpoint."""

    @pytest.mark.asyncio
    async def test_autocomplete_basic(self, client, sample_bounties):
        """Test basic autocomplete."""
        response = await client.get("/api/bounties/autocomplete?q=sea")

        assert response.status_code == 200
        data = response.json()

        assert "suggestions" in data

    @pytest.mark.asyncio
    async def test_autocomplete_short_query(self, client, sample_bounties):
        """Test autocomplete with short query."""
        response = await client.get("/api/bounties/autocomplete?q=a")

        # Should work with minimum 2 characters
        # Query "a" is too short, might return empty or validation error
        assert response.status_code in [200, 422]

    @pytest.mark.asyncio
    async def test_autocomplete_no_results(self, client, sample_bounties):
        """Test autocomplete with no matching results."""
        response = await client.get("/api/bounties/autocomplete?q=xyznonexistent")

        assert response.status_code == 200
        data = response.json()

        # May return empty suggestions
        assert "suggestions" in data


class TestBountyGetAPI:
    """Tests for single bounty retrieval."""

    @pytest.mark.asyncio
    async def test_get_bounty_not_found(self, client):
        """Test get bounty with invalid ID."""
        response = await client.get(
            "/api/bounties/00000000-0000-0000-0000-000000000000"
        )

        assert response.status_code == 404
