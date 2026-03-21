"""AI review score models for multi-model code review integration.

Stores per-model scores (GPT, Gemini, Grok) and an aggregated overall score
pulled from GitHub Actions AI review pipeline.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, Float, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


AI_REVIEW_SCORE_THRESHOLD = 7.0  # Minimum overall score for auto-approve (out of 10)
AUTO_APPROVE_TIMEOUT_HOURS = 48


class ReviewModel(str, Enum):
    GPT = "gpt"
    GEMINI = "gemini"
    GROK = "grok"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class AIReviewScoreDB(Base):
    """Per-model AI review score stored from GitHub Actions pipeline."""

    __tablename__ = "ai_review_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    bounty_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    model_name = Column(String(50), nullable=False)  # gpt, gemini, grok
    quality_score = Column(Float, nullable=False, default=0.0)
    correctness_score = Column(Float, nullable=False, default=0.0)
    security_score = Column(Float, nullable=False, default=0.0)
    completeness_score = Column(Float, nullable=False, default=0.0)
    test_coverage_score = Column(Float, nullable=False, default=0.0)
    overall_score = Column(Float, nullable=False, default=0.0)

    review_summary = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)
    review_status = Column(String(20), nullable=False, default="pending")
    github_run_id = Column(String(100), nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_ai_reviews_submission_model", submission_id, model_name, unique=True),
        Index("ix_ai_reviews_bounty", bounty_id),
    )


# Pydantic models


class ModelScore(BaseModel):
    """Score breakdown from a single AI model."""

    model_config = {"protected_namespaces": ()}

    model_name: str = Field(..., description="AI model identifier (gpt, gemini, grok)")
    quality_score: float = Field(0.0, ge=0, le=10)
    correctness_score: float = Field(0.0, ge=0, le=10)
    security_score: float = Field(0.0, ge=0, le=10)
    completeness_score: float = Field(0.0, ge=0, le=10)
    test_coverage_score: float = Field(0.0, ge=0, le=10)
    overall_score: float = Field(0.0, ge=0, le=10)
    review_summary: Optional[str] = None
    review_status: ReviewStatus = ReviewStatus.PENDING

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        valid = {m.value for m in ReviewModel}
        if v not in valid:
            raise ValueError(f"Invalid model: {v}. Must be one of: {valid}")
        return v


class ReviewScoreCreate(BaseModel):
    """Payload for recording AI review scores from GitHub Actions."""

    model_config = {"protected_namespaces": ()}

    submission_id: str
    bounty_id: str
    model_name: str
    quality_score: float = Field(0.0, ge=0, le=10)
    correctness_score: float = Field(0.0, ge=0, le=10)
    security_score: float = Field(0.0, ge=0, le=10)
    completeness_score: float = Field(0.0, ge=0, le=10)
    test_coverage_score: float = Field(0.0, ge=0, le=10)
    overall_score: float = Field(0.0, ge=0, le=10)
    review_summary: Optional[str] = None
    github_run_id: Optional[str] = None

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        valid = {m.value for m in ReviewModel}
        if v not in valid:
            raise ValueError(f"Invalid model: {v}. Must be one of: {valid}")
        return v


class AggregatedReviewScore(BaseModel):
    """Aggregated review scores across all models for a submission."""

    model_config = {"protected_namespaces": ()}

    submission_id: str
    bounty_id: str
    model_scores: List[ModelScore] = Field(default_factory=list)
    overall_score: float = Field(0.0, ge=0, le=10, description="Average across all models")
    meets_threshold: bool = Field(False, description=f"True if overall >= {AI_REVIEW_SCORE_THRESHOLD}")
    review_complete: bool = Field(False, description="True if all models have scored")

    quality_avg: float = 0.0
    correctness_avg: float = 0.0
    security_avg: float = 0.0
    completeness_avg: float = 0.0
    test_coverage_avg: float = 0.0


class ReviewScoreResponse(BaseModel):
    """API response for a single model's review score."""

    model_config = {"protected_namespaces": ()}

    id: str
    submission_id: str
    bounty_id: str
    model_name: str
    quality_score: float
    correctness_score: float
    security_score: float
    completeness_score: float
    test_coverage_score: float
    overall_score: float
    review_summary: Optional[str] = None
    review_status: str
    github_run_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
