"""Tests for bounty claiming functionality.

Tests the claim, unclaim, and claimant retrieval endpoints.
Run with: pytest tests/test_bounty_claim.py -v
"""

import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.models.bounty import BountyDB, BountyClaimHistoryDB, Base
from app.database import get_db


# Test database URL (PostgreSQL required)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test"
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
async def sample_bounty(db_session):
    """Create a sample open bounty for testing."""
    bounty = BountyDB(
        title="Test Bounty for Claiming",
        description="A test bounty to verify claiming functionality",
        tier=1,
        category="backend",
        status="open",
        reward_amount=100000.0,
        skills=["python", "fastapi"],
    )
    db_session.add(bounty)
    await db_session.commit()
    await db_session.refresh(bounty)
    return bounty


@pytest_asyncio.fixture
async def claimed_bounty(db_session):
    """Create a sample claimed bounty for testing."""
    claimant_id = str(uuid.uuid4())
    bounty = BountyDB(
        title="Already Claimed Bounty",
        description="A bounty that is already claimed",
        tier=1,
        category="backend",
        status="in_progress",
        reward_amount=50000.0,
        claimant_id=claimant_id,
        skills=["python"],
    )
    db_session.add(bounty)
    await db_session.commit()
    await db_session.refresh(bounty)
    return bounty


class TestBountyClaim:
    """Tests for bounty claim endpoint."""
    
    @pytest.mark.asyncio
    async def test_claim_bounty_success(self, client, sample_bounty):
        """Test successfully claiming an open bounty."""
        claimant_id = str(uuid.uuid4())
        
        response = await client.post(
            f"/api/bounties/{sample_bounty.id}/claim",
            json={"claimant_id": claimant_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "in_progress"
        assert data["claimant_id"] == claimant_id
        assert data["id"] == str(sample_bounty.id)
    
    @pytest.mark.asyncio
    async def test_claim_bounty_not_found(self, client):
        """Test claiming a non-existent bounty."""
        fake_id = str(uuid.uuid4())
        
        response = await client.post(
            f"/api/bounties/{fake_id}/claim",
            json={"claimant_id": str(uuid.uuid4())}
        )
        
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_claim_bounty_already_claimed(self, client, claimed_bounty):
        """Test claiming a bounty that is already claimed."""
        new_claimant_id = str(uuid.uuid4())
        
        response = await client.post(
            f"/api/bounties/{claimed_bounty.id}/claim",
            json={"claimant_id": new_claimant_id}
        )
        
        assert response.status_code == 400
        assert "already claimed" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_claim_completed_bounty(self, client, db_session):
        """Test claiming a completed bounty."""
        bounty = BountyDB(
            title="Completed Bounty",
            description="A completed bounty",
            tier=1,
            category="backend",
            status="completed",
            reward_amount=50000.0,
        )
        db_session.add(bounty)
        await db_session.commit()
        await db_session.refresh(bounty)
        
        response = await client.post(
            f"/api/bounties/{bounty.id}/claim",
            json={"claimant_id": str(uuid.uuid4())}
        )
        
        assert response.status_code == 400
        assert "cannot claim" in response.json()["detail"].lower()


class TestBountyUnclaim:
    """Tests for bounty unclaim endpoint."""
    
    @pytest.mark.asyncio
    async def test_unclaim_bounty_success(self, client, claimed_bounty):
        """Test successfully unclaiming a bounty."""
        response = await client.delete(
            f"/api/bounties/{claimed_bounty.id}/claim",
            params={"claimant_id": claimed_bounty.claimant_id},
            json={"reason": "No longer available"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "open"
        assert data["claimant_id"] is None
    
    @pytest.mark.asyncio
    async def test_unclaim_bounty_not_claimant(self, client, claimed_bounty):
        """Test unclaiming by someone who is not the claimant."""
        wrong_claimant = str(uuid.uuid4())
        
        response = await client.delete(
            f"/api/bounties/{claimed_bounty.id}/claim",
            params={"claimant_id": wrong_claimant},
            json={}
        )
        
        assert response.status_code == 400
        assert "only the current claimant" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_unclaim_open_bounty(self, client, sample_bounty):
        """Test unclaiming an open bounty (not claimed)."""
        response = await client.delete(
            f"/api/bounties/{sample_bounty.id}/claim",
            params={"claimant_id": str(uuid.uuid4())},
            json={}
        )
        
        assert response.status_code == 400
        assert "cannot unclaim" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_unclaim_with_reason(self, client, claimed_bounty):
        """Test unclaiming with a reason."""
        reason = "Found a conflict of interest"
        
        response = await client.delete(
            f"/api/bounties/{claimed_bounty.id}/claim",
            params={"claimant_id": claimed_bounty.claimant_id},
            json={"reason": reason}
        )
        
        assert response.status_code == 200


class TestBountyGetClaimant:
    """Tests for get claimant endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_claimant_success(self, client, claimed_bounty):
        """Test getting the claimant of a claimed bounty."""
        response = await client.get(
            f"/api/bounties/{claimed_bounty.id}/claimant"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["bounty_id"] == str(claimed_bounty.id)
        assert data["claimant_id"] == str(claimed_bounty.claimant_id)
        assert data["status"] == "in_progress"
        assert "claimed_at" in data
    
    @pytest.mark.asyncio
    async def test_get_claimant_not_claimed(self, client, sample_bounty):
        """Test getting claimant of an unclaimed bounty."""
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claimant"
        )
        
        assert response.status_code == 404
        assert "not currently claimed" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_get_claimant_bounty_not_found(self, client):
        """Test getting claimant of a non-existent bounty."""
        fake_id = str(uuid.uuid4())
        
        response = await client.get(
            f"/api/bounties/{fake_id}/claimant"
        )
        
        assert response.status_code == 404


class TestBountyClaimHistory:
    """Tests for claim history endpoint."""
    
    @pytest.mark.asyncio
    async def test_claim_history_after_claim(self, client, sample_bounty):
        """Test that claim history is recorded after claiming."""
        claimant_id = str(uuid.uuid4())
        
        # Claim the bounty
        await client.post(
            f"/api/bounties/{sample_bounty.id}/claim",
            json={"claimant_id": claimant_id}
        )
        
        # Get claim history
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claim-history"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["action"] == "claimed"
        assert data["items"][0]["claimant_id"] == claimant_id
    
    @pytest.mark.asyncio
    async def test_claim_history_after_unclaim(self, client, claimed_bounty):
        """Test that unclaim is recorded in history."""
        # Unclaim
        await client.delete(
            f"/api/bounties/{claimed_bounty.id}/claim",
            params={"claimant_id": claimed_bounty.claimant_id},
            json={"reason": "Testing unclaim"}
        )
        
        # Get claim history
        response = await client.get(
            f"/api/bounties/{claimed_bounty.id}/claim-history"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have at least 2 entries (claim + unclaim)
        assert data["total"] >= 1
        
        # Find unclaim entry
        actions = [item["action"] for item in data["items"]]
        assert "unclaimed" in actions
    
    @pytest.mark.asyncio
    async def test_claim_history_pagination(self, client, sample_bounty):
        """Test claim history pagination."""
        claimant_id = str(uuid.uuid4())
        
        # Claim and unclaim multiple times
        for _ in range(3):
            await client.post(
                f"/api/bounties/{sample_bounty.id}/claim",
                json={"claimant_id": claimant_id}
            )
            await client.delete(
                f"/api/bounties/{sample_bounty.id}/claim",
                params={"claimant_id": claimant_id},
                json={}
            )
        
        # Get history with limit
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claim-history",
            params={"limit": 2, "skip": 0}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) == 2
        assert data["total"] >= 6  # 3 claims + 3 unclaims
    
    @pytest.mark.asyncio
    async def test_claim_history_empty(self, client, sample_bounty):
        """Test claim history for bounty with no claims."""
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claim-history"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 0
        assert len(data["items"]) == 0


class TestBountyClaimWorkflow:
    """Integration tests for complete claim workflows."""
    
    @pytest.mark.asyncio
    async def test_full_claim_unclaim_cycle(self, client, sample_bounty):
        """Test complete claim -> unclaim -> reclaim cycle."""
        claimant_id = str(uuid.uuid4())
        
        # 1. Claim
        response = await client.post(
            f"/api/bounties/{sample_bounty.id}/claim",
            json={"claimant_id": claimant_id}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"
        
        # 2. Verify claimant
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claimant"
        )
        assert response.status_code == 200
        assert response.json()["claimant_id"] == claimant_id
        
        # 3. Unclaim
        response = await client.delete(
            f"/api/bounties/{sample_bounty.id}/claim",
            params={"claimant_id": claimant_id},
            json={"reason": "Need to focus on other work"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "open"
        
        # 4. Verify no claimant
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claimant"
        )
        assert response.status_code == 404
        
        # 5. Reclaim by different user
        new_claimant = str(uuid.uuid4())
        response = await client.post(
            f"/api/bounties/{sample_bounty.id}/claim",
            json={"claimant_id": new_claimant}
        )
        assert response.status_code == 200
        assert response.json()["claimant_id"] == new_claimant
        
        # 6. Verify history has all events
        response = await client.get(
            f"/api/bounties/{sample_bounty.id}/claim-history"
        )
        data = response.json()
        assert data["total"] >= 3  # 2 claims + 1 unclaim
    
    @pytest.mark.asyncio
    async def test_double_claim_prevented(self, client, sample_bounty):
        """Test that the same user cannot claim twice."""
        claimant_id = str(uuid.uuid4())
        
        # First claim
        response = await client.post(
            f"/api/bounties/{sample_bounty.id}/claim",
            json={"claimant_id": claimant_id}
        )
        assert response.status_code == 200
        
        # Second claim attempt (same user)
        response = await client.post(
            f"/api/bounties/{sample_bounty.id}/claim",
            json={"claimant_id": claimant_id}
        )
        assert response.status_code == 400
        assert "already claimed" in response.json()["detail"].lower()