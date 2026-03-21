from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from backend.models.agent import Agent
from backend.database import get_db
from backend.core.config import settings
from backend.core.exceptions import ValidationError, NotFoundError
import re


class AgentService:
    """Service layer for agent business logic"""

    @staticmethod
    def validate_agent_data(agent_data: Dict[str, Any]) -> None:
        """Validate agent registration data"""
        required_fields = ['name', 'description', 'capabilities', 'wallet_address']

        for field in required_fields:
            if field not in agent_data or not agent_data[field]:
                raise ValidationError(f"Field '{field}' is required")

        # Validate name
        name = agent_data['name']
        if len(name) < 3 or len(name) > 50:
            raise ValidationError("Agent name must be between 3 and 50 characters")

        if not re.match(r'^[a-zA-Z0-9_\-\s]+$', name):
            raise ValidationError("Agent name contains invalid characters")

        # Validate description
        description = agent_data['description']
        if len(description) < 10 or len(description) > 500:
            raise ValidationError("Description must be between 10 and 500 characters")

        # Validate wallet address (basic Solana address format)
        wallet_address = agent_data['wallet_address']
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', wallet_address):
            raise ValidationError("Invalid Solana wallet address format")

        # Validate capabilities
        capabilities = agent_data['capabilities']
        if not isinstance(capabilities, list) or len(capabilities) == 0:
            raise ValidationError("At least one capability must be specified")

        valid_capabilities = [
            'code_generation', 'testing', 'documentation', 'code_review',
            'debugging', 'deployment', 'monitoring', 'analysis'
        ]

        for capability in capabilities:
            if capability not in valid_capabilities:
                raise ValidationError(f"Invalid capability: {capability}")

    @staticmethod
    def parse_capabilities(capabilities_input: Any) -> List[str]:
        """Parse and normalize capabilities input"""
        if isinstance(capabilities_input, str):
            # Handle comma-separated string
            capabilities = [cap.strip().lower() for cap in capabilities_input.split(',')]
        elif isinstance(capabilities_input, list):
            capabilities = [cap.strip().lower() if isinstance(cap, str) else str(cap).lower()
                          for cap in capabilities_input]
        else:
            raise ValidationError("Capabilities must be a list or comma-separated string")

        return [cap for cap in capabilities if cap]

    @staticmethod
    def check_agent_exists(db: Session, name: str = None, wallet_address: str = None) -> bool:
        """Check if agent already exists by name or wallet"""
        query = db.query(Agent)

        if name and wallet_address:
            return query.filter(
                or_(Agent.name == name, Agent.wallet_address == wallet_address)
            ).first() is not None
        elif name:
            return query.filter(Agent.name == name).first() is not None
        elif wallet_address:
            return query.filter(Agent.wallet_address == wallet_address).first() is not None

        return False

    @classmethod
    def register_agent(cls, db: Session, agent_data: Dict[str, Any]) -> Agent:
        """Register a new agent with validation"""
        # Validate input data
        cls.validate_agent_data(agent_data)

        # Parse capabilities
        capabilities = cls.parse_capabilities(agent_data['capabilities'])
        agent_data['capabilities'] = capabilities

        # Check for existing agent
        if cls.check_agent_exists(db, agent_data['name'], agent_data['wallet_address']):
            raise ValidationError("Agent with this name or wallet address already exists")

        # Create agent
        agent = Agent(
            name=agent_data['name'],
            description=agent_data['description'],
            capabilities=capabilities,
            wallet_address=agent_data['wallet_address'],
            status='pending',
            reputation_score=0,
            total_earnings=0.0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

        db.add(agent)
        db.commit()
        db.refresh(agent)

        return agent

    @staticmethod
    def get_agent_by_id(db: Session, agent_id: int) -> Agent:
        """Get agent by ID with validation"""
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise NotFoundError(f"Agent with ID {agent_id} not found")
        return agent

    @staticmethod
    def get_agent_by_wallet(db: Session, wallet_address: str) -> Optional[Agent]:
        """Get agent by wallet address"""
        return db.query(Agent).filter(Agent.wallet_address == wallet_address).first()

    @staticmethod
    def update_agent_status(db: Session, agent_id: int, status: str) -> Agent:
        """Update agent status with validation"""
        valid_statuses = ['pending', 'active', 'inactive', 'suspended', 'banned']

        if status not in valid_statuses:
            raise ValidationError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        agent = AgentService.get_agent_by_id(db, agent_id)
        agent.status = status
        agent.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(agent)

        return agent

    @staticmethod
    def update_agent_reputation(db: Session, agent_id: int, score_change: float) -> Agent:
        """Update agent reputation score"""
        agent = AgentService.get_agent_by_id(db, agent_id)

        new_score = agent.reputation_score + score_change
        agent.reputation_score = max(0, min(100, new_score))  # Clamp between 0-100
        agent.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(agent)

        return agent

    @staticmethod
    def discover_agents(
        db: Session,
        capabilities: Optional[List[str]] = None,
        status: Optional[str] = None,
        min_reputation: Optional[float] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Agent]:
        """Discover agents with filtering options"""
        query = db.query(Agent)

        # Filter by status
        if status:
            query = query.filter(Agent.status == status)
        else:
            # Default to active agents
            query = query.filter(Agent.status == 'active')

        # Filter by capabilities
        if capabilities:
            for capability in capabilities:
                query = query.filter(Agent.capabilities.contains([capability]))

        # Filter by minimum reputation
        if min_reputation is not None:
            query = query.filter(Agent.reputation_score >= min_reputation)

        # Order by reputation score descending
        query = query.order_by(Agent.reputation_score.desc(), Agent.created_at.desc())

        # Apply pagination
        return query.offset(offset).limit(limit).all()

    @staticmethod
    def get_agent_statistics(db: Session, agent_id: int) -> Dict[str, Any]:
        """Get comprehensive agent statistics"""
        agent = AgentService.get_agent_by_id(db, agent_id)

        return {
            'id': agent.id,
            'name': agent.name,
            'status': agent.status,
            'reputation_score': agent.reputation_score,
            'total_earnings': agent.total_earnings,
            'capabilities_count': len(agent.capabilities),
            'capabilities': agent.capabilities,
            'active_since': agent.created_at,
            'last_updated': agent.updated_at
        }

    @staticmethod
    def search_agents(db: Session, search_term: str, limit: int = 20) -> List[Agent]:
        """Search agents by name or description"""
        search_pattern = f"%{search_term}%"

        return db.query(Agent).filter(
            and_(
                Agent.status == 'active',
                or_(
                    Agent.name.ilike(search_pattern),
                    Agent.description.ilike(search_pattern)
                )
            )
        ).order_by(Agent.reputation_score.desc()).limit(limit).all()
