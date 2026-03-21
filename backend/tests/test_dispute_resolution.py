"""Tests for the Dispute Resolution System."""

import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db, Base, engine
from app.api.disputes import router as disputes_router
from app.api.auth import get_current_user_id, get_admin_user_id
from app.models.dispute import DisputeStatus, DisputeOutcome
from app.models.user import User, UserRole
from app.models.bounty_table import BountyTable
from app.models.submission import SubmissionDB, SubmissionStatus

# Setup Test App
_test_app = FastAPI()
_test_app.include_router(disputes_router)

# IDs for testing
TEST_USER_ID = "00000000-0000-0000-0000-000000000123"
TEST_ADMIN_ID = "00000000-0000-0000-0000-000000000999"
TEST_BOUNTY_ID = uuid.uuid4()

async def override_get_current_user_id():
    return TEST_USER_ID

async def override_get_admin_user_id():
    return TEST_ADMIN_ID

_test_app.dependency_overrides[get_current_user_id] = override_get_current_user_id
_test_app.dependency_overrides[get_admin_user_id] = override_get_admin_user_id

@pytest.mark.asyncio
async def test_dispute_lifecycle():
    """Verify full dispute flow from creation to resolution using DB persistence."""
    
    # 1. Setup Database state
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async for db in get_db():
        # Clean up
        await db.execute(delete(SubmissionDB))
        await db.execute(delete(BountyTable))
        await db.execute(delete(User))
        
        # Seed Admin
        admin = User(
            id=uuid.UUID(TEST_ADMIN_ID),
            github_id="admin-github",
            username="admin_user",
            role=UserRole.ADMIN.value
        )
        db.add(admin)
        
        # Seed Contributor
        user = User(
            id=uuid.UUID(TEST_USER_ID),
            github_id="user-github",
            username="test_user",
            role=UserRole.CONTRIBUTOR.value
        )
        db.add(user)
        
        # Seed Bounty
        bounty = BountyTable(
            id=TEST_BOUNTY_ID,
            title="Database Test Bounty",
            description="Testing real DB persistence",
            reward_amount=100.0,
            status="completed",
            created_by=TEST_ADMIN_ID
        )
        db.add(bounty)
        
        # Seed Rejected Submission
        sub = SubmissionDB(
            bounty_id=TEST_BOUNTY_ID,
            contributor_id=uuid.UUID(TEST_USER_ID),
            pr_url="https://github.com/test/pr/1",
            status=SubmissionStatus.REJECTED.value,
            reviewed_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        db.add(sub)
        await db.commit()
        break # Exit generator

    # 2. POST /api/disputes (Create)
    payload = {
        "reason": "incorrect_review",
        "description": "I believe this is unfair.",
        "evidence_links": [{"type": "screenshot", "description": "evidence", "url": "https://imgur.com/x"}],
        "bounty_id": str(TEST_BOUNTY_ID)
    }
    
    async with AsyncClient(transport=ASGITransport(app=_test_app), base_url="http://test") as client:
        response = await client.post("/api/disputes", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == DisputeStatus.MEDIATION.value # Moves to mediation if AI threshold not met
        dispute_id = data["id"]
        
        # 3. POST /api/disputes/{id}/evidence (Add Evidence)
        evidence_payload = [{"type": "link", "description": "more proof", "url": "https://google.com"}]
        response = await client.post(f"/api/disputes/{dispute_id}/evidence", json=evidence_payload)
        assert response.status_code == 200
        
        # 4. GET /api/disputes/{id} (Read)
        response = await client.get(f"/api/disputes/{dispute_id}")
        assert response.status_code == 200
        res_data = response.json()
        assert len(res_data["evidence_links"]) == 2
        assert len(res_data["history"]) >= 2
        
        # 5. POST /api/disputes/{id}/resolve (Finalize)
        resolve_payload = {
            "outcome": DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value,
            "review_notes": "Valid evidence provided.",
            "resolution_action": "PAYOUT_INITIATED"
        }
        response = await client.post(f"/api/disputes/{dispute_id}/resolve", json=resolve_payload)
        assert response.status_code == 200
        final_data = response.json()
        assert final_data["status"] == DisputeStatus.RESOLVED.value
        assert final_data["outcome"] == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value

@pytest.mark.asyncio
async def test_dispute_authorization_fail():
    """Verify that a stranger cannot view or modify a participant's dispute."""
    STRANGER_ID = "00000000-0000-0000-0000-000000000666"
    
    async for db in get_db():
        # We assume TEST_BOUNTY_ID dispute already exists from previous test or we seed it
        # Let's seed a fresh one for isolation
        b_id = uuid.uuid4()
        user_id = uuid.UUID(TEST_USER_ID)
        
        bounty = BountyTable(id=b_id, title="Auth Bounty", reward_amount=50.0, created_by=TEST_ADMIN_ID)
        sub = SubmissionDB(bounty_id=b_id, contributor_id=user_id, status=SubmissionStatus.REJECTED.value, reviewed_at=datetime.now(timezone.utc))
        db.add(bounty)
        db.add(sub)
        await db.commit()
        
        # Create dispute as participant
        from app.services.dispute_service import dispute_service
        from app.models.dispute import DisputeCreate
        dispute = await dispute_service.create_dispute(db, DisputeCreate(reason="other", description="desc", bounty_id=str(b_id)), str(user_id))
        dispute_id = str(dispute.id)
        break

    async with AsyncClient(transport=ASGITransport(app=_test_app), base_url="http://test") as client:
        # Override current user to stranger
        _test_app.dependency_overrides[get_current_user_id] = lambda: STRANGER_ID
        
        # Try to view
        response = await client.get(f"/api/disputes/{dispute_id}")
        assert response.status_code == 403
        
        # Try to add evidence
        response = await client.post(f"/api/disputes/{dispute_id}/evidence", json=[])
        assert response.status_code == 403
