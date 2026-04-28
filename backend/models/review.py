"""Review system models."""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class LLMReview(BaseModel):
    id: str
    llm_provider: Literal['claude', 'codex', 'gemini']
    score: float = Field(ge=0, le=100)
    reasoning: str
    timestamp: datetime
    metadata: Optional[dict] = None


class ReviewConsensus(BaseModel):
    average_score: float
    agreement_level: Literal['high', 'medium', 'low']
    scores: List[float]
    disagreements: List[str]


class AppealHistory(BaseModel):
    id: str
    action: str
    actor: str
    timestamp: datetime
    notes: Optional[str] = None


class Appeal(BaseModel):
    id: str
    submission_id: str
    reviewer_id: Optional[str] = None
    reason: str
    status: Literal['pending', 'under_review', 'resolved', 'rejected']
    created_at: datetime
    updated_at: datetime
    history: List[AppealHistory]


class ReviewDashboard(BaseModel):
    submission_id: str
    reviews: List[LLMReview]
    consensus: ReviewConsensus
    appeal: Optional[Appeal] = None


class AppealCreate(BaseModel):
    submission_id: str
    reason: str


class AppealStatusUpdate(BaseModel):
    status: Literal['under_review', 'resolved', 'rejected']
    notes: Optional[str] = None


class ReviewerAssignment(BaseModel):
    reviewer_id: str
