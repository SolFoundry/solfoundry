from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    activity_type = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bounty_id = Column(Integer, ForeignKey("bounties.id"), nullable=True, index=True)
    description = Column(Text, nullable=False)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="activities")
    bounty = relationship("Bounty", back_populates="activities")

    def __repr__(self):
        return f"<Activity(id={self.id}, type={self.activity_type}, user_id={self.user_id})>"

    @classmethod
    def create_bounty_activity(cls, user_id, bounty_id, activity_type, description, metadata=None):
        """Create a bounty-related activity"""
        return cls(
            activity_type=activity_type,
            user_id=user_id,
            bounty_id=bounty_id,
            description=description,
            metadata=metadata or {}
        )

    @classmethod
    def create_user_activity(cls, user_id, activity_type, description, metadata=None):
        """Create a user-only activity"""
        return cls(
            activity_type=activity_type,
            user_id=user_id,
            description=description,
            metadata=metadata or {}
        )
