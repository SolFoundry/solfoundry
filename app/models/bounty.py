from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timedelta
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
    creator_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    claimer_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    status = Column(Enum(BountyStatus), default=BountyStatus.OPEN, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_bounties")
    claimer = relationship("User", foreign_keys=[claimer_id], back_populates="claimed_bounties")
    claim_history = relationship("BountyClaimHistory", back_populates="bounty", cascade="all, delete-orphan")
    
    def can_be_claimed(self, user_id):
        """Check if bounty can be claimed by user"""
        if self.status != BountyStatus.OPEN:
            return False, "Bounty is not available for claiming"
        
        if self.creator_id == user_id:
            return False, "Cannot claim your own bounty"
        
        if self.claimer_id is not None:
            return False, "Bounty is already claimed"
        
        return True, "Bounty can be claimed"
    
    def claim(self, user_id, deadline_hours=72):
        """Claim the bounty for a user"""
        can_claim, message = self.can_be_claimed(user_id)
        if not can_claim:
            raise ValueError(message)
        
        self.claimer_id = user_id
        self.claimed_at = datetime.utcnow()
        self.deadline = datetime.utcnow() + timedelta(hours=deadline_hours)
        self.status = BountyStatus.CLAIMED
        
        # Create claim history entry
        claim_history = BountyClaimHistory(
            bounty_id=self.id,
            user_id=user_id,
            action="claimed",
            deadline=self.deadline,
            status=ClaimStatus.ACTIVE
        )
        self.claim_history.append(claim_history)
    
    def release_claim(self, reason="released"):
        """Release the current claim"""
        if self.claimer_id is None:
            raise ValueError("Bounty is not currently claimed")
        
        # Update claim history
        for claim in self.claim_history:
            if claim.status == ClaimStatus.ACTIVE:
                claim.status = ClaimStatus.CANCELLED
                claim.completed_at = datetime.utcnow()
        
        # Create release history entry
        release_history = BountyClaimHistory(
            bounty_id=self.id,
            user_id=self.claimer_id,
            action="released",
            reason=reason,
            status=ClaimStatus.CANCELLED,
            completed_at=datetime.utcnow()
        )
        self.claim_history.append(release_history)
        
        # Reset claim fields
        self.claimer_id = None
        self.claimed_at = None
        self.deadline = None
        self.status = BountyStatus.OPEN
    
    def is_claim_expired(self):
        """Check if current claim has expired"""
        if self.deadline is None or self.claimer_id is None:
            return False
        return datetime.utcnow() > self.deadline
    
    def complete(self):
        """Mark bounty as completed"""
        if self.claimer_id is None:
            raise ValueError("Cannot complete unclaimed bounty")
        
        self.status = BountyStatus.COMPLETED
        
        # Update claim history
        for claim in self.claim_history:
            if claim.status == ClaimStatus.ACTIVE:
                claim.status = ClaimStatus.COMPLETED
                claim.completed_at = datetime.utcnow()
        
        # Create completion history entry
        completion_history = BountyClaimHistory(
            bounty_id=self.id,
            user_id=self.claimer_id,
            action="completed",
            status=ClaimStatus.COMPLETED,
            completed_at=datetime.utcnow()
        )
        self.claim_history.append(completion_history)
    
    def cancel(self, reason="cancelled"):
        """Cancel the bounty"""
        if self.claimer_id is not None:
            self.release_claim("bounty_cancelled")
        
        self.status = BountyStatus.CANCELLED
        self.is_active = False
    
    def get_time_remaining(self):
        """Get time remaining on current claim"""
        if self.deadline is None:
            return None
        
        remaining = self.deadline - datetime.utcnow()
        if remaining.total_seconds() <= 0:
            return timedelta(0)
        return remaining
    
    def validate_reward_amount(self):
        """Validate reward amount"""
        if self.reward_amount is None or self.reward_amount <= 0:
            raise ValueError("Reward amount must be greater than 0")
    
    def validate_deadline(self, deadline_hours):
        """Validate deadline hours"""
        if deadline_hours < 1 or deadline_hours > 720:  # Max 30 days
            raise ValueError("Deadline must be between 1 and 720 hours")

class BountyClaimHistory(Base):
    __tablename__ = 'bounty_claim_history'
    
    id = Column(Integer, primary_key=True)
    bounty_id = Column(Integer, ForeignKey('bounties.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(50), nullable=False)  # claimed, released, completed, expired
    reason = Column(String(255), nullable=True)
    deadline = Column(DateTime, nullable=True)
    status = Column(Enum(ClaimStatus), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    bounty = relationship("Bounty", back_populates="claim_history")
    user = relationship("User", back_populates="bounty_claim_history")