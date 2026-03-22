"""Unit tests for T3 bounty milestone lifecycle."""

import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy import select

from app.models.bounty import BountyCreate, BountyTier, BountyStatus
from app.models.milestone import MilestoneCreate, MilestoneStatus, MilestoneSubmit
from app.services.bounty_service import create_bounty, claim_bounty
from app.services.milestone_service import MilestoneService
from app.database import get_db_session


@pytest.mark.asyncio
async def test_milestone_lifecycle():
    """Test creating, submitting, and approving milestones."""
    
    # 1. Create a T3 bounty
    bounty_data = BountyCreate(
        title="T3 Milestone Project",
        description="A large project with milestones",
        tier=BountyTier.T3,
        reward_amount=1000.0,
        required_skills=["python"],
        created_by="owner_123"
    )
    bounty = await create_bounty(bounty_data)
    bounty_id = bounty.id
    
    async with get_db_session() as session:
        svc = MilestoneService(session)
        
        # 2. Define milestones
        milestones_data = [
            MilestoneCreate(milestone_number=1, description="Phase 1", percentage=30.0),
            MilestoneCreate(milestone_number=2, description="Phase 2", percentage=70.0),
        ]
        
        created = await svc.create_milestones(bounty_id, milestones_data, "owner_123")
        assert len(created) == 2
        assert created[0].percentage == 30.0
        assert created[1].percentage == 70.0
        
        # 3. Claim the bounty
        # We need a contributor for this
        from app.services.contributor_service import create_contributor
        from app.models.contributor import ContributorCreate
        
        contributor_id = "contributor_123"
        await create_contributor(ContributorCreate(
            username="contributor_123",
            wallet_address="7Pq6r..." # Mock 
        ))
        
        await claim_bounty(bounty_id, contributor_id)
        
        # 4. Submit first milestone
        milestone1_id = str(created[0].id)
        submitted = await svc.submit_milestone(
            bounty_id, milestone1_id, MilestoneSubmit(notes="First phase done"), contributor_id
        )
        assert submitted.status == MilestoneStatus.SUBMITTED
        
        # 5. Approve first milestone (triggers payout)
        approved = await svc.approve_milestone(bounty_id, milestone1_id, "owner_123")
        assert approved.status == MilestoneStatus.APPROVED
        assert approved.approved_at is not None
        
        # 6. Try to approve second milestone without submission (should fail)
        milestone2_id = str(created[1].id)
        with pytest.raises(ValueError, match="Milestone cannot be approved in state: pending"):
            await svc.approve_milestone(bounty_id, milestone2_id, "owner_123")
            
        # 7. Submit second milestone
        await svc.submit_milestone(
            bounty_id, milestone2_id, MilestoneSubmit(notes="Second phase done"), contributor_id
        )
        
        # 8. Approve second milestone
        approved2 = await svc.approve_milestone(bounty_id, milestone2_id, "owner_123")
        assert approved2.status == MilestoneStatus.APPROVED


@pytest.mark.asyncio
async def test_milestone_validation():
    """Test milestone validation rules."""
    
    # 1. Create a T1 bounty (should fail to add milestones)
    bounty_data = BountyCreate(
        title="T1 Simple Project",
        description="A small project",
        tier=BountyTier.T1,
        reward_amount=100.0,
        required_skills=["python"],
        created_by="owner_123"
    )
    bounty = await create_bounty(bounty_data)
    
    async with get_db_session() as session:
        svc = MilestoneService(session)
        
        # Try to add milestones to T1
        with pytest.raises(ValueError, match="Milestones can only be added to T3 bounties"):
            await svc.create_milestones(
                bounty.id, 
                [MilestoneCreate(milestone_number=1, description="X", percentage=100.0)], 
                "owner_123"
            )
            
    # 2. Create a T3 bounty and try invalid percentages
    bounty_data_t3 = BountyCreate(
        title="T3 Milestone Project 2",
        description="A large project",
        tier=BountyTier.T3,
        reward_amount=1000.0,
        required_skills=["python"],
        created_by="owner_123"
    )
    bounty_t3 = await create_bounty(bounty_data_t3)
    
    async with get_db_session() as session:
        svc = MilestoneService(session)
        
        # Try invalid total percentage
        with pytest.raises(ValueError, match="Total percentage must be 100"):
            await svc.create_milestones(
                bounty_t3.id, 
                [MilestoneCreate(milestone_number=1, description="X", percentage=50.0)], 
                "owner_123"
            )
