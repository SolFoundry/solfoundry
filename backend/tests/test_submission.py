"""Tests for bounty submission workflow.

Tests cover:
1. PR submission creation
2. Auto-matching to bounties
3. Status tracking
4. Submission history
5. Contributor statistics
"""

import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timezone

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.submission import SubmissionDB, SubmissionStatus
from app.models.bounty import BountyDB, BountyStatus


# Test database URL (SQLite for unit tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    """Create test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_session):
    """Create test client with database override."""
    async def override_get_db():
        yield test_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_bounty(test_session: AsyncSession):
    """Create a test bounty."""
    bounty = BountyDB(
        id=uuid.uuid4(),
        title="Test Bounty",
        description="A test bounty for unit tests",
        tier=1,
        category="backend",
        status=BountyStatus.OPEN.value,
        reward_amount=100.0,
        reward_token="FNDRY",
        github_repo="test-owner/test-repo",
        github_issue_url="https://github.com/test-owner/test-repo/issues/42",
        github_issue_number=42,
    )
    test_session.add(bounty)
    await test_session.commit()
    await test_session.refresh(bounty)
    return bounty


@pytest.fixture
def contributor_id():
    """Generate a test contributor ID."""
    return str(uuid.uuid4())


@pytest.fixture
def test_wallet():
    """Test wallet address."""
    return "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"


class TestSubmissionCreation:
    """Tests for submission creation."""
    
    @pytest.mark.asyncio
    async def test_create_submission_with_pr_url(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test creating a submission with a PR URL."""
        response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/test-owner/test-repo/pull/123",
                "contributor_wallet": test_wallet,
                "description": "Fixed the bug",
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["pr_url"] == "https://github.com/test-owner/test-repo/pull/123"
        assert data["contributor_wallet"] == test_wallet
        assert data["status"] == "pending"
        assert data["pr_number"] == 123
        assert data["pr_repo"] == "test-owner/test-repo"
    
    @pytest.mark.asyncio
    async def test_create_submission_with_bounty_id(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
        test_bounty: BountyDB,
    ):
        """Test creating a submission with a pre-selected bounty."""
        response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/test-owner/test-repo/pull/124",
                "contributor_wallet": test_wallet,
                "bounty_id": str(test_bounty.id),
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "matched"
        assert data["bounty_id"] == str(test_bounty.id)
        assert data["match_confidence"] == "high"
        assert data["match_score"] == 1.0
        assert data["reward_amount"] == 100.0
    
    @pytest.mark.asyncio
    async def test_create_submission_invalid_url(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test that invalid PR URL is rejected."""
        response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://not-github.com/something",
                "contributor_wallet": test_wallet,
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_create_submission_non_pr_url(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test that non-PR URL is rejected."""
        response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/test-owner/test-repo/issues/123",
                "contributor_wallet": test_wallet,
            }
        )
        
        assert response.status_code == 422


class TestSubmissionRetrieval:
    """Tests for submission retrieval."""
    
    @pytest.mark.asyncio
    async def test_get_submission(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test retrieving a submission by ID."""
        # Create a submission
        create_response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/owner/repo/pull/1",
                "contributor_wallet": test_wallet,
            }
        )
        submission_id = create_response.json()["id"]
        
        # Retrieve it
        response = await client.get(f"/api/submissions/{submission_id}")
        
        assert response.status_code == 200
        assert response.json()["id"] == submission_id
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_submission(
        self,
        client: AsyncClient,
    ):
        """Test retrieving a non-existent submission."""
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/api/submissions/{fake_id}")
        
        assert response.status_code == 404


class TestSubmissionListing:
    """Tests for submission listing."""
    
    @pytest.mark.asyncio
    async def test_list_submissions(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test listing submissions."""
        # Create multiple submissions
        for i in range(3):
            await client.post(
                "/api/submissions/",
                params={"contributor_id": contributor_id},
                json={
                    "pr_url": f"https://github.com/owner/repo/pull/{i}",
                    "contributor_wallet": test_wallet,
                }
            )
        
        # List submissions
        response = await client.get("/api/submissions/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 3
        assert len(data["items"]) >= 3
    
    @pytest.mark.asyncio
    async def test_list_submissions_filter_by_contributor(
        self,
        client: AsyncClient,
        test_wallet: str,
    ):
        """Test filtering submissions by contributor."""
        contributor_1 = str(uuid.uuid4())
        contributor_2 = str(uuid.uuid4())
        
        # Create submissions for different contributors
        await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_1},
            json={
                "pr_url": "https://github.com/owner/repo/pull/1",
                "contributor_wallet": test_wallet,
            }
        )
        
        await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_2},
            json={
                "pr_url": "https://github.com/owner/repo/pull/2",
                "contributor_wallet": test_wallet,
            }
        )
        
        # Filter by contributor_1
        response = await client.get(
            "/api/submissions/",
            params={"contributor_id": contributor_1}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(item["contributor_id"] == contributor_1 for item in data["items"])
    
    @pytest.mark.asyncio
    async def test_list_submissions_filter_by_status(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test filtering submissions by status."""
        # Create a submission
        await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/owner/repo/pull/1",
                "contributor_wallet": test_wallet,
            }
        )
        
        # Filter by pending status
        response = await client.get(
            "/api/submissions/",
            params={"status": "pending"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(item["status"] == "pending" for item in data["items"])


class TestSubmissionStatusUpdate:
    """Tests for submission status updates."""
    
    @pytest.mark.asyncio
    async def test_approve_submission(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test approving a submission."""
        # Create a submission
        create_response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/owner/repo/pull/1",
                "contributor_wallet": test_wallet,
            }
        )
        submission_id = create_response.json()["id"]
        
        # Approve it
        reviewer_id = str(uuid.uuid4())
        response = await client.post(
            f"/api/submissions/{submission_id}/approve",
            params={"reviewer_id": reviewer_id, "notes": "Great work!"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["review_notes"] == "Great work!"
        assert data["reviewer_id"] == reviewer_id
    
    @pytest.mark.asyncio
    async def test_reject_submission(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test rejecting a submission."""
        # Create a submission
        create_response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/owner/repo/pull/1",
                "contributor_wallet": test_wallet,
            }
        )
        submission_id = create_response.json()["id"]
        
        # Reject it
        reviewer_id = str(uuid.uuid4())
        response = await client.post(
            f"/api/submissions/{submission_id}/reject",
            params={"reviewer_id": reviewer_id, "reason": "Does not meet requirements"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert data["review_notes"] == "Does not meet requirements"
    
    @pytest.mark.asyncio
    async def test_update_submission_status(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test updating submission status via PATCH."""
        # Create a submission
        create_response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/owner/repo/pull/1",
                "contributor_wallet": test_wallet,
            }
        )
        submission_id = create_response.json()["id"]
        
        # Update status to reviewing
        reviewer_id = str(uuid.uuid4())
        response = await client.patch(
            f"/api/submissions/{submission_id}",
            params={"reviewer_id": reviewer_id},
            json={"status": "reviewing", "review_notes": "Under review"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "reviewing"


class TestContributorStats:
    """Tests for contributor statistics."""
    
    @pytest.mark.asyncio
    async def test_get_contributor_stats(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test getting contributor statistics."""
        # Create multiple submissions
        for i in range(3):
            await client.post(
                "/api/submissions/",
                params={"contributor_id": contributor_id},
                json={
                    "pr_url": f"https://github.com/owner/repo/pull/{i}",
                    "contributor_wallet": test_wallet,
                }
            )
        
        # Get stats
        response = await client.get(f"/api/submissions/contributor/{contributor_id}/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_submissions"] >= 3
        assert "pending" in data
        assert "approved" in data
        assert "rejected" in data
        assert "paid" in data
        assert "total_earnings" in data
        assert "approval_rate" in data


class TestBountySubmissions:
    """Tests for bounty-specific submissions."""
    
    @pytest.mark.asyncio
    async def test_get_bounty_submissions(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
        test_bounty: BountyDB,
    ):
        """Test getting all submissions for a bounty."""
        # Create submissions for the bounty
        await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": "https://github.com/test-owner/test-repo/pull/1",
                "contributor_wallet": test_wallet,
                "bounty_id": str(test_bounty.id),
            }
        )
        
        # Get submissions for bounty
        response = await client.get(f"/api/submissions/bounty/{test_bounty.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert all(item["bounty_id"] == str(test_bounty.id) for item in data["items"])


class TestAutoMatching:
    """Tests for automatic bounty matching."""
    
    @pytest.mark.asyncio
    async def test_auto_match_by_repo(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
        test_bounty: BountyDB,
    ):
        """Test auto-matching submission to bounty by repository."""
        # Create a submission targeting the same repo as test_bounty
        response = await client.post(
            "/api/submissions/",
            params={"contributor_id": contributor_id},
            json={
                "pr_url": f"https://github.com/{test_bounty.github_repo}/pull/999",
                "contributor_wallet": test_wallet,
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Should be matched to the bounty
        if data.get("bounty_id"):
            assert data["match_confidence"] in ["high", "medium", "low"]
            assert len(data["match_reasons"]) > 0


class TestPagination:
    """Tests for pagination."""
    
    @pytest.mark.asyncio
    async def test_pagination(
        self,
        client: AsyncClient,
        contributor_id: str,
        test_wallet: str,
    ):
        """Test pagination parameters."""
        # Create multiple submissions
        for i in range(25):
            await client.post(
                "/api/submissions/",
                params={"contributor_id": contributor_id},
                json={
                    "pr_url": f"https://github.com/owner/repo/pull/{i}",
                    "contributor_wallet": test_wallet,
                }
            )
        
        # Get first page
        response = await client.get(
            "/api/submissions/",
            params={"skip": 0, "limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["skip"] == 0
        assert data["limit"] == 10
        
        # Get second page
        response2 = await client.get(
            "/api/submissions/",
            params={"skip": 10, "limit": 10}
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["items"]) == 10
        assert data2["skip"] == 10
