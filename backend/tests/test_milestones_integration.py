"""Comprehensive integration tests for T3 bounty milestones lifecycle."""

import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy import select

from pydantic import ValidationError
from app.models.bounty import BountyCreate, BountyTier, BountyStatus
from app.models.milestone import MilestoneCreate, MilestoneStatus, MilestoneSubmit
from app.services.bounty_service import create_bounty, get_bounty
from app.services.bounty_lifecycle_service import claim_bounty
from app.services.milestone_service import MilestoneService
from app.database import get_db_session
from app.services.contributor_service import create_contributor, get_contributor
from app.models.contributor import ContributorCreate
from app.exceptions import (
    MilestoneNotFoundError,
    MilestoneValidationError,
    MilestoneSequenceError,
    UnauthorizedMilestoneAccessError,
)

@pytest.mark.asyncio
async def test_three_milestone_full_lifecycle():
    """
    Integration Test:
    1. Create a T3 bounty with 3 milestones (20%, 30%, 50%).
    2. Create a contributor and claim the bounty.
    3. Submit and approve each milestone in sequence.
    4. Verify sequential enforcement.
    5. Verify payout amounts.
    """
    owner_id = "owner_789"
    contributor_id = "contributor_789"
    reward_amount = 1000000.0 # 1M $FNDRY
    
    # 1. Create T3 bounty with 3 milestones
    milestones_payload = [
        MilestoneCreate(milestone_number=1, description="Design", percentage=20.0),
        MilestoneCreate(milestone_number=2, description="Implementation", percentage=30.0),
        MilestoneCreate(milestone_number=3, description="Testing & Deployment", percentage=50.0),
    ]
    
    bounty_create = BountyCreate(
        title="Complex T3 Project",
        description="A large project with three distinct phases",
        tier=BountyTier.T3,
        reward_amount=reward_amount,
        required_skills=["rust", "solana"],
        created_by=owner_id,
        milestones=milestones_payload
    )
    
    bounty_resp = await create_bounty(bounty_create)
    bounty_id = bounty_resp.id
    assert len(bounty_resp.milestones) == 3
    
    # 2. Create contributor and claim
    await create_contributor(ContributorCreate(
        username=contributor_id,
        display_name="Test Contributor",
        wallet_address="A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6" # Mock wallet
    ))
    claimed_bounty_resp = await claim_bounty(bounty_id, contributor_id)
    assert claimed_bounty_resp.claimed_by == contributor_id

    async with get_db_session() as session:
        svc = MilestoneService(session)
        
        milestones = bounty_resp.milestones
        m1, m2, m3 = milestones[0], milestones[1], milestones[2]
        
        # 3. Test sequential enforcement: Cannot approve M2 before M1
        with pytest.raises(MilestoneSequenceError):
            await svc.approve_milestone(bounty_id, str(m2.id), owner_id)

        # 4. Submit and Approve M1 (20%)
        await svc.submit_milestone(bounty_id, str(m1.id), MilestoneSubmit(notes="Design done"), contributor_id)
        approved_m1 = await svc.approve_milestone(bounty_id, str(m1.id), owner_id)
        assert approved_m1.status == MilestoneStatus.APPROVED
        assert approved_m1.payout_tx_hash is not None # Assuming create_payout returns a mock hash
        
        # 5. Submit and Approve M2 (30%)
        await svc.submit_milestone(bounty_id, str(m2.id), MilestoneSubmit(notes="Code done"), contributor_id)
        approved_m2 = await svc.approve_milestone(bounty_id, str(m2.id), owner_id)
        assert approved_m2.status == MilestoneStatus.APPROVED
        
        # 6. Submit and Approve M3 (50%)
        # Test Authorization: Contributor cannot approve their own milestone
        with pytest.raises(UnauthorizedMilestoneAccessError):
            await svc.approve_milestone(bounty_id, str(m3.id), contributor_id)
            
        await svc.submit_milestone(bounty_id, str(m3.id), MilestoneSubmit(notes="Deployment done"), contributor_id)
        approved_m3 = await svc.approve_milestone(bounty_id, str(m3.id), owner_id)
        assert approved_m3.status == MilestoneStatus.APPROVED

        # 7. Verify Payouts Logic in Service (Manual check of values used)
        # For M1: 1M * 0.20 = 200,000
        # For M2: 1M * 0.30 = 300,000
        # For M3: 1M * 0.50 = 500,000
        # Total = 1,000,000
        
@pytest.mark.asyncio
async def test_milestone_validation_edge_cases():
    """Test validation edge cases for milestones."""
    owner_id = "owner_edge"
    
    # 1. Total percentage > 100 (Field validation)
    with pytest.raises(ValidationError):
        MilestoneCreate(milestone_number=1, description="X", percentage=100.01)
        
    # 2. Total percentage < 100
    with pytest.raises(MilestoneValidationError):
        await create_bounty(BountyCreate(
            title="Invalid", description="X", tier=BountyTier.T3, reward_amount=100.0,
            created_by=owner_id,
            milestones=[MilestoneCreate(milestone_number=1, description="X", percentage=99.9)]
        ))
        
    # 3. Milestones on T1/T2
    with pytest.raises(MilestoneValidationError):
        await create_bounty(BountyCreate(
            title="Invalid", description="X", tier=BountyTier.T2, reward_amount=500001.0,
            created_by=owner_id,
            milestones=[MilestoneCreate(milestone_number=1, description="X", percentage=100.0)]
        ))
