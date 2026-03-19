from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from app.database.base import Base

class BountyStatus(Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class BountyType(Enum):
    BUG_FIX = "bug_fix"
    FEATURE = "feature"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    OTHER = "other"

class SyncStatus(Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"

class Bounty(Base):
    __tablename__ = "bounties"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    reward_amount = Column(Integer, nullable=False, default=0)
    status = Column(SQLEnum(BountyStatus), default=BountyStatus.OPEN, nullable=False)
    bounty_type = Column(SQLEnum(BountyType), default=BountyType.OTHER, nullable=False)
    
    # GitHub sync metadata
    github_issue_id = Column(Integer, nullable=True, index=True)
    last_sync_timestamp = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.PENDING, nullable=False)
    
    # Foreign keys
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_bounties")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_bounties")
    repository = relationship("Repository", back_populates="bounties")
    submissions = relationship("Submission", back_populates="bounty", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Bounty(id={self.id}, title='{self.title}', status='{self.status.value}')>"
    
    def is_synced_with_github(self):
        """Check if bounty is synced with GitHub"""
        return self.github_issue_id is not None and self.sync_status == SyncStatus.SYNCED
    
    def needs_sync(self):
        """Check if bounty needs to be synced"""
        return self.sync_status in [SyncStatus.PENDING, SyncStatus.FAILED]
    
    def can_be_assigned(self):
        """Check if bounty can be assigned to someone"""
        return self.status == BountyStatus.OPEN and self.assignee_id is None
    
    def can_be_completed(self):
        """Check if bounty can be marked as completed"""
        return self.status == BountyStatus.IN_PROGRESS and self.assignee_id is not None
    
    def mark_sync_failed(self):
        """Mark sync as failed"""
        self.sync_status = SyncStatus.FAILED
        self.last_sync_timestamp = func.now()
    
    def mark_sync_success(self, github_issue_id=None):
        """Mark sync as successful"""
        self.sync_status = SyncStatus.SYNCED
        self.last_sync_timestamp = func.now()
        if github_issue_id:
            self.github_issue_id = github_issue_id