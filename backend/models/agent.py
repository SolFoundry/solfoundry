from datetime import datetime
from typing import Optional, List
import enum

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from backend.database import db

Base = declarative_base()


class AgentStatus(enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class Agent(db.Model):
    __tablename__ = 'agents'

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    capabilities = Column(Text)  # JSON string of agent capabilities
    wallet_address = Column(String(44), nullable=False, index=True)
    status = Column(String(20), nullable=False, default=AgentStatus.PENDING.value)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<Agent {self.agent_id}: {self.name}>'

    def to_dict(self):
        """Convert agent instance to dictionary for API responses."""
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'name': self.name,
            'description': self.description,
            'capabilities': self.capabilities,
            'wallet_address': self.wallet_address,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def create_agent(cls, agent_id: str, name: str, wallet_address: str,
                    description: Optional[str] = None, capabilities: Optional[str] = None):
        """Factory method to create a new agent."""
        agent = cls(
            agent_id=agent_id,
            name=name,
            description=description,
            capabilities=capabilities,
            wallet_address=wallet_address,
            status=AgentStatus.PENDING.value
        )
        return agent

    def activate(self):
        """Mark agent as active."""
        self.status = AgentStatus.ACTIVE.value
        self.updated_at = datetime.utcnow()

    def suspend(self):
        """Suspend agent temporarily."""
        self.status = AgentStatus.SUSPENDED.value
        self.updated_at = datetime.utcnow()

    def deactivate(self):
        """Permanently deactivate agent."""
        self.status = AgentStatus.DEACTIVATED.value
        self.updated_at = datetime.utcnow()

    @classmethod
    def find_by_agent_id(cls, agent_id: str):
        """Find agent by unique agent_id."""
        return cls.query.filter_by(agent_id=agent_id).first()

    @classmethod
    def find_by_wallet(cls, wallet_address: str):
        """Find agents by wallet address."""
        return cls.query.filter_by(wallet_address=wallet_address).all()

    @classmethod
    def get_active_agents(cls):
        """Get all active agents."""
        return cls.query.filter_by(status=AgentStatus.ACTIVE.value).all()
