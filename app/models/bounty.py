from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import enum

Base = declarative_base()


class BountyStatus(enum.Enum):
    OPEN = "open"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ClaimStatus(enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Bounty(Base):
    __tablename__ = 'bounties'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    reward_amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default='USD')
    status = Column(Enum(BountyStatus), default=BountyStatus.OPEN)
    
    # Creator information
    creator_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Claim fields
    claimer_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    claim_status = Column(Enum(ClaimStatus), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Requirements and skills
    requirements = Column(Text)
    skills_required = Column(String(500))
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_bounties")
    claimer = relationship("User", foreign_keys=[claimer_id], back_populates="claimed_bounties")
    claim_history = relationship("BountyClaimHistory", back_populates="bounty", cascade="all, delete-orphan")