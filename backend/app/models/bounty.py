"""Bounty model for search and filtering."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Text, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import relationship
from app.database import Base


class Bounty(Base):
    """Bounty model for search and filtering."""
    
    __tablename__ = "bounties"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    tier = Column(Integer, nullable=False, index=True)  # 1, 2, 3
    category = Column(String, nullable=True, index=True)  # frontend, backend, contracts, etc
    status = Column(String, default="open", index=True)  # open, claimed, completed
    reward_min = Column(Numeric, nullable=True)
    reward_max = Column(Numeric, nullable=True)
    skills = Column(ARRAY(String), nullable=True)  # Skills required
    deadline = Column(DateTime, nullable=True)
    github_issue_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Full-text search vector
    search_vector = Column(TSVECTOR)
