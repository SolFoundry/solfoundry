# SPDX-License-Identifier: MIT

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Decimal, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class Payout(Base):
    __tablename__ = 'payouts'

    id = Column(Integer, primary_key=True)
    bounty_id = Column(Integer, ForeignKey('bounties.id'), nullable=False)
    recipient_wallet = Column(String(44), nullable=False, index=True)
    amount = Column(Decimal(20, 6), nullable=False)
    status = Column(String(20), nullable=False, default='pending', index=True)
    transaction_hash = Column(String(88), nullable=True, unique=True, index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    solscan_url = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    # Relationships
    bounty = relationship("Bounty", back_populates="payouts")

    def __repr__(self):
        return f"<Payout(id={self.id}, bounty_id={self.bounty_id}, recipient={self.recipient_wallet[:8]}..., amount={self.amount}, status={self.status})>"

    def to_dict(self):
        return {
            'id': self.id,
            'bounty_id': self.bounty_id,
            'recipient_wallet': self.recipient_wallet,
            'amount': float(self.amount),
            'status': self.status,
            'transaction_hash': self.transaction_hash,
            'retry_count': self.retry_count,
            'error_message': self.error_message,
            'solscan_url': self.solscan_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'failed_at': self.failed_at.isoformat() if self.failed_at else None
        }

    def is_pending(self):
        return self.status == 'pending'

    def is_processing(self):
        return self.status == 'processing'

    def is_confirmed(self):
        return self.status == 'confirmed'

    def is_failed(self):
        return self.status == 'failed'

    def can_retry(self):
        return self.status == 'failed' and self.retry_count < 3

    def mark_processing(self):
        self.status = 'processing'
        self.processed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def mark_confirmed(self, tx_hash, solscan_url=None):
        self.status = 'confirmed'
        self.transaction_hash = tx_hash
        self.solscan_url = solscan_url
        self.confirmed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def mark_failed(self, error_msg=None):
        self.status = 'failed'
        if error_msg:
            self.error_message = error_msg
        self.failed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def increment_retry(self):
        self.retry_count += 1
        self.status = 'pending'
        self.updated_at = datetime.utcnow()
