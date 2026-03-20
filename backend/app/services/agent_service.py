"""In-memory agent service for MVP."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models.agent import (
    AgentCreate,
    AgentDB,
    AgentListItem,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
)

_store: dict[str, AgentDB] = {}


def _db_to_response(db: AgentDB) -> AgentResponse:
    return AgentResponse(
        id=str(db.id),
        name=db.name,
        role=db.role,
        capabilities=db.capabilities or [],
        languages=db.languages or [],
        apis=db.apis or [],
        operator_wallet=db.operator_wallet,
        bio=db.bio,
        avatar_url=db.avatar_url,
        is_available=db.is_available,
        is_active=db.is_active,
        bounties_completed=db.bounties_completed,
        total_earnings=db.total_earnings,
        reputation_score=db.reputation_score,
        created_at=db.created_at,
        updated_at=db.updated_at,
    )


def _db_to_list_item(db: AgentDB) -> AgentListItem:
    return AgentListItem(
        id=str(db.id),
        name=db.name,
        role=db.role,
        capabilities=db.capabilities or [],
        languages=db.languages or [],
        is_available=db.is_available,
        bounties_completed=db.bounties_completed,
        reputation_score=db.reputation_score,
    )


def register_agent(data: AgentCreate) -> AgentResponse:
    db = AgentDB(
        id=uuid.uuid4(),
        name=data.name,
        role=data.role,
        capabilities=data.capabilities,
        languages=data.languages,
        apis=data.apis,
        operator_wallet=data.operator_wallet,
        bio=data.bio,
        avatar_url=data.avatar_url,
        is_available=True,
        is_active=True,
        bounties_completed=0,
        total_earnings=0.0,
        reputation_score=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    _store[str(db.id)] = db
    return _db_to_response(db)


def list_agents(
    role: Optional[str] = None,
    available: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
) -> AgentListResponse:
    results = [r for r in _store.values() if r.is_active]
    if role:
        results = [r for r in results if r.role == role]
    if available is not None:
        results = [r for r in results if r.is_available == available]
    total = len(results)
    skip = (page - 1) * limit
    return AgentListResponse(
        items=[_db_to_list_item(r) for r in results[skip : skip + limit]],
        total=total,
        page=page,
        limit=limit,
    )


def get_agent(agent_id: str) -> Optional[AgentResponse]:
    db = _store.get(agent_id)
    if not db or not db.is_active:
        return None
    return _db_to_response(db)


def update_agent(
    agent_id: str, data: AgentUpdate
) -> Optional[AgentResponse]:
    db = _store.get(agent_id)
    if not db or not db.is_active:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(db, key, value)
    db.updated_at = datetime.now(timezone.utc)
    return _db_to_response(db)


def delete_agent(agent_id: str) -> bool:
    db = _store.get(agent_id)
    if not db:
        return False
    db.is_active = False
    db.updated_at = datetime.now(timezone.utc)
    return True
