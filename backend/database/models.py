from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Decimal, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

Base = declarative_base()


class Bounty(Base):
    __tablename__ = "bounties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_issue_number = Column(Integer, nullable=False, unique=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    reward_amount = Column(Decimal(precision=18, scale=8), nullable=False)
    currency = Column(String(10), nullable=False, default="FNDRY")
    tier = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="open")
    creator_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=False)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    requirements = Column(JSONB, default=list)
    acceptance_criteria = Column(JSONB, default=list)
    tags = Column(JSONB, default=list)
    priority = Column(String(20), default="medium")
    difficulty = Column(String(20), default="intermediate")
    estimated_hours = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    creator = relationship("Contributor", foreign_keys=[creator_id], back_populates="created_bounties")
    assignee = relationship("Contributor", foreign_keys=[assignee_id], back_populates="assigned_bounties")
    submissions = relationship("Submission", back_populates="bounty", cascade="all, delete-orphan")
    payouts = relationship("Payout", back_populates="bounty", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_bounties_status", "status"),
        Index("idx_bounties_tier", "tier"),
        Index("idx_bounties_creator", "creator_id"),
        Index("idx_bounties_assignee", "assignee_id"),
        Index("idx_bounties_created_at", "created_at"),
    )


class Contributor(Base):
    __tablename__ = "contributors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_username = Column(String(100), nullable=False, unique=True)
    github_id = Column(Integer, nullable=False, unique=True)
    display_name = Column(String(200), nullable=True)
    email = Column(String(320), nullable=True)
    solana_wallet = Column(String(44), nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    website = Column(String(500), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    total_earnings = Column(Decimal(precision=18, scale=8), nullable=False, default=0)
    completed_bounties = Column(Integer, nullable=False, default=0)
    active_bounties = Column(Integer, nullable=False, default=0)
    reputation_score = Column(Decimal(precision=10, scale=2), nullable=False, default=0)
    skill_tags = Column(JSONB, default=list)
    preferred_categories = Column(JSONB, default=list)
    timezone = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    joined_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_bounties = relationship("Bounty", foreign_keys="Bounty.creator_id", back_populates="creator")
    assigned_bounties = relationship("Bounty", foreign_keys="Bounty.assignee_id", back_populates="assignee")
    submissions = relationship("Submission", back_populates="contributor", cascade="all, delete-orphan")
    payouts = relationship("Payout", back_populates="contributor", cascade="all, delete-orphan")
    reputation_entries = relationship("Reputation", back_populates="contributor", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_contributors_github_username", "github_username"),
        Index("idx_contributors_github_id", "github_id"),
        Index("idx_contributors_reputation", "reputation_score"),
        Index("idx_contributors_earnings", "total_earnings"),
        Index("idx_contributors_active", "is_active"),
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(UUID(as_uuid=True), ForeignKey("bounties.id"), nullable=False)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=False)
    pr_number = Column(Integer, nullable=False)
    pr_url = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    review_score = Column(Decimal(precision=3, scale=1), nullable=True)
    reviewer_feedback = Column(Text, nullable=True)
    auto_review_data = Column(JSONB, nullable=True)
    files_changed = Column(Integer, nullable=True)
    lines_added = Column(Integer, nullable=True)
    lines_removed = Column(Integer, nullable=True)
    commits_count = Column(Integer, nullable=True)
    review_requested_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    merged_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    bounty = relationship("Bounty", back_populates="submissions")
    contributor = relationship("Contributor", back_populates="submissions")

    __table_args__ = (
        Index("idx_submissions_bounty", "bounty_id"),
        Index("idx_submissions_contributor", "contributor_id"),
        Index("idx_submissions_status", "status"),
        Index("idx_submissions_pr_number", "pr_number"),
        Index("idx_submissions_created_at", "created_at"),
    )


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(UUID(as_uuid=True), ForeignKey("bounties.id"), nullable=False)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=False)
    amount = Column(Decimal(precision=18, scale=8), nullable=False)
    currency = Column(String(10), nullable=False, default="FNDRY")
    transaction_signature = Column(String(88), nullable=True)
    solana_wallet = Column(String(44), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    processing_fee = Column(Decimal(precision=18, scale=8), nullable=True)
    net_amount = Column(Decimal(precision=18, scale=8), nullable=False)
    payment_method = Column(String(50), nullable=False, default="solana")
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    bounty = relationship("Bounty", back_populates="payouts")
    contributor = relationship("Contributor", back_populates="payouts")

    __table_args__ = (
        Index("idx_payouts_bounty", "bounty_id"),
        Index("idx_payouts_contributor", "contributor_id"),
        Index("idx_payouts_status", "status"),
        Index("idx_payouts_transaction_sig", "transaction_signature"),
        Index("idx_payouts_wallet", "solana_wallet"),
        Index("idx_payouts_created_at", "created_at"),
    )


class Reputation(Base):
    __tablename__ = "reputation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=False)
    bounty_id = Column(UUID(as_uuid=True), ForeignKey("bounties.id"), nullable=True)
    event_type = Column(String(100), nullable=False)
    score_change = Column(Decimal(precision=10, scale=2), nullable=False)
    previous_score = Column(Decimal(precision=10, scale=2), nullable=False)
    new_score = Column(Decimal(precision=10, scale=2), nullable=False)
    metadata = Column(JSONB, nullable=True)
    reason = Column(String(500), nullable=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("contributors.id"), nullable=True)
    is_manual_adjustment = Column(Boolean, nullable=False, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    contributor = relationship("Contributor", foreign_keys=[contributor_id], back_populates="reputation_entries")
    reviewer = relationship("Contributor", foreign_keys=[reviewer_id])
    bounty = relationship("Bounty")

    __table_args__ = (
        Index("idx_reputation_contributor", "contributor_id"),
        Index("idx_reputation_bounty", "bounty_id"),
        Index("idx_reputation_event_type", "event_type"),
        Index("idx_reputation_created_at", "created_at"),
        Index("idx_reputation_score_change", "score_change"),
    )
