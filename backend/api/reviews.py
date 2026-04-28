"""Review system API routes."""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
import uuid

from models.review import (
    ReviewDashboard,
    Appeal,
    AppealCreate,
    AppealStatusUpdate,
    ReviewerAssignment,
    LLMReview,
    ReviewConsensus,
)

router = APIRouter(prefix='/api', tags=['reviews'])

# In-memory storage (replace with PostgreSQL in production)
reviews_db: dict[str, ReviewDashboard] = {}
appeals_db: dict[str, Appeal] = {}


def calculate_consensus(reviews: List[LLMReview]) -> ReviewConsensus:
    """Calculate consensus from multiple LLM reviews."""
    scores = [r.score for r in reviews]
    avg = sum(scores) / len(scores) if scores else 0
    
    # Calculate agreement level based on standard deviation
    if len(scores) > 1:
        variance = sum((s - avg) ** 2 for s in scores) / len(scores)
        std_dev = variance ** 0.5
    else:
        std_dev = 0
    
    if std_dev < 10:
        agreement = 'high'
    elif std_dev < 20:
        agreement = 'medium'
    else:
        agreement = 'low'
    
    # Identify disagreements
    disagreements = []
    if agreement != 'high':
        providers = {r.llm_provider: r.score for r in reviews}
        for provider, score in providers.items():
            if abs(score - avg) > std_dev:
                disagreements.append(
                    f"{provider} scored {score:.1f}, which deviates from the average of {avg:.1f}"
                )
    
    return ReviewConsensus(
        average_score=round(avg, 1),
        agreement_level=agreement,
        scores=scores,
        disagreements=disagreements,
    )


@router.get('/reviews/{submission_id}', response_model=ReviewDashboard)
async def get_review_dashboard(submission_id: str):
    """Get review dashboard for a submission."""
    if submission_id not in reviews_db:
        raise HTTPException(status_code=404, detail='Review dashboard not found')
    return reviews_db[submission_id]


@router.post('/reviews', response_model=ReviewDashboard)
async def create_review_dashboard(dashboard: ReviewDashboard):
    """Create or update a review dashboard."""
    reviews_db[dashboard.submission_id] = dashboard
    return dashboard


@router.post('/appeals', response_model=Appeal)
async def create_appeal(appeal_data: AppealCreate):
    """Submit a new appeal."""
    appeal_id = str(uuid.uuid4())
    
    appeal = Appeal(
        id=appeal_id,
        submission_id=appeal_data.submission_id,
        reason=appeal_data.reason,
        status='pending',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        history=[
            {
                'id': str(uuid.uuid4()),
                'action': 'appeal_submitted',
                'actor': 'system',
                'timestamp': datetime.utcnow(),
                'notes': appeal_data.reason,
            }
        ],
    )
    
    appeals_db[appeal_id] = appeal
    return appeal


@router.get('/appeals/{appeal_id}', response_model=Appeal)
async def get_appeal(appeal_id: str):
    """Get appeal details."""
    if appeal_id not in appeals_db:
        raise HTTPException(status_code=404, detail='Appeal not found')
    return appeals_db[appeal_id]


@router.patch('/appeals/{appeal_id}/status', response_model=Appeal)
async def update_appeal_status(appeal_id: str, update: AppealStatusUpdate):
    """Update appeal status."""
    if appeal_id not in appeals_db:
        raise HTTPException(status_code=404, detail='Appeal not found')
    
    appeal = appeals_db[appeal_id]
    appeal.status = update.status
    appeal.updated_at = datetime.utcnow()
    
    appeal.history.append({
        'id': str(uuid.uuid4()),
        'action': f'status_changed_to_{update.status}',
        'actor': 'reviewer',
        'timestamp': datetime.utcnow(),
        'notes': update.notes,
    })
    
    return appeal


@router.post('/appeals/{appeal_id}/assign', response_model=Appeal)
async def assign_reviewer(appeal_id: str, assignment: ReviewerAssignment):
    """Assign a reviewer to an appeal."""
    if appeal_id not in appeals_db:
        raise HTTPException(status_code=404, detail='Appeal not found')
    
    appeal = appeals_db[appeal_id]
    appeal.reviewer_id = assignment.reviewer_id
    appeal.updated_at = datetime.utcnow()
    
    appeal.history.append({
        'id': str(uuid.uuid4()),
        'action': 'reviewer_assigned',
        'actor': 'system',
        'timestamp': datetime.utcnow(),
        'notes': f'Reviewer {assignment.reviewer_id} assigned',
    })
    
    return appeal
