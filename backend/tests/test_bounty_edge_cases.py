"""Edge case and error handling tests for bounty search.

Tests boundary conditions, error scenarios, and complex filter combinations.
Run with: pytest tests/test_bounty_edge_cases.py -v
"""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.models.bounty import BountyDB
from app.database import Base, get_db


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test",
)


@pytest_asyncio.fixture
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

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
        """Handle override get db operation."""
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


class TestBoundaryConditions:
    """Tests for boundary conditions and limits."""

    @pytest.mark.asyncio
    async def test_search_limit_min(self, client):
        """Test minimum limit value (1)."""
        response = await client.get("/api/bounties/search?limit=1")

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 1

    @pytest.mark.asyncio
    async def test_search_limit_max(self, client):
        """Test maximum limit value (100)."""
        response = await client.get("/api/bounties/search?limit=100")

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 100

    @pytest.mark.asyncio
    async def test_search_limit_below_min(self, client):
        """Test limit below minimum (0)."""
        response = await client.get("/api/bounties/search?limit=0")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_limit_above_max(self, client):
        """Test limit above maximum (101)."""
        response = await client.get("/api/bounties/search?limit=101")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_skip_negative(self, client):
        """Test negative skip value."""
        response = await client.get("/api/bounties/search?skip=-1")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_tier_boundary(self, client):
        """Test tier boundary values."""
        # Tier 1 (min)
        response = await client.get("/api/bounties/search?tier=1")
        assert response.status_code == 200

        # Tier 3 (max)
        response = await client.get("/api/bounties/search?tier=3")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_tier_below_min(self, client):
        """Test tier below minimum (0)."""
        response = await client.get("/api/bounties/search?tier=0")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_tier_above_max(self, client):
        """Test tier above maximum (4)."""
        response = await client.get("/api/bounties/search?tier=4")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_reward_negative(self, client):
        """Test negative reward values."""
        response = await client.get("/api/bounties/search?reward_min=-100")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_reward_zero(self, client):
        """Test zero reward value (valid boundary)."""
        response = await client.get("/api/bounties/search?reward_min=0")

        assert response.status_code == 200


class TestInvalidInputs:
    """Tests for invalid input handling."""

    @pytest.mark.asyncio
    async def test_search_invalid_sort(self, client):
        """Test invalid sort value."""
        response = await client.get("/api/bounties/search?sort=invalid_sort")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_invalid_status(self, client):
        """Test invalid status value (still works, returns empty)."""
        response = await client.get("/api/bounties/search?status=invalid_status")

        # Should return 200 with empty results (status is just a string filter)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_search_invalid_category(self, client):
        """Test invalid category value."""
        response = await client.get("/api/bounties/search?category=nonexistent")

        # Should return 200 with empty results
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_get_bounty_invalid_uuid(self, client):
        """Test get bounty with malformed UUID."""
        response = await client.get("/api/bounties/not-a-uuid")

        assert response.status_code == 422


class TestComplexFilters:
    """Tests for complex filter combinations."""

    @pytest.mark.asyncio
    async def test_search_all_filters_combined(self, client, db_session):
        """Test all filters combined."""
        # Create test bounty
        bounty = BountyDB(
            title="Python Backend Search",
            description="Full-text search implementation",
            tier=1,
            category="backend",
            status="open",
            reward_amount=150000.0,
            skills=["python", "postgresql"],
        )
        db_session.add(bounty)
        await db_session.commit()

        response = await client.get(
            "/api/bounties/search?tier=1&category=backend&status=open&reward_min=100000&reward_max=200000&skills=python&sort=reward_high"
        )

        assert response.status_code == 200
        data = response.json()

        # Should find the bounty
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_search_multiple_skills(self, client, db_session):
        """Test search with multiple skills (comma-separated)."""
        bounty = BountyDB(
            title="Full Stack Task",
            description="Frontend and backend work",
            tier=2,
            category="backend",
            status="open",
            reward_amount=300000.0,
            skills=["python", "react", "postgresql"],
        )
        db_session.add(bounty)
        await db_session.commit()

        response = await client.get("/api/bounties/search?skills=python,react")

        assert response.status_code == 200
        data = response.json()

        # Should find bounties that have BOTH python AND react
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_search_reward_range_exclusive(self, client, db_session):
        """Test reward range filtering."""
        # Create bounties at boundaries
        bounties = [
            BountyDB(
                title="Low",
                description="D",
                tier=1,
                category="backend",
                status="open",
                reward_amount=100000.0,
            ),
            BountyDB(
                title="Mid",
                description="D",
                tier=1,
                category="backend",
                status="open",
                reward_amount=200000.0,
            ),
            BountyDB(
                title="High",
                description="D",
                tier=1,
                category="backend",
                status="open",
                reward_amount=300000.0,
            ),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()

        # Search for rewards between 100000 and 200000 (inclusive)
        response = await client.get(
            "/api/bounties/search?reward_min=100000&reward_max=200000"
        )

        assert response.status_code == 200
        data = response.json()

        # Should include Low (100000) and Mid (200000)
        assert data["total"] == 2


class TestQueryVariations:
    """Tests for various query string variations."""

    @pytest.mark.asyncio
    async def test_search_query_special_chars(self, client, db_session):
        """Test search query with special characters."""
        bounty = BountyDB(
            title="API v2.0 Implementation",
            description="Build REST API with JSON support",
            tier=1,
            category="backend",
            status="open",
            reward_amount=100000.0,
        )
        db_session.add(bounty)
        await db_session.commit()

        # Query with special characters
        response = await client.get("/api/bounties/search?q=API%20v2.0")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_query_empty(self, client):
        """Test search with empty query string."""
        response = await client.get("/api/bounties/search?q=")

        # Empty query should be ignored, return all open bounties
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_query_whitespace(self, client):
        """Test search with whitespace-only query."""
        response = await client.get("/api/bounties/search?q=%20%20%20")

        assert response.status_code == 200


class TestDefaultBehavior:
    """Tests for default filtering behaviors."""

    @pytest.mark.asyncio
    async def test_search_defaults_to_open_status(self, client, db_session):
        """Test that search defaults to open status."""
        # Create bounties with different statuses
        bounties = [
            BountyDB(
                title="Open Task",
                description="D",
                tier=1,
                category="backend",
                status="open",
                reward_amount=100000.0,
            ),
            BountyDB(
                title="Closed Task",
                description="D",
                tier=1,
                category="backend",
                status="completed",
                reward_amount=50000.0,
            ),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()

        response = await client.get("/api/bounties/search")

        assert response.status_code == 200
        data = response.json()

        # Should only return open bounties
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Open Task"

    @pytest.mark.asyncio
    async def test_search_defaults_to_newest_sort(self, client, db_session):
        """Test that search defaults to newest first."""
        import asyncio

        # Create bounties with delays to ensure different timestamps
        bounty1 = BountyDB(
            title="First Created",
            description="D",
            tier=1,
            category="backend",
            status="open",
            reward_amount=100000.0,
        )
        db_session.add(bounty1)
        await db_session.commit()

        await asyncio.sleep(0.1)  # Small delay

        bounty2 = BountyDB(
            title="Second Created",
            description="D",
            tier=1,
            category="backend",
            status="open",
            reward_amount=100000.0,
        )
        db_session.add(bounty2)
        await db_session.commit()

        response = await client.get("/api/bounties/search")

        assert response.status_code == 200
        data = response.json()

        # Newest should be first
        assert data["items"][0]["title"] == "Second Created"
