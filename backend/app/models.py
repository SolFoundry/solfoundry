"""SQLAlchemy models for SolFoundry."""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    github_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String(255), unique=True, index=True, nullable=False)
    avatar_url = Column(String(1024), nullable=True)
    email = Column(String(255), nullable=True)
    wallet_address = Column(String(255), nullable=True)
    reputation = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
