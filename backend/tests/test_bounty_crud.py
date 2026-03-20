"""API tests for bounty CRUD endpoints."""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import get_db
from app.main import app
from app.models.bounty import Base, BountyDB


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test",
)


@pytest_asyncio.fixture
async def db_engine():
    """Create the test database engine."""

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
    """Create a test session."""

    session_factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """Create an API client with an overridden DB dependency."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def existing_bounty(db_session):
    """Seed one bounty for CRUD tests."""

    bounty = BountyDB(
        title="Initial bounty",
        description="Seed data for CRUD tests",
        tier=1,
        category="backend",
        status="open",
        reward_amount=1250.0,
        reward_token="FNDRY",
        skills=["python", "fastapi"],
        github_issue_number=3,
        github_repo="SolFoundry/solfoundry",
    )
    db_session.add(bounty)
    await db_session.commit()
    await db_session.refresh(bounty)
    return bounty


class TestBountyCRUDAPI:
    """CRUD coverage for bounty endpoints."""

    @pytest.mark.asyncio
    async def test_create_bounty(self, client):
        response = await client.post(
            "/api/bounties",
            json={
                "title": "Implement bounty CRUD",
                "description": "Add create, list, update, and delete endpoints",
                "tier": 2,
                "category": "backend",
                "reward_amount": 2500,
                "reward_token": "fndry",
                "skills": ["python", "fastapi", "python", " "],
                "github_issue_number": 3,
                "github_repo": "SolFoundry/solfoundry",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Implement bounty CRUD"
        assert data["status"] == "open"
        assert data["reward_token"] == "FNDRY"
        assert data["skills"] == ["python", "fastapi"]

    @pytest.mark.asyncio
    async def test_list_bounties(self, client, existing_bounty):
        response = await client.get("/api/bounties")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["id"] == str(existing_bounty.id)

    @pytest.mark.asyncio
    async def test_get_bounty(self, client, existing_bounty):
        response = await client.get(f"/api/bounties/{existing_bounty.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(existing_bounty.id)
        assert data["title"] == existing_bounty.title

    @pytest.mark.asyncio
    async def test_update_bounty(self, client, existing_bounty):
        response = await client.patch(
            f"/api/bounties/{existing_bounty.id}",
            json={
                "title": "Updated bounty title",
                "status": "claimed",
                "reward_amount": 3000,
                "skills": ["python", "sqlalchemy"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated bounty title"
        assert data["status"] == "claimed"
        assert data["reward_amount"] == 3000
        assert data["skills"] == ["python", "sqlalchemy"]

    @pytest.mark.asyncio
    async def test_delete_bounty(self, client, existing_bounty):
        response = await client.delete(f"/api/bounties/{existing_bounty.id}")
        assert response.status_code == 204

        fetch_response = await client.get(f"/api/bounties/{existing_bounty.id}")
        assert fetch_response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_bounty_not_found(self, client):
        response = await client.patch(
            "/api/bounties/00000000-0000-0000-0000-000000000000",
            json={"title": "Nope"},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_bounty_not_found(self, client):
        response = await client.delete("/api/bounties/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_bounty_validation_error(self, client):
        response = await client.post(
            "/api/bounties",
            json={
                "title": "Bad payload",
                "description": "Invalid category should fail validation",
                "category": "invalid",
            },
        )

        assert response.status_code == 422
