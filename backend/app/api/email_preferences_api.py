"""API endpoints for managing email notification preferences."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_db_session
from app.models.email_preferences import (
    EmailPreferencesResponse,
    EmailPreferencesUpdate,
)
from app.services.email_preferences_service import EmailPreferencesService

router = APIRouter(prefix="/api/v1/email-preferences", tags=["email-preferences"])


async def _get_service(db: AsyncSession = Depends(get_db_session)):
    return EmailPreferencesService(db)


@router.get("/{user_id}", response_model=EmailPreferencesResponse)
async def get_preferences(
    user_id: str,
    service: EmailPreferencesService = Depends(_get_service),
) -> dict[str, Any]:
    prefs = await service.get_preferences(user_id)
    return {
        "id": prefs.id or "",
        "user_id": prefs.user_id,
        "preferences": prefs.preferences,
        "email_enabled": prefs.email_enabled,
    }


@router.patch("/{user_id}", response_model=EmailPreferencesResponse)
async def update_preferences(
    user_id: str,
    update: EmailPreferencesUpdate,
    service: EmailPreferencesService = Depends(_get_service),
) -> dict[str, Any]:
    prefs = await service.update_preferences(user_id, update)
    return {
        "id": prefs.id or "",
        "user_id": prefs.user_id,
        "preferences": prefs.preferences,
        "email_enabled": prefs.email_enabled,
    }


@router.post("/{user_id}/unsubscribe", response_model=EmailPreferencesResponse)
async def unsubscribe_all(
    user_id: str,
    service: EmailPreferencesService = Depends(_get_service),
) -> dict[str, Any]:
    prefs = await service.unsubscribe_all(user_id)
    return {
        "id": prefs.id or "",
        "user_id": prefs.user_id,
        "preferences": prefs.preferences,
        "email_enabled": prefs.email_enabled,
    }


@router.post("/{user_id}/resubscribe", response_model=EmailPreferencesResponse)
async def resubscribe_all(
    user_id: str,
    service: EmailPreferencesService = Depends(_get_service),
) -> dict[str, Any]:
    prefs = await service.resubscribe_all(user_id)
    return {
        "id": prefs.id or "",
        "user_id": prefs.user_id,
        "preferences": prefs.preferences,
        "email_enabled": prefs.email_enabled,
    }
