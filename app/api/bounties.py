from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import Bounty, User, BountyClaim
from ..auth import get_current_user
from ..schemas import BountyClaimCreate, BountyClaimResponse

router = APIRouter(prefix="/api/bounties", tags=["bounties"])

TIER_REQUIREMENTS = {
    1: {"min_reputation": 0, "max_deadline_days": 30},
    2: {"min_reputation": 100, "max_deadline_days": 60},
    3: {"min_reputation": 500, "max_deadline_days": 90},
    4: {"min_reputation": 1000, "max_deadline_days": 120},
    5: {"min_reputation": 2000, "max_deadline_days": 180}
}

@router.post("/{bounty_id}/claim", response_model=BountyClaimResponse)
def claim_bounty(
    bounty_id: int,
    claim_data: BountyClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Claim a bounty with tier validation and reputation checks"""
    # Get bounty
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found"
        )
    
    # Check if bounty is available for claiming
    if bounty.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bounty is not available for claiming"
        )
    
    # Check if user already has a claim on this bounty
    existing_claim = db.query(BountyClaim).filter(
        BountyClaim.bounty_id == bounty_id,
        BountyClaim.user_id == current_user.id,
        BountyClaim.status.in_(["pending", "approved"])
    ).first()
    
    if existing_claim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active claim on this bounty"
        )
    
    # Tier validation
    tier_req = TIER_REQUIREMENTS.get(bounty.tier)
    if not tier_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bounty tier"
        )
    
    # Check reputation requirement
    if current_user.reputation < tier_req["min_reputation"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient reputation. Required: {tier_req['min_reputation']}, Current: {current_user.reputation}"
        )
    
    # Validate proposed deadline
    max_deadline = datetime.utcnow() + timedelta(days=tier_req["max_deadline_days"])
    if claim_data.proposed_deadline > max_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposed deadline exceeds maximum allowed for tier {bounty.tier} ({tier_req['max_deadline_days']} days)"
        )
    
    # Check if user has too many active claims
    active_claims_count = db.query(BountyClaim).filter(
        BountyClaim.user_id == current_user.id,
        BountyClaim.status.in_(["pending", "approved"])
    ).count()
    
    max_active_claims = min(3 + (current_user.reputation // 500), 10)  # Cap at 10
    if active_claims_count >= max_active_claims:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many active claims. Maximum allowed: {max_active_claims}"
        )
    
    # Create claim
    claim = BountyClaim(
        bounty_id=bounty_id,
        user_id=current_user.id,
        proposed_deadline=claim_data.proposed_deadline,
        proposal=claim_data.proposal,
        status="pending",
        claimed_at=datetime.utcnow()
    )
    
    db.add(claim)
    db.commit()
    db.refresh(claim)
    
    return BountyClaimResponse(
        id=claim.id,
        bounty_id=claim.bounty_id,
        user_id=claim.user_id,
        proposed_deadline=claim.proposed_deadline,
        proposal=claim.proposal,
        status=claim.status,
        claimed_at=claim.claimed_at
    )

@router.delete("/{bounty_id}/claim")
def unclaim_bounty(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unclaim a bounty (withdraw claim)"""
    # Find the user's claim
    claim = db.query(BountyClaim).filter(
        BountyClaim.bounty_id == bounty_id,
        BountyClaim.user_id == current_user.id,
        BountyClaim.status.in_(["pending", "approved"])
    ).first()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active claim found for this bounty"
        )
    
    # Check if claim can be withdrawn
    if claim.status == "approved":
        # Check if work has already started (some grace period)
        if claim.approved_at and datetime.utcnow() - claim.approved_at > timedelta(hours=24):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot withdraw claim after 24 hours of approval"
            )
    
    # Update claim status to withdrawn
    claim.status = "withdrawn"
    claim.withdrawn_at = datetime.utcnow()
    
    # If this was an approved claim, update bounty status back to open
    if claim.status == "approved":
        bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if bounty:
            bounty.status = "open"
            bounty.assigned_to = None
            bounty.deadline = None
    
    db.commit()
    
    return {"message": "Claim withdrawn successfully"}

@router.get("/{bounty_id}/claims", response_model=List[BountyClaimResponse])
def get_bounty_claims(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all claims for a bounty (only bounty creator can see this)"""
    # Get bounty and check ownership
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found"
        )
    
    if bounty.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bounty creator can view claims"
        )
    
    claims = db.query(BountyClaim).filter(
        BountyClaim.bounty_id == bounty_id,
        BountyClaim.status != "withdrawn"
    ).all()
    
    return [
        BountyClaimResponse(
            id=claim.id,
            bounty_id=claim.bounty_id,
            user_id=claim.user_id,
            proposed_deadline=claim.proposed_deadline,
            proposal=claim.proposal,
            status=claim.status,
            claimed_at=claim.claimed_at
        )
        for claim in claims
    ]

@router.post("/{bounty_id}/claims/{claim_id}/approve")
def approve_claim(
    bounty_id: int,
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a specific claim (assign bounty to claimant)"""
    # Get bounty and check ownership
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found"
        )
    
    if bounty.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bounty creator can approve claims"
        )
    
    # Get the specific claim
    claim = db.query(BountyClaim).filter(
        BountyClaim.id == claim_id,
        BountyClaim.bounty_id == bounty_id,
        BountyClaim.status == "pending"
    ).first()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found or not in pending status"
        )
    
    # Approve the claim
    claim.status = "approved"
    claim.approved_at = datetime.utcnow()
    
    # Update bounty
    bounty.status = "assigned"
    bounty.assigned_to = claim.user_id
    bounty.deadline = claim.proposed_deadline
    
    # Reject all other pending claims for this bounty
    other_claims = db.query(BountyClaim).filter(
        BountyClaim.bounty_id == bounty_id,
        BountyClaim.id != claim_id,
        BountyClaim.status == "pending"
    ).all()
    
    for other_claim in other_claims:
        other_claim.status = "rejected"
        other_claim.rejected_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Claim approved successfully"}

@router.post("/{bounty_id}/claims/{claim_id}/reject")
def reject_claim(
    bounty_id: int,
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a specific claim"""
    # Get bounty and check ownership
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found"
        )
    
    if bounty.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only bounty creator can reject claims"
        )
    
    # Get the specific claim
    claim = db.query(BountyClaim).filter(
        BountyClaim.id == claim_id,
        BountyClaim.bounty_id == bounty_id,
        BountyClaim.status == "pending"
    ).first()
    
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim not found or not in pending status"
        )
    
    # Reject the claim
    claim.status = "rejected"
    claim.rejected_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Claim rejected successfully"}