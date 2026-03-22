"""User profile management endpoints.

Provides endpoints for the authenticated user to view and update their own
profile (linked to the contributor table) and notification preferences.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.database import get_db
from app.api.auth import get_current_user_id
from app.models.user import User, UserResponse
from app.models.contributor import ContributorTable

router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Request/Response schemas
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=1000)
    skills: Optional[List[str]] = None
    social_links: Optional[dict] = None
    avatar_url: Optional[str] = Field(None, max_length=500)


class NotificationSettingsUpdate(BaseModel):
    email_notifications_enabled: Optional[bool] = None
    notification_preferences: Optional[dict] = None


class UserProfileResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = []
    social_links: dict = {}
    email_notifications_enabled: bool = True
    notification_preferences: dict = {}
    reputation_score: float = 0.0
    total_bounties_completed: int = 0
    total_earnings: float = 0.0
    wallet_address: Optional[str] = None
    wallet_verified: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_contributor(
    db: AsyncSession, user: User
) -> ContributorTable:
    """Fetch the contributor profile linked to this user, creating one if absent."""
    result = await db.execute(
        select(ContributorTable).where(ContributorTable.username == user.username)
    )
    contributor = result.scalar_one_or_none()
    if contributor is None:
        contributor = ContributorTable(
            username=user.username,
            display_name=user.username,
            email=user.email,
            avatar_url=user.avatar_url,
        )
        db.add(contributor)
        await db.commit()
        await db.refresh(contributor)
    return contributor


def _build_profile_response(user: User, contributor: ContributorTable) -> UserProfileResponse:
    return UserProfileResponse(
        user_id=str(user.id),
        username=user.username,
        display_name=contributor.display_name,
        email=user.email,
        avatar_url=contributor.avatar_url or user.avatar_url,
        bio=contributor.bio,
        skills=contributor.skills or [],
        social_links=contributor.social_links or {},
        email_notifications_enabled=contributor.email_notifications_enabled,
        notification_preferences=contributor.notification_preferences or {},
        reputation_score=float(contributor.reputation_score or 0),
        total_bounties_completed=contributor.total_bounties_completed or 0,
        total_earnings=float(contributor.total_earnings or 0),
        wallet_address=user.wallet_address,
        wallet_verified=user.wallet_verified,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's account details."""
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from app.services.auth_service import _user_to_response
    return _user_to_response(user)


@router.get(
    "/me/profile",
    response_model=UserProfileResponse,
    summary="Get current user's full profile",
)
async def get_my_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's combined auth + contributor profile."""
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    contributor = await _get_or_create_contributor(db, user)
    return _build_profile_response(user, contributor)


@router.patch(
    "/me/profile",
    response_model=UserProfileResponse,
    summary="Update current user's profile",
)
async def update_my_profile(
    payload: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's display name, bio, skills, and social links."""
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contributor = await _get_or_create_contributor(db, user)

    if payload.display_name is not None:
        contributor.display_name = payload.display_name
    if payload.bio is not None:
        contributor.bio = payload.bio
    if payload.skills is not None:
        contributor.skills = payload.skills
    if payload.social_links is not None:
        contributor.social_links = payload.social_links
    if payload.avatar_url is not None:
        contributor.avatar_url = payload.avatar_url

    await db.commit()
    await db.refresh(contributor)
    return _build_profile_response(user, contributor)


@router.patch(
    "/me/settings",
    response_model=UserProfileResponse,
    summary="Update notification preferences",
)
async def update_my_settings(
    payload: NotificationSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's notification preferences."""
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contributor = await _get_or_create_contributor(db, user)

    if payload.email_notifications_enabled is not None:
        contributor.email_notifications_enabled = payload.email_notifications_enabled
    if payload.notification_preferences is not None:
        contributor.notification_preferences = {
            **(contributor.notification_preferences or {}),
            **payload.notification_preferences,
        }

    await db.commit()
    await db.refresh(contributor)
    return _build_profile_response(user, contributor)
