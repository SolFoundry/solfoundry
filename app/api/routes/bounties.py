from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import httpx

from app.database import get_db
from app.models.bounty import Bounty
from app.models.user import User
from app.schemas.bounty import BountyResponse, BountyCreate, BountyUpdate
from app.core.auth import get_current_user
from app.core.config import settings

router = APIRouter()

@router.post("/bounties", response_model=BountyResponse)
async def create_bounty(
    bounty: BountyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new bounty"""
    db_bounty = Bounty(**bounty.dict(), creator_id=current_user.id)
    db.add(db_bounty)
    db.commit()
    db.refresh(db_bounty)
    return db_bounty

@router.get("/bounties", response_model=List[BountyResponse])
async def list_bounties(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    tier: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List bounties with optional filtering"""
    query = db.query(Bounty)
    
    if status:
        query = query.filter(Bounty.status == status)
    if tier:
        query = query.filter(Bounty.tier == tier)
    
    bounties = query.offset(skip).limit(limit).all()
    return bounties

@router.get("/bounties/{bounty_id}", response_model=BountyResponse)
async def get_bounty(bounty_id: int, db: Session = Depends(get_db)):
    """Get a specific bounty by ID"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return bounty

@router.put("/bounties/{bounty_id}", response_model=BountyResponse)
async def update_bounty(
    bounty_id: int,
    bounty_update: BountyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    
    if bounty.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this bounty")
    
    for field, value in bounty_update.dict(exclude_unset=True).items():
        setattr(bounty, field, value)
    
    db.commit()
    db.refresh(bounty)
    return bounty

async def validate_github_repo_access(github_username: str, repo_url: str) -> bool:
    """Validate user has access to GitHub repository"""
    try:
        # Extract owner/repo from URL
        if "github.com/" not in repo_url:
            return False
        
        parts = repo_url.split("github.com/")[1].split("/")
        if len(parts) < 2:
            return False
        
        owner, repo = parts[0], parts[1].replace(".git", "")
        
        # Check if user has access to repository
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/collaborators/{github_username}",
                headers={"Authorization": f"token {settings.GITHUB_TOKEN}"}
            )
            return response.status_code == 204  # 204 means user is a collaborator
    except Exception:
        return False

def check_tier_requirements(user: User, bounty_tier: str) -> bool:
    """Check if user meets tier requirements"""
    tier_requirements = {
        "T1": {"min_reputation": 0, "min_completed": 0},
        "T2": {"min_reputation": 100, "min_completed": 2},
        "T3": {"min_reputation": 250, "min_completed": 5},
        "T4": {"min_reputation": 500, "min_completed": 10},
        "T5": {"min_reputation": 1000, "min_completed": 20}
    }
    
    requirements = tier_requirements.get(bounty_tier, {"min_reputation": 0, "min_completed": 0})
    
    return (user.reputation >= requirements["min_reputation"] and 
            user.completed_bounties >= requirements["min_completed"])

@router.post("/bounties/{bounty_id}/claim")
async def claim_bounty(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Claim a bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    
    if bounty.status != "open":
        raise HTTPException(status_code=400, detail="Bounty is not available for claiming")
    
    if bounty.assignee_id:
        raise HTTPException(status_code=400, detail="Bounty is already assigned")
    
    # Check tier requirements
    if not check_tier_requirements(current_user, bounty.tier):
        raise HTTPException(
            status_code=403, 
            detail=f"Insufficient reputation or completed bounties for {bounty.tier} tier"
        )
    
    # Validate GitHub repository access if repository is specified
    if bounty.repository_url and current_user.github_username:
        has_access = await validate_github_repo_access(current_user.github_username, bounty.repository_url)
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail="No access to the specified GitHub repository"
            )
    
    # Check if user has too many active claims
    active_claims = db.query(Bounty).filter(
        Bounty.assignee_id == current_user.id,
        Bounty.status.in_(["assigned", "in_progress"])
    ).count()
    
    max_active_claims = {
        "T1": 3, "T2": 2, "T3": 2, "T4": 1, "T5": 1
    }
    
    if active_claims >= max_active_claims.get(bounty.tier, 1):
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum active claims reached for {bounty.tier} tier"
        )
    
    # Assign bounty
    bounty.assignee_id = current_user.id
    bounty.status = "assigned"
    
    db.commit()
    db.refresh(bounty)
    
    return {"message": "Bounty claimed successfully", "bounty": bounty}

@router.post("/bounties/{bounty_id}/unclaim")
async def unclaim_bounty(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unclaim a bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    
    if bounty.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this bounty")
    
    if bounty.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot unclaim a completed bounty")
    
    # Reset bounty assignment
    bounty.assignee_id = None
    bounty.status = "open"
    
    db.commit()
    db.refresh(bounty)
    
    return {"message": "Bounty unclaimed successfully", "bounty": bounty}

@router.get("/bounties/{bounty_id}/can-claim")
async def can_claim_bounty(
    bounty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if current user can claim a bounty"""
    bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    
    can_claim = True
    reasons = []
    
    # Check basic availability
    if bounty.status != "open":
        can_claim = False
        reasons.append("Bounty is not open")
    
    if bounty.assignee_id:
        can_claim = False
        reasons.append("Bounty is already assigned")
    
    # Check tier requirements
    if not check_tier_requirements(current_user, bounty.tier):
        can_claim = False
        reasons.append(f"Insufficient reputation or completed bounties for {bounty.tier} tier")
    
    # Check active claims limit
    active_claims = db.query(Bounty).filter(
        Bounty.assignee_id == current_user.id,
        Bounty.status.in_(["assigned", "in_progress"])
    ).count()
    
    max_active_claims = {
        "T1": 3, "T2": 2, "T3": 2, "T4": 1, "T5": 1
    }
    
    if active_claims >= max_active_claims.get(bounty.tier, 1):
        can_claim = False
        reasons.append(f"Maximum active claims reached for {bounty.tier} tier")
    
    return {
        "can_claim": can_claim,
        "reasons": reasons,
        "user_reputation": current_user.reputation,
        "user_completed_bounties": current_user.completed_bounties,
        "active_claims": active_claims
    }