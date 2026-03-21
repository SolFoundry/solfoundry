from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid
from datetime import datetime

from backend.core.database import get_db
from backend.models.users import User
from backend.models.bounties import Bounty
from backend.models.onboarding import OnboardingSession, OnboardingStage
from backend.utils.auth import get_current_user
from backend.services.matching import MatchingService

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

class OnboardingStartRequest(BaseModel):
    skills: List[str] = Field(..., min_items=1, max_items=10)
    experience_level: str = Field(..., regex="^(beginner|intermediate|advanced)$")
    interests: List[str] = Field(default_factory=list, max_items=5)
    preferred_languages: List[str] = Field(default_factory=list, max_items=3)
    timezone: Optional[str] = Field(None, max_length=50)

class OnboardingProgressResponse(BaseModel):
    session_id: str
    current_stage: str
    completed_stages: List[str]
    total_stages: int
    progress_percentage: float
    next_action: Optional[str]

class CompleteStageRequest(BaseModel):
    session_id: str
    stage: str
    data: dict = Field(default_factory=dict)

class AvailableBounty(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    reward_amount: int
    required_skills: List[str]
    estimated_hours: Optional[int]
    mentor_available: bool

class MentorAssignmentRequest(BaseModel):
    session_id: str
    preferred_mentor_id: Optional[str] = None
    skill_focus: Optional[str] = None

@router.post("/start")
async def start_onboarding(
    request: OnboardingStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_session = db.query(OnboardingSession).filter_by(
        user_id=current_user.id,
        status="active"
    ).first()

    if existing_session:
        raise HTTPException(
            status_code=400,
            detail="Active onboarding session already exists"
        )

    session = OnboardingSession(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        skills=request.skills,
        experience_level=request.experience_level,
        interests=request.interests,
        preferred_languages=request.preferred_languages,
        timezone=request.timezone,
        status="active",
        current_stage="profile_setup"
    )

    db.add(session)

    initial_stage = OnboardingStage(
        id=str(uuid.uuid4()),
        session_id=session.id,
        stage_name="profile_setup",
        status="completed",
        completed_at=datetime.utcnow(),
        stage_data={
            "skills": request.skills,
            "experience": request.experience_level
        }
    )

    db.add(initial_stage)
    db.commit()

    return {
        "session_id": session.id,
        "message": "Onboarding started successfully",
        "next_stage": "skill_assessment"
    }

@router.get("/progress/{user_id}", response_model=OnboardingProgressResponse)
async def get_onboarding_progress(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    session = db.query(OnboardingSession).filter_by(
        user_id=user_id,
        status="active"
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="No active onboarding session found"
        )

    completed_stages = db.query(OnboardingStage).filter_by(
        session_id=session.id,
        status="completed"
    ).all()

    total_stages = 5  # profile_setup, skill_assessment, first_bounty, mentor_match, completion
    completed_count = len(completed_stages)
    progress_pct = (completed_count / total_stages) * 100

    stage_names = [stage.stage_name for stage in completed_stages]

    next_action_map = {
        "profile_setup": "Complete skill assessment",
        "skill_assessment": "Browse available bounties",
        "first_bounty": "Get matched with a mentor",
        "mentor_match": "Complete onboarding",
        "completion": None
    }

    return OnboardingProgressResponse(
        session_id=session.id,
        current_stage=session.current_stage,
        completed_stages=stage_names,
        total_stages=total_stages,
        progress_percentage=progress_pct,
        next_action=next_action_map.get(session.current_stage)
    )

@router.put("/complete-stage")
async def complete_onboarding_stage(
    request: CompleteStageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(OnboardingSession).filter_by(
        id=request.session_id,
        user_id=current_user.id,
        status="active"
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Onboarding session not found"
        )

    existing_stage = db.query(OnboardingStage).filter_by(
        session_id=session.id,
        stage_name=request.stage
    ).first()

    if existing_stage and existing_stage.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="Stage already completed"
        )

    stage = OnboardingStage(
        id=str(uuid.uuid4()),
        session_id=session.id,
        stage_name=request.stage,
        status="completed",
        completed_at=datetime.utcnow(),
        stage_data=request.data
    )

    db.add(stage)

    stage_order = ["profile_setup", "skill_assessment", "first_bounty", "mentor_match", "completion"]
    current_idx = stage_order.index(session.current_stage)

    if current_idx < len(stage_order) - 1:
        session.current_stage = stage_order[current_idx + 1]

    if request.stage == "completion":
        session.status = "completed"
        session.completed_at = datetime.utcnow()

    db.commit()

    return {
        "message": f"Stage '{request.stage}' completed successfully",
        "next_stage": session.current_stage if session.status == "active" else None
    }

@router.get("/available-bounties", response_model=List[AvailableBounty])
async def get_available_bounties(
    skill_filter: Optional[str] = Query(None, description="Filter by skill"),
    difficulty: Optional[str] = Query("beginner", description="Difficulty level"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Bounty).filter_by(
        status="open",
        difficulty=difficulty or "beginner"
    )

    if skill_filter:
        query = query.filter(
            Bounty.required_skills.contains([skill_filter])
        )

    bounties = query.limit(limit).all()

    results = []
    for bounty in bounties:
        mentor_count = db.query(User).filter(
            User.is_mentor == True,
            User.mentor_skills.overlap(bounty.required_skills)
        ).count()

        results.append(AvailableBounty(
            id=bounty.id,
            title=bounty.title,
            description=bounty.description,
            difficulty=bounty.difficulty,
            reward_amount=bounty.reward_amount,
            required_skills=bounty.required_skills or [],
            estimated_hours=bounty.estimated_hours,
            mentor_available=mentor_count > 0
        ))

    return results

@router.post("/assign-mentor")
async def assign_mentor(
    request: MentorAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(OnboardingSession).filter_by(
        id=request.session_id,
        user_id=current_user.id,
        status="active"
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Onboarding session not found"
        )

    if request.preferred_mentor_id:
        mentor = db.query(User).filter_by(
            id=request.preferred_mentor_id,
            is_mentor=True
        ).first()

        if not mentor:
            raise HTTPException(
                status_code=404,
                detail="Preferred mentor not found"
            )
    else:
        matching_service = MatchingService(db)
        mentor = matching_service.find_best_mentor(
            user_skills=session.skills,
            skill_focus=request.skill_focus,
            experience_level=session.experience_level
        )

        if not mentor:
            raise HTTPException(
                status_code=404,
                detail="No suitable mentor available"
            )

    session.assigned_mentor_id = mentor.id
    session.mentor_assigned_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Mentor assigned successfully",
        "mentor": {
            "id": mentor.id,
            "username": mentor.username,
            "skills": mentor.mentor_skills or [],
            "rating": getattr(mentor, 'mentor_rating', None)
        }
    }
