from sqlalchemy import String, BigInteger, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from ..db import Base

class Contributor(Base):
    __tablename__ = "contributors"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100))
    wallet_address: Mapped[str] = mapped_column(String(44))  # Solana length
    reputation_score: Mapped[float] = mapped_column(Float, default=0.0)
    t1_completions: Mapped[int] = mapped_column(default=0)
    
    submissions = relationship("Submission", back_populates="contributor")

class Bounty(Base):
    __tablename__ = "bounties"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_number: Mapped[int] = mapped_column(unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    reward_amount: Mapped[int] = mapped_column(BigInteger)
    tier: Mapped[str] = mapped_column(String(10))  # T1, T2, T3
    status: Mapped[str] = mapped_column(default="open")  # open, claimed, closed
    
    submissions = relationship("Submission", back_populates="bounty")

class Submission(Base):
    __tablename__ = "submissions"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    bounty_id: Mapped[int] = mapped_column(ForeignKey("bounties.id"))
    contributor_id: Mapped[int] = mapped_column(ForeignKey("contributors.id"))
    pr_url: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(default="pending")  # pending, merged, rejected
    ai_score: Mapped[float] = mapped_column(Float, nullable=True)
    
    bounty = relationship("Bounty", back_populates="submissions")
    contributor = relationship("Contributor", back_populates="submissions")
