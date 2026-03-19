from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class WebhookEvent(Base):
    __tablename__ = 'webhook_events'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    delivery_id = Column(String(255), unique=True, nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    payload_hash = Column(String(64), nullable=False, index=True)
    payload = Column(Text, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False, default='pending', index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)