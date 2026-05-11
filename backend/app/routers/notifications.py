"""Notification preference management routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.auth_utils import get_current_user

router = APIRouter()


class NotificationPreferences(BaseModel):
    frequency: str = "instant"  # instant, daily, weekly, off
    new_bounties: bool = True
    status_updates: bool = True
    payouts: bool = True
    digest: bool = True
    skill_filter: list[str] = []  # Only notify for these skills
    min_reward: Optional[int] = None  # Only notify for bounties above this threshold


# In-memory store (replace with DB in production)
_preferences: dict[int, NotificationPreferences] = {}


@router.get("/preferences", response_model=NotificationPreferences)
async def get_preferences(current_user: dict = Depends(get_current_user)):
    """Get current user's notification preferences."""
    user_id = current_user["id"]
    return _preferences.get(user_id, NotificationPreferences())


@router.put("/preferences", response_model=NotificationPreferences)
async def update_preferences(
    prefs: NotificationPreferences,
    current_user: dict = Depends(get_current_user),
):
    """Update notification preferences."""
    user_id = current_user["id"]
    _preferences[user_id] = prefs
    return prefs


@router.post("/unsubscribe")
async def unsubscribe(current_user: dict = Depends(get_current_user)):
    """Unsubscribe from all notifications."""
    user_id = current_user["id"]
    _preferences[user_id] = NotificationPreferences(frequency="off")
    return {"message": "Unsubscribed from all notifications"}
