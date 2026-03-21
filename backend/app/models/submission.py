from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    bounty_id = Column(Integer, ForeignKey("bounties.id"), nullable=False, index=True)
    contributor_wallet = Column(String(44), ForeignKey("users.wallet_address"), nullable=False, index=True)
    pr_url = Column(String(500), nullable=False)
    status = Column(String(20), default="under_review", nullable=False, index=True)

    # AI scoring fields
    ai_score = Column(Float, nullable=True)
    gpt_score = Column(Float, nullable=True)
    gemini_score = Column(Float, nullable=True)
    grok_score = Column(Float, nullable=True)

    # Timestamp fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    # Payment tracking
    tx_hash = Column(String(88), nullable=True, index=True)

    # Additional fields for review context
    review_notes = Column(Text, nullable=True)
    dispute_reason = Column(Text, nullable=True)

    # Relationships
    bounty = relationship("Bounty", back_populates="submissions")
    contributor = relationship("User", back_populates="submissions", foreign_keys=[contributor_wallet])

    def __repr__(self):
        return f"<Submission {self.id}: {self.pr_url} ({self.status})>"

    @property
    def is_pending_review(self):
        return self.status == "under_review"

    @property
    def is_approved(self):
        return self.status == "approved"

    @property
    def is_disputed(self):
        return self.status == "disputed"

    @property
    def is_paid(self):
        return self.status == "paid"

    @property
    def has_ai_scores(self):
        return any([self.gpt_score, self.gemini_score, self.grok_score])

    def calculate_ai_score(self):
        scores = [score for score in [self.gpt_score, self.gemini_score, self.grok_score] if score is not None]
        if scores:
            self.ai_score = sum(scores) / len(scores)
        return self.ai_score
