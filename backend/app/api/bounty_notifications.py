from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.bounty_email_notifications import (
    BountyEmailNotificationService,
    BountyNotificationEvent,
    BountySnapshot,
    NotificationFrequency,
)


router = APIRouter(prefix="/api/notifications", tags=["notifications"])
service = BountyEmailNotificationService()


class PreferencePayload(BaseModel):
    email: str
    frequency: NotificationFrequency = NotificationFrequency.INSTANT
    interests: list[str] = Field(default_factory=list)
    events: list[BountyNotificationEvent] = Field(default_factory=lambda: list(BountyNotificationEvent))
    enabled: bool = True


class BountyEventPayload(BaseModel):
    bounty_id: str
    title: str
    status: str
    reward_amount: float
    reward_token: str
    url: str
    event: BountyNotificationEvent
    skills: list[str] = Field(default_factory=list)
    category: str | None = None


class DeliveryResultPayload(BaseModel):
    provider_message_id: str | None = None
    error: str | None = None
    reason: str | None = None


def to_json(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if is_dataclass(value):
        return {key: to_json(item) for key, item in asdict(value).items()}
    if isinstance(value, list):
        return [to_json(item) for item in value]
    if isinstance(value, tuple):
        return [to_json(item) for item in value]
    if isinstance(value, dict):
        return {key: to_json(item) for key, item in value.items()}
    return value


@router.put("/preferences/{user_id}")
async def upsert_preferences(user_id: str, payload: PreferencePayload) -> dict[str, Any]:
    preference = service.set_preferences(
        user_id=user_id,
        email=payload.email,
        frequency=payload.frequency,
        interests=payload.interests,
        events=payload.events,
        enabled=payload.enabled,
    )
    return to_json(preference)


@router.get("/preferences/{user_id}")
async def get_preferences(user_id: str) -> dict[str, Any]:
    preference = service.get_preferences(user_id)
    if not preference:
        raise HTTPException(status_code=404, detail="notification preferences not found")
    return to_json(preference)


@router.post("/bounty-events")
async def enqueue_bounty_event(payload: BountyEventPayload) -> dict[str, Any]:
    bounty = BountySnapshot(
        id=payload.bounty_id,
        title=payload.title,
        status=payload.status,
        reward_amount=payload.reward_amount,
        reward_token=payload.reward_token,
        url=payload.url,
        skills=tuple(payload.skills),
        category=payload.category,
    )
    deliveries = service.enqueue_bounty_event(bounty, payload.event)
    return {"queued": len(deliveries), "deliveries": to_json(deliveries)}


@router.post("/deliveries/{delivery_id}/sent")
async def mark_delivery_sent(delivery_id: str, payload: DeliveryResultPayload) -> dict[str, Any]:
    try:
        delivery = service.mark_sent(delivery_id, payload.provider_message_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return to_json(delivery)


@router.post("/deliveries/{delivery_id}/failed")
async def mark_delivery_failed(delivery_id: str, payload: DeliveryResultPayload) -> dict[str, Any]:
    try:
        delivery = service.mark_failed(delivery_id, payload.error or "delivery failed")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return to_json(delivery)


@router.post("/deliveries/{delivery_id}/bounce")
async def record_delivery_bounce(delivery_id: str, payload: DeliveryResultPayload) -> dict[str, Any]:
    try:
        delivery = service.record_bounce(delivery_id, payload.reason or "email bounced")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return to_json(delivery)


@router.get("/digest/{user_id}")
async def pending_digest(user_id: str) -> dict[str, Any]:
    items = service.pending_digest(user_id)
    return {"items": to_json(items), "total": len(items)}
