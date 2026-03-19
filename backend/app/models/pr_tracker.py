"""PR Status Tracker database and Pydantic models."""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Integer, JSON, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PRStatus(str, Enum):
    """PR status types."""
    DRAFT = "draft"
    OPEN = "open"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    MERGED = "merged"
    CLOSED = "closed"


class ReviewStatus(str, Enum):
    """Review status."""
    PENDING = "pending"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    COMMENTED = "commented"


class PRTrackerDB(Base):
    """PR Status Tracker database model."""
    __tablename__ = "pr_trackers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_number = Column(Integer, nullable=False, index=True)
    repository = Column(String(255), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    author = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="open", index=True)
    
    # Review info
    review_status = Column(String(20), nullable=True)
    reviewers = Column(JSON, default=list)
    approvals_count = Column(Integer, default=0)
    changes_requested_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    
    # CI status
    ci_status = Column(String(20), nullable=True)  # pending, success, failure
    ci_details = Column(JSON, nullable=True)
    
    # Linked bounty
    bounty_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Timestamps
    opened_at = Column(DateTime(timezone=True), nullable=True)
    merged_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index('ix_pr_trackers_repo_pr', repository, pr_number),
    )


# Pydantic models

class ReviewerInfo(BaseModel):
    """Reviewer information."""
    username: str
    status: str  # pending, approved, changes_requested, commented
    reviewed_at: Optional[datetime] = None


class CIDetail(BaseModel):
    """CI check detail."""
    name: str
    status: str  # pending, success, failure
    url: Optional[str] = None


class PRTrackerResponse(BaseModel):
    """Full PR tracker response."""
    id: str
    pr_number: int
    repository: str
    title: str
    author: str
    status: str
    review_status: Optional[str] = None
    reviewers: List[ReviewerInfo] = []
    approvals_count: int = 0
    changes_requested_count: int = 0
    comments_count: int = 0
    ci_status: Optional[str] = None
    ci_details: Optional[List[CIDetail]] = None
    bounty_id: Optional[str] = None
    opened_at: Optional[datetime] = None
    merged_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    updated_at: datetime
    model_config = {"from_attributes": True}


class PRTrackerListItem(BaseModel):
    """Brief PR info for list views."""
    id: str
    pr_number: int
    repository: str
    title: str
    author: str
    status: str
    review_status: Optional[str] = None
    approvals_count: int = 0
    ci_status: Optional[str] = None
    opened_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class PRTrackerListResponse(BaseModel):
    """Paginated PR tracker list."""
    items: List[PRTrackerListItem]
    total: int
    skip: int
    limit: int


class PRTrackerCreate(BaseModel):
    """Schema for creating a PR tracker."""
    pr_number: int
    repository: str
    title: str
    author: str
    bounty_id: Optional[str] = None
    opened_at: Optional[datetime] = None


class PRTrackerUpdate(BaseModel):
    """Schema for updating a PR tracker."""
    title: Optional[str] = None
    status: Optional[str] = None
    review_status: Optional[str] = None
    reviewers: Optional[List[ReviewerInfo]] = None
    approvals_count: Optional[int] = None
    changes_requested_count: Optional[int] = None
    comments_count: Optional[int] = None
    ci_status: Optional[str] = None
    ci_details: Optional[List[CIDetail]] = None
    merged_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None