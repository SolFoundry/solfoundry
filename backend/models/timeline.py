from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship
from enum import Enum
from backend.database import Base


class TimelineEventType(str, Enum):
    BOUNTY_CREATED = "bounty_created"
    BOUNTY_CLAIMED = "bounty_claimed"
    BOUNTY_UNCLAIMED = "bounty_unclaimed"
    SUBMISSION_CREATED = "submission_created"
    SUBMISSION_REVIEWED = "submission_reviewed"
    SUBMISSION_APPROVED = "submission_approved"
    SUBMISSION_REJECTED = "submission_rejected"
    BOUNTY_COMPLETED = "bounty_completed"
    BOUNTY_CANCELLED = "bounty_cancelled"
    COMMENT_ADDED = "comment_added"
    STATUS_CHANGED = "status_changed"
    TIER_CHANGED = "tier_changed"
    REWARD_CHANGED = "reward_changed"


class Timeline(Base):
    __tablename__ = "timelines"

    id = Column(Integer, primary_key=True, index=True)
    bounty_id = Column(Integer, ForeignKey("bounties.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    event_type = Column(SqlEnum(TimelineEventType), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    metadata = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    bounty = relationship("Bounty", back_populates="timeline_events")
    user = relationship("User", back_populates="timeline_events")

    def __repr__(self):
        return f"<Timeline {self.id}: {self.event_type} for bounty {self.bounty_id}>"

    @classmethod
    def create_event(cls, bounty_id, event_type, title, description=None, user_id=None, metadata=None):
        """Helper method to create timeline events"""
        return cls(
            bounty_id=bounty_id,
            event_type=event_type,
            title=title,
            description=description,
            user_id=user_id,
            metadata=metadata
        )

    def to_dict(self):
        """Convert timeline event to dictionary for API responses"""
        return {
            "id": self.id,
            "bounty_id": self.bounty_id,
            "user_id": self.user_id,
            "event_type": self.event_type.value,
            "title": self.title,
            "description": self.description,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user": {
                "id": self.user.id,
                "username": self.user.username,
                "avatar_url": getattr(self.user, 'avatar_url', None)
            } if self.user else None
        }
